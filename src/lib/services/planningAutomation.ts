/**
 * Planning Automation Service
 * Automatically place blocks in the planner based on template input
 */

import { supabase } from '@/integrations/supabase/client';
import { vindEersteVrijeSlot, heeftVerlof, vindVolgendeVrijeDag } from '@/lib/helpers/slotFinder';
import { getMonday, getDayOfWeekNumber, isWeekend, getWorkingDaysBetween } from '@/lib/helpers/dateHelpers';

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
    // 1. Create project record
    const { data: project, error: projectError } = await supabase
      .from('projecten')
      .insert({
        klant_id: projectData.klant_id,
        omschrijving: projectData.projectnaam,
        titel: projectData.projectTitel,
        projecttype: projectData.projecttype || 'algemeen',
        deadline: projectData.deadline,
        status: 'concept',
        created_by: createdBy
      })
      .select()
      .single();

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
      // Create project fase
      const { data: projectFase, error: faseError } = await supabase
        .from('project_fases')
        .insert({
          project_id: project.id,
          fase_naam: fase.fase_naam,
          fase_type: 'fase',
          medewerkers: fase.medewerkers,
          inspanning_dagen: fase.duur_dagen,
          start_datum: fase.start_datum,
          volgorde: projectData.fases.indexOf(fase) + 1
        })
        .select()
        .single();

      if (faseError || !projectFase) {
        console.error('Error creating fase:', faseError);
        errors.push(`Kon fase "${fase.fase_naam}" niet aanmaken`);
        continue;
      }

      // Schedule blocks for this fase
      const blokken = await scheduleFaseBlocks({
        projectId: project.id,
        faseId: projectFase.id,
        klantNaam: projectData.klant_naam,
        projectNummer: project.projectnummer,
        projectTitel: projectData.projectTitel,
        faseNaam: fase.fase_naam,
        medewerkers: fase.medewerkers,
        startDatum: fase.start_datum,
        duurDagen: fase.duur_dagen,
        urenPerDag: fase.uren_per_dag,
        createdBy
      });

      totaalBlokken += blokken.length;

      // Collect warnings from scheduling
      if (blokken.length < fase.medewerkers.length * fase.duur_dagen) {
        warnings.push(`Niet alle blokken konden worden geplaatst voor fase "${fase.fase_naam}"`);
      }
    }

    return {
      success: true,
      projectId: project.id,
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
  projectTitel?: string;
  faseNaam: string;
  medewerkers: string[];
  startDatum: string;
  duurDagen: number;
  urenPerDag: number;
  createdBy: string;
}

/**
 * Schedule all blocks for a single fase
 */
async function scheduleFaseBlocks(config: ScheduleFaseBlocksConfig): Promise<any[]> {
  const geplaatsteBlokken: any[] = [];
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
        // Place block in database
        const { data: blok, error } = await supabase
          .from('taken')
          .insert({
            project_id: config.projectId,
            fase_id: config.faseId,
            werknemer_naam: medewerker,
            klant_naam: config.klantNaam,
            project_nummer: config.projectNummer,
            project_titel: config.projectTitel,
            fase_naam: config.faseNaam,
            werktype: config.faseNaam,
            discipline: discipline,
            week_start: getMonday(huidigeDatum),
            dag_van_week: getDayOfWeekNumber(huidigeDatum),
            start_uur: slot.startUur,
            duur_uren: slot.duurUren,
            plan_status: 'concept',
            is_hard_lock: false,
            created_by: config.createdBy
          })
          .select()
          .single();

        if (error) {
          console.error('Error placing block:', error);
        } else {
          geplaatsteBlokken.push(blok);
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
  createdBy: string
): Promise<AutomationResult> {
  try {
    // Parse times
    const startHour = parseInt(meetingData.starttijd.split(':')[0]);
    const endHour = parseInt(meetingData.eindtijd.split(':')[0]);
    const durationHours = endHour - startHour;

    const meetingDate = new Date(meetingData.datum);
    const weekStart = getMonday(meetingDate);
    const dayOfWeek = getDayOfWeekNumber(meetingDate);

    // Create meeting record
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings & presentaties')
      .insert({
        onderwerp: meetingData.onderwerp,
        type: meetingData.type,
        datum: meetingData.datum,
        start_tijd: meetingData.starttijd,
        eind_tijd: meetingData.eindtijd,
        locatie: meetingData.locatie,
        deelnemers: meetingData.medewerkers,
        is_hard_lock: true,
        status: 'concept',
        created_by: createdBy
      })
      .select()
      .single();

    if (meetingError || !meeting) {
      return {
        success: false,
        errors: ['Kon meeting niet aanmaken: ' + (meetingError?.message || 'Onbekende fout')]
      };
    }

    // Place blocks for each participant
    const blokkenPromises = meetingData.medewerkers.map((medewerker) =>
      supabase.from('taken').insert({
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
        plan_status: 'vast', // Meetings are always fixed
        is_hard_lock: true,
        created_by: createdBy,
        locked_by: createdBy
      }).select().single()
    );

    const results = await Promise.all(blokkenPromises);
    const errors = results.filter(r => r.error).map(r => r.error!.message);

    if (errors.length > 0) {
      return {
        success: false,
        errors: ['Sommige deelnemers konden niet worden geblokkeerd: ' + errors.join(', ')]
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
