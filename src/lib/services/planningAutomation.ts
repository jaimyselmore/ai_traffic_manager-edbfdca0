/**
 * Planning Automation Service
 * Automatically place blocks in the planner based on template input
 * All database operations go through the secure data-access edge function
 */

import { secureInsert } from '@/lib/data/secureDataClient';
import { vindEersteVrijeSlot, heeftVerlof, vindVolgendeVrijeDag } from '@/lib/helpers/slotFinder';
import { getMonday, getDayOfWeekNumber, isWeekend } from '@/lib/helpers/dateHelpers';

interface ProjectFaseInput {
  fase_naam: string;
  medewerkers: string[];
  start_datum: string;
  duur_dagen: number;
  uren_per_dag: number;
}

interface ProjectInput {
  klant_id: string;
  klant_naam: string;
  projectnaam: string;
  projectTitel?: string;
  projecttype?: string;
  deadline?: string;
  fases: ProjectFaseInput[];
}

interface AutomationResult {
  success: boolean;
  projectId?: string;
  blokkenAantal?: number;
  errors?: string[];
  warnings?: string[];
}

/**
 * Main automation function - creates project and schedules all blocks
 */
export async function createProjectAndSchedule(
  projectData: ProjectInput,
  createdBy: string
): Promise<AutomationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // 1. Create project record via secure edge function
    const insertPayload = {
      klant_id: projectData.klant_id,
      omschrijving: projectData.projectnaam,
      projecttype: projectData.projecttype || 'algemeen',
      deadline: projectData.deadline,
      status: 'concept',
      datum_aanvraag: new Date().toISOString().split('T')[0],
      volgnummer: Date.now() % 10000,
      projectnummer: `P-${Date.now().toString().slice(-6)}`
    };

    const { data: projectArr, error: projectError } = await secureInsert<Record<string, unknown>>('projecten', insertPayload);

    const project = Array.isArray(projectArr) ? projectArr[0] : null;

    if (projectError || !project) {
      console.error('Error creating project:', projectError);
      return {
        success: false,
        errors: ['Kon project niet aanmaken: ' + (projectError?.message || 'Onbekende fout')]
      };
    }

    let totaalBlokken = 0;

    // 2. For each fase, create fase and schedule blocks
    for (const fase of projectData.fases) {
      // Create project fase via secure edge function
      const { data: faseArr, error: faseError } = await secureInsert<Record<string, unknown>>('project_fases', {
        project_id: project.id,
        fase_naam: fase.fase_naam,
        fase_type: 'fase',
        medewerkers: fase.medewerkers,
        inspanning_dagen: fase.duur_dagen,
        start_datum: fase.start_datum,
        volgorde: projectData.fases.indexOf(fase) + 1
      });

      const projectFase = Array.isArray(faseArr) ? faseArr[0] : null;

      if (faseError || !projectFase) {
        console.error('Error creating fase:', faseError);
        errors.push(`Kon fase "${fase.fase_naam}" niet aanmaken`);
        continue;
      }

      // Schedule blocks for this fase
      const blokken = await scheduleFaseBlocks({
        projectId: project.id as string,
        faseId: projectFase.id as string,
        klantNaam: projectData.klant_naam,
        projectNummer: project.projectnummer as string,
        faseNaam: fase.fase_naam,
        medewerkers: fase.medewerkers,
        startDatum: fase.start_datum,
        duurDagen: fase.duur_dagen,
        urenPerDag: fase.uren_per_dag,
      });

      totaalBlokken += blokken.length;

      // Collect warnings from scheduling
      if (blokken.length < fase.medewerkers.length * fase.duur_dagen) {
        warnings.push(`Niet alle blokken konden worden geplaatst voor fase "${fase.fase_naam}"`);
      }
    }

    return {
      success: true,
      projectId: project.id as string,
      blokkenAantal: totaalBlokken,
      warnings: warnings.length > 0 ? warnings : undefined
    };

  } catch (error) {
    console.error('Automation error:', error);
    return {
      success: false,
      errors: ['Er ging iets mis: ' + (error instanceof Error ? error.message : 'Onbekende fout')]
    };
  }
}

interface ScheduleFaseBlocksConfig {
  projectId: string;
  faseId: string;
  klantNaam: string;
  projectNummer: string;
  faseNaam: string;
  medewerkers: string[];
  startDatum: string;
  duurDagen: number;
  urenPerDag: number;
}

/**
 * Schedule all blocks for a single fase
 */
async function scheduleFaseBlocks(config: ScheduleFaseBlocksConfig): Promise<Record<string, unknown>[]> {
  const geplaatsteBlokken: Record<string, unknown>[] = [];
  let huidigeDatum = new Date(config.startDatum);

  // Determine discipline/color based on fase name
  const discipline = bepaalDiscipline(config.faseNaam);

  // For each required day
  for (let dag = 0; dag < config.duurDagen; dag++) {
    // Skip weekends
    while (isWeekend(huidigeDatum)) {
      huidigeDatum.setDate(huidigeDatum.getDate() + 1);
    }

    // For each employee
    for (const medewerker of config.medewerkers) {
      // Check verlof
      const heeftMedewerkerVerlof = await heeftVerlof(medewerker, huidigeDatum);
      if (heeftMedewerkerVerlof) {
        console.warn(`${medewerker} heeft verlof op ${huidigeDatum.toISOString().split('T')[0]}`);
        continue;
      }

      // Find first available slot
      const vrijeSlot = await vindEersteVrijeSlot(
        medewerker,
        huidigeDatum,
        config.urenPerDag
      );

      if (!vrijeSlot) {
        console.warn(`Geen vrije slot voor ${medewerker} op ${huidigeDatum.toISOString().split('T')[0]}`);
        // Try next working day
        const volgendeVrijeDag = await vindVolgendeVrijeDag(medewerker, huidigeDatum, config.urenPerDag, 5);
        if (volgendeVrijeDag) {
          console.log(`Blok verplaatst naar ${volgendeVrijeDag.datum.toISOString().split('T')[0]}`);
          huidigeDatum = volgendeVrijeDag.datum;
        } else {
          continue; // Skip this block
        }
      }

      const slot = vrijeSlot || (await vindEersteVrijeSlot(medewerker, huidigeDatum, config.urenPerDag));

      if (slot) {
        // Place block via secure edge function
        const { data: blokArr, error } = await secureInsert<Record<string, unknown>>('taken', {
          project_id: config.projectId,
          fase_id: config.faseId,
          werknemer_naam: medewerker,
          klant_naam: config.klantNaam,
          project_nummer: config.projectNummer,
          fase_naam: config.faseNaam,
          werktype: config.faseNaam,
          discipline: discipline,
          week_start: getMonday(huidigeDatum),
          dag_van_week: getDayOfWeekNumber(huidigeDatum),
          start_uur: slot.startUur,
          duur_uren: slot.duurUren,
          plan_status: 'concept',
          is_hard_lock: false,
        });

        if (error) {
          console.error('Error placing block:', error);
        } else {
          const blok = Array.isArray(blokArr) ? blokArr[0] : null;
          if (blok) geplaatsteBlokken.push(blok);
        }
      }
    }

    // Move to next day
    huidigeDatum.setDate(huidigeDatum.getDate() + 1);
  }

  return geplaatsteBlokken;
}

/**
 * Determine discipline/color based on fase name
 */
function bepaalDiscipline(faseNaam: string): string {
  const lowerNaam = faseNaam.toLowerCase();

  if (lowerNaam.includes('concept')) return 'Conceptontwikkeling';
  if (lowerNaam.includes('strateg')) return 'Strategy';
  if (lowerNaam.includes('creati')) return 'Creative team';
  if (lowerNaam.includes('product') || lowerNaam.includes('shoot')) return 'Productie';
  if (lowerNaam.includes('edit') || lowerNaam.includes('montage')) return 'Studio';
  if (lowerNaam.includes('vfx') || lowerNaam.includes('online')) return 'Studio';
  if (lowerNaam.includes('review') || lowerNaam.includes('meeting')) return 'Intern/Review';

  return 'Algemeen'; // Default
}

/**
 * Simple meeting scheduling (for meetings template)
 */
export async function scheduleMeeting(
  meetingData: {
    onderwerp: string;
    type: string;
    datum: string;
    starttijd: string;
    eindtijd: string;
    locatie?: string;
    medewerkers: string[];
    klant?: string;
  },
): Promise<AutomationResult> {
  try {
    // Parse times
    const startHour = parseInt(meetingData.starttijd.split(':')[0]);
    const endHour = parseInt(meetingData.eindtijd.split(':')[0]);
    const durationHours = endHour - startHour;

    const meetingDate = new Date(meetingData.datum);
    const weekStart = getMonday(meetingDate);
    const dayOfWeek = getDayOfWeekNumber(meetingDate);

    // Create meeting record via secure edge function
    const { data: meetingArr, error: meetingError } = await secureInsert<Record<string, unknown>>('meetings & presentaties', {
      onderwerp: meetingData.onderwerp,
      type: meetingData.type,
      datum: meetingData.datum,
      start_tijd: meetingData.starttijd,
      eind_tijd: meetingData.eindtijd,
      locatie: meetingData.locatie,
      deelnemers: meetingData.medewerkers,
      is_hard_lock: true,
      status: 'concept',
    });

    const meeting = Array.isArray(meetingArr) ? meetingArr[0] : null;

    if (meetingError || !meeting) {
      return {
        success: false,
        errors: ['Kon meeting niet aanmaken: ' + (meetingError?.message || 'Onbekende fout')]
      };
    }

    // Place blocks for each participant
    const blockErrors: string[] = [];
    for (const medewerker of meetingData.medewerkers) {
      const { error } = await secureInsert('taken', {
        werknemer_naam: medewerker,
        klant_naam: meetingData.klant || 'Intern',
        project_nummer: 'MEETING',
        fase_naam: meetingData.type,
        werktype: 'Meeting',
        discipline: 'Meeting',
        week_start: weekStart,
        dag_van_week: dayOfWeek,
        start_uur: startHour,
        duur_uren: durationHours,
        plan_status: 'vast',
        is_hard_lock: true,
      });
      if (error) blockErrors.push(error.message);
    }

    if (blockErrors.length > 0) {
      return {
        success: false,
        errors: ['Sommige deelnemers konden niet worden geblokkeerd: ' + blockErrors.join(', ')]
      };
    }

    return {
      success: true,
      blokkenAantal: meetingData.medewerkers.length
    };

  } catch (error) {
    console.error('Meeting scheduling error:', error);
    return {
      success: false,
      errors: ['Er ging iets mis: ' + (error instanceof Error ? error.message : 'Onbekende fout')]
    };
  }
}
