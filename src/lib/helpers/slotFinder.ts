/**
 * Slot finding logic - find available time slots in the planner
 */

import { supabase } from '@/integrations/supabase/client';
import { getMonday, getDayOfWeekNumber } from './dateHelpers';

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
 * @param medewerkernaam - Name of the employee
 * @param datum - Date to check
 * @param benodigdeUren - Number of hours needed
 * @returns TimeSlot or null if no slot available
 */
export async function vindEersteVrijeSlot(
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
 * @param medewerkers - Array of employee names
 * @param datum - Date to check
 * @param benodigdeUren - Number of hours needed
 * @returns TimeSlot or null if no common slot available
 */
export async function vindGemeenschappelijkeSlot(
  medewerkers: string[],
  datum: Date,
  benodigdeUren: number
): Promise<TimeSlot | null> {
  // Voor elk mogelijk uur, check of ALLE medewerkers vrij zijn
  for (let uur = 9; uur <= 18 - benodigdeUren; uur++) {
    const allemaalVrij = await Promise.all(
      medewerkers.map(async (medewerker) => {
        const slot = await checkSlotBeschikbaar(medewerker, datum, uur, benodigdeUren);
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
 * Check if a specific time slot is available for an employee
 */
async function checkSlotBeschikbaar(
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
 * @param medewerkernaam - Employee name
 * @param startDatum - Date to start searching from
 * @param benodigdeUren - Hours needed
 * @param maxDaysToSearch - Maximum days to search (default 30)
 * @returns Object with date and time slot, or null
 */
export async function vindVolgendeVrijeDag(
  medewerkernaam: string,
  startDatum: Date,
  benodigdeUren: number,
  maxDaysToSearch: number = 30
): Promise<{ datum: Date; slot: TimeSlot } | null> {
  let huidigeDatum = new Date(startDatum);
  let daysSearched = 0;

  while (daysSearched < maxDaysToSearch) {
    // Skip weekends
    const dayOfWeek = huidigeDatum.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const slot = await vindEersteVrijeSlot(medewerkernaam, huidigeDatum, benodigdeUren);
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
 */
export async function heeftVerlof(medewerkernaam: string, datum: Date): Promise<boolean> {
  const dateStr = datum.toISOString().split('T')[0];

  const { data: verlof, error } = await supabase
    .from('verlof_aanvragen')
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
