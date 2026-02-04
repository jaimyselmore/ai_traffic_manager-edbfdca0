// ===========================================
// BESCHIKBAARHEID SERVICE - Unified availability for Ellen
// ===========================================
//
// This service combines all availability sources:
// - Medewerkers: Microsoft Calendar (parttime + afspraken) + Supabase (verlof/ziek)
// - Klanten: Supabase beschikbaarheid data
//
// Used by Ellen to check availability when:
// 1. Creating new projects (check team availability)
// 2. Scheduling meetings/presentations (check medewerker + klant)
// 3. Processing wijzigingsverzoeken (check new team members)

import { supabase } from '@/integrations/supabase/client';
import { getSessionToken } from './secureDataClient';

// Types
export interface WerkDag {
  werkt: boolean;
  start?: number;
  eind?: number;
  reden?: string;
}

export interface Werktijden {
  maandag: WerkDag;
  dinsdag: WerkDag;
  woensdag: WerkDag;
  donderdag: WerkDag;
  vrijdag: WerkDag;
}

export interface KlantBeschikbaarheid {
  maandag: { beschikbaar: boolean; start?: number; eind?: number };
  dinsdag: { beschikbaar: boolean; start?: number; eind?: number };
  woensdag: { beschikbaar: boolean; start?: number; eind?: number };
  donderdag: { beschikbaar: boolean; start?: number; eind?: number };
  vrijdag: { beschikbaar: boolean; start?: number; eind?: number };
}

export interface BezettePeriode {
  start: number;
  eind: number;
  type: 'meeting' | 'planning' | 'afspraak' | 'verlof' | 'parttime';
  bron: 'microsoft' | 'supabase';
  titel?: string;
  project?: string;
}

export interface VrijePeriode {
  start: number;
  eind: number;
  duur: number;
}

export interface DagBeschikbaarheid {
  datum: string;
  dagNaam: string;
  isWerkdag: boolean;
  reden?: string;
  werktijd?: { start: number; eind: number };
  bezet: BezettePeriode[];
  vrij: VrijePeriode[];
  vrijeUren: number;
  totaleWerkuren: number;
}

export interface MedewerkerBeschikbaarheid {
  medewerker: {
    id: number;
    naam: string;
    microsoftConnected: boolean;
  };
  periode: {
    start: string;
    eind: string;
  };
  dagen: DagBeschikbaarheid[];
  samenvatting: {
    totaleWerkuren: number;
    totaleVrijeUren: number;
    bezettingspercentage: number;
  };
}

export interface KlantBeschikbaarheidResponse {
  klant: {
    id: string;
    naam: string;
  };
  beschikbaarheid: KlantBeschikbaarheid;
  voorkeurDag?: string;
  voorkeurTijd?: string;
}

export interface BeschikbaarheidCheckResult {
  beschikbaar: boolean;
  reden?: string;
  suggestie?: string;
  details?: {
    datum: string;
    van: number;
    tot: number;
    conflict?: string;
  };
}

// ===========================================
// MEDEWERKER BESCHIKBAARHEID
// ===========================================

/**
 * Get detailed availability for a medewerker over a date range
 * Uses the edge function that combines Microsoft Calendar + Supabase data
 */
export async function getMedewerkerBeschikbaarheid(
  medewerkerId: number,
  startDatum: string,
  eindDatum: string
): Promise<MedewerkerBeschikbaarheid | null> {
  const sessionToken = getSessionToken();

  if (!sessionToken) {
    console.error('No session token available');
    return null;
  }

  try {
    const { data, error } = await supabase.functions.invoke('get-beschikbaarheid', {
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
      body: {
        medewerker_id: medewerkerId,
        start_datum: startDatum,
        eind_datum: eindDatum,
      },
    });

    if (error) {
      console.error('Error fetching beschikbaarheid:', error);
      return null;
    }

    return data as MedewerkerBeschikbaarheid;
  } catch (err) {
    console.error('Exception in getMedewerkerBeschikbaarheid:', err);
    return null;
  }
}

/**
 * Get availability for multiple medewerkers at once
 */
export async function getTeamBeschikbaarheid(
  medewerkerIds: number[],
  startDatum: string,
  eindDatum: string
): Promise<Map<number, MedewerkerBeschikbaarheid>> {
  const results = new Map<number, MedewerkerBeschikbaarheid>();

  // Fetch all in parallel
  const promises = medewerkerIds.map(async (id) => {
    const beschikbaarheid = await getMedewerkerBeschikbaarheid(id, startDatum, eindDatum);
    if (beschikbaarheid) {
      results.set(id, beschikbaarheid);
    }
  });

  await Promise.all(promises);
  return results;
}

/**
 * Quick check: Is medewerker available on a specific date and time?
 */
export async function isMedewerkerBeschikbaar(
  medewerkerId: number,
  datum: string,
  startUur: number,
  duurUren: number
): Promise<BeschikbaarheidCheckResult> {
  const beschikbaarheid = await getMedewerkerBeschikbaarheid(medewerkerId, datum, datum);

  if (!beschikbaarheid) {
    return {
      beschikbaar: false,
      reden: 'Kon beschikbaarheid niet ophalen',
    };
  }

  const dag = beschikbaarheid.dagen[0];

  if (!dag) {
    return {
      beschikbaar: false,
      reden: 'Geen data voor deze datum',
    };
  }

  if (!dag.isWerkdag) {
    return {
      beschikbaar: false,
      reden: dag.reden || 'Niet werkzaam op deze dag',
    };
  }

  // Check if requested time slot overlaps with any busy period
  const eindUur = startUur + duurUren;
  const conflicten = dag.bezet.filter((b) => {
    return startUur < b.eind && eindUur > b.start;
  });

  if (conflicten.length > 0) {
    const conflict = conflicten[0];
    return {
      beschikbaar: false,
      reden: `Bezet: ${conflict.titel || conflict.type}`,
      details: {
        datum,
        van: conflict.start,
        tot: conflict.eind,
        conflict: conflict.titel,
      },
    };
  }

  // Check if slot is within work hours
  if (dag.werktijd) {
    if (startUur < dag.werktijd.start || eindUur > dag.werktijd.eind) {
      return {
        beschikbaar: false,
        reden: `Buiten werktijden (${dag.werktijd.start}:00 - ${dag.werktijd.eind}:00)`,
      };
    }
  }

  return {
    beschikbaar: true,
  };
}

// ===========================================
// KLANT BESCHIKBAARHEID
// ===========================================

/**
 * Get availability info for a klant
 */
export async function getKlantBeschikbaarheid(
  klantId: string
): Promise<KlantBeschikbaarheidResponse | null> {
  try {
    const { data, error } = await supabase
      .from('klanten')
      .select('id, naam')
      .eq('id', klantId)
      .single();

    if (error || !data) {
      console.error('Error fetching klant beschikbaarheid:', error);
      return null;
    }

    // Default beschikbaarheid - klanten tabel heeft nog geen beschikbaarheid kolommen
    const defaultBeschikbaarheid: KlantBeschikbaarheid = {
      maandag: { beschikbaar: true, start: 9, eind: 17 },
      dinsdag: { beschikbaar: true, start: 9, eind: 17 },
      woensdag: { beschikbaar: true, start: 9, eind: 17 },
      donderdag: { beschikbaar: true, start: 9, eind: 17 },
      vrijdag: { beschikbaar: true, start: 9, eind: 17 },
    };

    return {
      klant: {
        id: data.id,
        naam: data.naam,
      },
      beschikbaarheid: defaultBeschikbaarheid,
      voorkeurDag: undefined,
      voorkeurTijd: undefined,
    };
  } catch (err) {
    console.error('Exception in getKlantBeschikbaarheid:', err);
    return null;
  }
}

/**
 * Check if klant is available on a specific day
 */
export function isKlantBeschikbaarOpDag(
  beschikbaarheid: KlantBeschikbaarheid,
  dagNaam: keyof KlantBeschikbaarheid
): boolean {
  const dag = beschikbaarheid[dagNaam];
  return dag?.beschikbaar ?? true;
}

// ===========================================
// COMBINED CHECKS (for Ellen)
// ===========================================

/**
 * Find a common available slot for medewerker(s) and optionally a klant
 * Used by Ellen for scheduling meetings/presentations
 */
export async function vindGezamenlijkVrijSlot(
  medewerkerIds: number[],
  klantId: string | null,
  startDatum: string,
  eindDatum: string,
  benodigdeUren: number
): Promise<{
  gevonden: boolean;
  datum?: string;
  startUur?: number;
  eindUur?: number;
  suggestie?: string;
}> {
  // Get team beschikbaarheid
  const teamBeschikbaarheid = await getTeamBeschikbaarheid(medewerkerIds, startDatum, eindDatum);

  // Get klant beschikbaarheid if provided
  let klantData: KlantBeschikbaarheidResponse | null = null;
  if (klantId) {
    klantData = await getKlantBeschikbaarheid(klantId);
  }

  // Find first day where everyone is available
  const startDate = new Date(startDatum);
  const endDate = new Date(eindDatum);

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip weekends

    const datumStr = d.toISOString().split('T')[0];
    const dagNamen: (keyof KlantBeschikbaarheid)[] = [
      'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag'
    ];
    const dagNaam = dagNamen[dayOfWeek - 1];

    // Check klant beschikbaarheid for this day
    if (klantData && !isKlantBeschikbaarOpDag(klantData.beschikbaarheid, dagNaam)) {
      continue; // Klant not available this day
    }

    // Get available slots for all medewerkers on this day
    let gemeenschappelijkeVrij: VrijePeriode[] | null = null;

    for (const [, beschikbaarheid] of teamBeschikbaarheid) {
      const dag = beschikbaarheid.dagen.find((d) => d.datum === datumStr);

      if (!dag || !dag.isWerkdag || dag.vrij.length === 0) {
        gemeenschappelijkeVrij = [];
        break;
      }

      if (gemeenschappelijkeVrij === null) {
        gemeenschappelijkeVrij = [...dag.vrij];
      } else {
        // Find intersection of free periods
        gemeenschappelijkeVrij = findIntersection(gemeenschappelijkeVrij, dag.vrij);
      }
    }

    // Find a slot that fits the required hours
    if (gemeenschappelijkeVrij && gemeenschappelijkeVrij.length > 0) {
      for (const slot of gemeenschappelijkeVrij) {
        if (slot.duur >= benodigdeUren) {
          return {
            gevonden: true,
            datum: datumStr,
            startUur: slot.start,
            eindUur: slot.start + benodigdeUren,
          };
        }
      }
    }
  }

  return {
    gevonden: false,
    suggestie: 'Geen gezamenlijk vrij moment gevonden in de opgegeven periode. Probeer een langere periode of minder medewerkers.',
  };
}

/**
 * Helper: Find intersection of two arrays of free periods
 */
function findIntersection(a: VrijePeriode[], b: VrijePeriode[]): VrijePeriode[] {
  const result: VrijePeriode[] = [];

  for (const slotA of a) {
    for (const slotB of b) {
      const start = Math.max(slotA.start, slotB.start);
      const eind = Math.min(slotA.eind, slotB.eind);

      if (start < eind) {
        result.push({
          start,
          eind,
          duur: eind - start,
        });
      }
    }
  }

  return result;
}

// ===========================================
// SYNC FUNCTIONS
// ===========================================

/**
 * Sync parttime days to Microsoft Calendar
 * Call this after updating medewerker werktijden
 */
export async function syncParttimeNaarMicrosoft(medewerkerId: number): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  const sessionToken = getSessionToken();

  if (!sessionToken) {
    return { success: false, error: 'Geen actieve sessie' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('sync-parttime-to-microsoft', {
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
      body: {
        medewerker_id: medewerkerId,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      message: data.message,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Onbekende fout',
    };
  }
}

// ===========================================
// HELPER FUNCTIONS FOR ELLEN
// ===========================================

/**
 * Format beschikbaarheid as readable text for Ellen
 */
export function formatBeschikbaarheidVoorEllen(
  beschikbaarheid: MedewerkerBeschikbaarheid
): string {
  const lines: string[] = [
    `Beschikbaarheid ${beschikbaarheid.medewerker.naam}:`,
    `Periode: ${beschikbaarheid.periode.start} t/m ${beschikbaarheid.periode.eind}`,
    '',
  ];

  for (const dag of beschikbaarheid.dagen) {
    if (!dag.isWerkdag) {
      lines.push(`${dag.dagNaam} ${dag.datum}: Niet werkzaam (${dag.reden || 'parttime'})`);
    } else if (dag.vrijeUren === 0) {
      lines.push(`${dag.dagNaam} ${dag.datum}: Volledig bezet`);
    } else {
      const vrij = dag.vrij.map((v) => `${v.start}:00-${v.eind}:00`).join(', ');
      lines.push(`${dag.dagNaam} ${dag.datum}: ${dag.vrijeUren} uur vrij (${vrij})`);
    }
  }

  lines.push('');
  lines.push(`Totaal: ${beschikbaarheid.samenvatting.totaleVrijeUren} van ${beschikbaarheid.samenvatting.totaleWerkuren} uur beschikbaar (${100 - beschikbaarheid.samenvatting.bezettingspercentage}% vrij)`);

  return lines.join('\n');
}

/**
 * Get a quick summary of team availability
 */
export async function getTeamBeschikbaarheidSamenvatting(
  medewerkerIds: number[],
  datum: string
): Promise<string> {
  const beschikbaarheid = await getTeamBeschikbaarheid(medewerkerIds, datum, datum);

  const lines: string[] = [`Team beschikbaarheid op ${datum}:`, ''];

  for (const [id, data] of beschikbaarheid) {
    const dag = data.dagen[0];
    if (!dag) continue;

    if (!dag.isWerkdag) {
      lines.push(`- ${data.medewerker.naam}: Niet werkzaam`);
    } else {
      lines.push(`- ${data.medewerker.naam}: ${dag.vrijeUren} uur beschikbaar`);
    }
  }

  return lines.join('\n');
}
