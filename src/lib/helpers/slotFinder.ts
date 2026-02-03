/**
 * Slot finding logic - find available time slots in the planner
 *
 * Updated to use the new beschikbaarheid service that combines:
 * - Medewerker werktijden (parttime dagen)
 * - Verlof/ziek from Supabase
 * - Microsoft Calendar events
 * - Existing planning from taken table
 */

import { supabase } from '@/integrations/supabase/client';
import { getMonday, getDayOfWeekNumber } from './dateHelpers';
import {
  getMedewerkerBeschikbaarheid,
  vindGezamenlijkVrijSlot,
} from '@/lib/data/beschikbaarheidService';

interface TimeSlot {
  startUur: number;
  duurUren: number;
}

interface BestaandBlok {
  start_uur: number;
  duur_uren: number;
}

/**
 * Find the first available time slot for an employee on a given date
 * Now uses the unified beschikbaarheid service
 *
 * @param medewerkernaam - Name of the employee
 * @param datum - Date to check
 * @param benodigdeUren - Number of hours needed
 * @param medewerkerId - Optional: werknemer_id for full beschikbaarheid check
 * @returns TimeSlot or null if no slot available
 */
export async function vindEersteVrijeSlot(
  medewerkernaam: string,
  datum: Date,
  benodigdeUren: number,
  medewerkerId?: number
): Promise<TimeSlot | null> {
  const datumStr = datum.toISOString().split('T')[0];

  // If we have medewerker ID, use the new beschikbaarheid service
  if (medewerkerId) {
    const beschikbaarheid = await getMedewerkerBeschikbaarheid(
      medewerkerId,
      datumStr,
      datumStr
    );

    if (beschikbaarheid && beschikbaarheid.dagen.length > 0) {
      const dag = beschikbaarheid.dagen[0];

      // Not a workday (parttime, verlof, etc.)
      if (!dag.isWerkdag) {
        return null;
      }

      // Find first free slot that fits
      for (const slot of dag.vrij) {
        if (slot.duur >= benodigdeUren) {
          return {
            startUur: slot.start,
            duurUren: benodigdeUren,
          };
        }
      }

      return null; // No slot big enough
    }
  }

  // Fallback to legacy logic (only checks taken table)
  return vindEersteVrijeSlotLegacy(medewerkernaam, datum, benodigdeUren);
}

/**
 * Legacy slot finder - only checks taken table
 * Used when medewerker ID is not available
 */
async function vindEersteVrijeSlotLegacy(
  medewerkernaam: string,
  datum: Date,
  benodigdeUren: number
): Promise<TimeSlot | null> {
  const weekStart = getMonday(datum);
  const dagVanWeek = getDayOfWeekNumber(datum);

  // Haal bestaande blokken op voor deze medewerker op deze dag
  const { data: bestaandeBlokken, error } = await supabase
    .from('taken')
    .select('start_uur, duur_uren')
    .eq('werknemer_naam', medewerkernaam)
    .eq('week_start', weekStart)
    .eq('dag_van_week', dagVanWeek);

  if (error) {
    console.error('Error fetching existing blocks:', error);
    return null;
  }

  // Sorteer bestaande blokken op start_uur
  const bezet = (bestaandeBlokken || [])
    .sort((a, b) => a.start_uur - b.start_uur) as BestaandBlok[];

  // Zoek een vrij gat tussen 09:00 en 18:00
  for (let uur = 9; uur <= 18 - benodigdeUren; uur++) {
    const isVrij = !bezet.some((blok) => {
      const blokEind = blok.start_uur + blok.duur_uren;
      const nieuweEind = uur + benodigdeUren;
      // Check overlap: nieuwe slot overlapt als het begint voor blok eindigt EN eindigt na blok begint
      return uur < blokEind && nieuweEind > blok.start_uur;
    });

    if (isVrij) {
      return { startUur: uur, duurUren: benodigdeUren };
    }
  }

  return null; // Geen vrije slot gevonden
}

/**
 * Check if multiple employees are all available at the same time slot
 * Uses the new beschikbaarheid service for accurate checking
 *
 * @param medewerkers - Array of employee names or IDs
 * @param datum - Date to check
 * @param benodigdeUren - Number of hours needed
 * @param medewerkerIds - Optional: array of werknemer_ids for full beschikbaarheid check
 * @returns TimeSlot or null if no common slot available
 */
export async function vindGemeenschappelijkeSlot(
  medewerkers: string[],
  datum: Date,
  benodigdeUren: number,
  medewerkerIds?: number[]
): Promise<TimeSlot | null> {
  const datumStr = datum.toISOString().split('T')[0];

  // If we have medewerker IDs, use the new beschikbaarheid service
  if (medewerkerIds && medewerkerIds.length > 0) {
    const result = await vindGezamenlijkVrijSlot(
      medewerkerIds,
      null, // No klant
      datumStr,
      datumStr,
      benodigdeUren
    );

    if (result.gevonden && result.startUur !== undefined) {
      return {
        startUur: result.startUur,
        duurUren: benodigdeUren,
      };
    }

    return null;
  }

  // Fallback to legacy logic
  for (let uur = 9; uur <= 18 - benodigdeUren; uur++) {
    const allemaalVrij = await Promise.all(
      medewerkers.map(async (medewerker) => {
        const slot = await checkSlotBeschikbaarLegacy(medewerker, datum, uur, benodigdeUren);
        return slot;
      })
    );

    if (allemaalVrij.every(Boolean)) {
      return { startUur: uur, duurUren: benodigdeUren };
    }
  }

  return null;
}

/**
 * Legacy slot check - only checks taken table
 */
async function checkSlotBeschikbaarLegacy(
  medewerkernaam: string,
  datum: Date,
  startUur: number,
  duurUren: number
): Promise<boolean> {
  const weekStart = getMonday(datum);
  const dagVanWeek = getDayOfWeekNumber(datum);

  const { data: bestaandeBlokken, error } = await supabase
    .from('taken')
    .select('start_uur, duur_uren')
    .eq('werknemer_naam', medewerkernaam)
    .eq('week_start', weekStart)
    .eq('dag_van_week', dagVanWeek);

  if (error) return false;

  const eindUur = startUur + duurUren;

  // Check of er overlap is met bestaande blokken
  const heeftOverlap = (bestaandeBlokken || []).some((blok) => {
    const blokEind = blok.start_uur + blok.duur_uren;
    return startUur < blokEind && eindUur > blok.start_uur;
  });

  return !heeftOverlap;
}

/**
 * Find the next available working day with a free slot
 * Uses the new beschikbaarheid service to check parttime days, verlof, etc.
 *
 * @param medewerkernaam - Employee name
 * @param startDatum - Date to start searching from
 * @param benodigdeUren - Hours needed
 * @param maxDaysToSearch - Maximum days to search (default 30)
 * @param medewerkerId - Optional: werknemer_id for full beschikbaarheid check
 * @returns Object with date and time slot, or null
 */
export async function vindVolgendeVrijeDag(
  medewerkernaam: string,
  startDatum: Date,
  benodigdeUren: number,
  maxDaysToSearch: number = 30,
  medewerkerId?: number
): Promise<{ datum: Date; slot: TimeSlot } | null> {
  let huidigeDatum = new Date(startDatum);
  let daysSearched = 0;

  while (daysSearched < maxDaysToSearch) {
    // Skip weekends
    const dayOfWeek = huidigeDatum.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const slot = await vindEersteVrijeSlot(
        medewerkernaam,
        huidigeDatum,
        benodigdeUren,
        medewerkerId
      );

      if (slot) {
        return { datum: new Date(huidigeDatum), slot };
      }
    }

    huidigeDatum.setDate(huidigeDatum.getDate() + 1);
    daysSearched++;
  }

  return null;
}

/**
 * Check if an employee has leave (verlof) on a specific date
 * This is a quick check against the beschikbaarheid_medewerkers table
 */
export async function heeftVerlof(medewerkernaam: string, datum: Date): Promise<boolean> {
  const dateStr = datum.toISOString().split('T')[0];

  const { data: verlof, error } = await supabase
    .from('beschikbaarheid_medewerkers')
    .select('start_datum, eind_datum')
    .eq('werknemer_naam', medewerkernaam)
    .eq('status', 'goedgekeurd')
    .lte('start_datum', dateStr)
    .gte('eind_datum', dateStr);

  if (error) {
    console.error('Error checking verlof:', error);
    return false;
  }

  return (verlof?.length || 0) > 0;
}

/**
 * Check if a date is a parttime day for an employee
 * Uses the new werktijden JSONB field
 */
export async function isParttimeDag(
  medewerkerId: number,
  datum: Date
): Promise<{ isParttime: boolean; reden?: string }> {
  const dagNamen = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
  const dagNaam = dagNamen[datum.getDay()];

  // Weekend is always "parttime" (not a workday)
  if (dagNaam === 'zondag' || dagNaam === 'zaterdag') {
    return { isParttime: true, reden: 'Weekend' };
  }

  // Note: werktijden column will be available after running the migration
  // Using 'any' cast until Supabase types are regenerated
  const { data: medewerker, error } = await supabase
    .from('medewerkers')
    .select('*')
    .eq('werknemer_id', medewerkerId)
    .single();

  if (error || !medewerker) {
    return { isParttime: false };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const werktijden = (medewerker as any).werktijden as Record<string, { werkt: boolean; reden?: string }> | null;

  if (!werktijden) {
    return { isParttime: false };
  }

  const dagConfig = werktijden[dagNaam];

  if (dagConfig && !dagConfig.werkt) {
    return {
      isParttime: true,
      reden: dagConfig.reden || 'Parttime',
    };
  }

  return { isParttime: false };
}

/**
 * Get a summary of available hours for an employee in a week
 */
export async function getWeekBeschikbaarheidSamenvatting(
  medewerkerId: number,
  weekStart: Date
): Promise<{
  totaalUren: number;
  beschikbaarUren: number;
  bezettingsPercentage: number;
  dagen: Array<{
    datum: string;
    dagNaam: string;
    beschikbaar: boolean;
    vrijeUren: number;
  }>;
} | null> {
  const startDatum = weekStart.toISOString().split('T')[0];
  const eindDatum = new Date(weekStart);
  eindDatum.setDate(eindDatum.getDate() + 4); // Monday to Friday
  const eindDatumStr = eindDatum.toISOString().split('T')[0];

  const beschikbaarheid = await getMedewerkerBeschikbaarheid(
    medewerkerId,
    startDatum,
    eindDatumStr
  );

  if (!beschikbaarheid) {
    return null;
  }

  return {
    totaalUren: beschikbaarheid.samenvatting.totaleWerkuren,
    beschikbaarUren: beschikbaarheid.samenvatting.totaleVrijeUren,
    bezettingsPercentage: beschikbaarheid.samenvatting.bezettingspercentage,
    dagen: beschikbaarheid.dagen.map((dag) => ({
      datum: dag.datum,
      dagNaam: dag.dagNaam,
      beschikbaar: dag.isWerkdag,
      vrijeUren: dag.vrijeUren,
    })),
  };
}
