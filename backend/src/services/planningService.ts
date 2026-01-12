import { supabase } from '../config/supabase'
import { getWerknemerCapaciteit, isWerknemerBeschikbaar } from './sheetsSync'
import type { Conflict, CreateTaakDTO, Taak } from '../types'
import { startOfWeek, addDays, parseISO, format } from 'date-fns'

// ============================================
// CONFLICT DETECTIE
// ============================================

export async function checkConflicts(taakData: CreateTaakDTO): Promise<Conflict[]> {
  const conflicts: Conflict[] = []

  // Check 1: Werknemer beschikbaar in Google Sheet? (langdurige afwezigheid)
  if (!isWerknemerBeschikbaar(taakData.werknemer_naam)) {
    conflicts.push({
      type: 'verlof',
      severity: 'error',
      message: `${taakData.werknemer_naam} is momenteel niet beschikbaar (langdurig afwezig)`,
    })
    return conflicts // Stop hier, rest heeft geen zin
  }

  // Check 2: Werktijden (09:00-18:00)
  if (taakData.start_uur < 9 || (taakData.start_uur + taakData.duur_uren) > 18) {
    conflicts.push({
      type: 'werktijden',
      severity: 'error',
      message: 'Taken kunnen alleen gepland worden tussen 09:00-18:00',
    })
  }

  // Check 3: Overlappende taken
  const overlappingTaken = await checkOverlappingTaken(
    taakData.werknemer_naam,
    taakData.week_start,
    taakData.dag_van_week,
    taakData.start_uur,
    taakData.duur_uren
  )

  if (overlappingTaken.length > 0) {
    const details = overlappingTaken
      .map(t => `${t.fase_naam} voor ${t.klant_naam} (${t.start_uur}:00-${t.start_uur + t.duur_uren}:00)`)
      .join(', ')

    conflicts.push({
      type: 'overlap',
      severity: 'error',
      message: `${taakData.werknemer_naam} heeft al een taak op dit tijdslot: ${details}`,
      details: overlappingTaken,
    })
  }

  // Check 4: Hard lock violation (meeting/presentatie op die tijd)
  const hardLockConflict = await checkHardLockConflict(
    taakData.werknemer_naam,
    taakData.week_start,
    taakData.dag_van_week,
    taakData.start_uur,
    taakData.duur_uren
  )

  if (hardLockConflict) {
    conflicts.push({
      type: 'hard_lock',
      severity: 'error',
      message: `Er is een hard lock (meeting/presentatie) op dit tijdslot: ${hardLockConflict}`,
    })
  }

  // Check 5: Verlof (korte afwezigheid)
  const verlofConflict = await checkVerlofConflict(
    taakData.werknemer_naam,
    taakData.week_start,
    taakData.dag_van_week
  )

  if (verlofConflict) {
    conflicts.push({
      type: 'verlof',
      severity: 'error',
      message: `${taakData.werknemer_naam} is met ${verlofConflict.type} van ${verlofConflict.start_datum} t/m ${verlofConflict.eind_datum}`,
      details: verlofConflict,
    })
  }

  // Check 6: Capaciteit (max 80% - dit is een warning, geen error)
  const capaciteitCheck = await checkCapaciteit(taakData.werknemer_naam, taakData.week_start)

  if (capaciteitCheck.percentage > 0.8) {
    conflicts.push({
      type: 'max_capaciteit',
      severity: 'warning',
      message: `Waarschuwing: ${taakData.werknemer_naam} heeft al ${Math.round(capaciteitCheck.percentage * 100)}% capaciteit deze week (max aanbevolen: 80%)`,
      details: capaciteitCheck,
    })
  }

  return conflicts
}

// ============================================
// HELPER FUNCTIES
// ============================================

// Check overlappende taken
async function checkOverlappingTaken(
  werknemerNaam: string,
  weekStart: string,
  dagVanWeek: number,
  startUur: number,
  duurUren: number
): Promise<Taak[]> {
  const { data, error } = await supabase
    .from('taken')
    .select('*')
    .eq('werknemer_naam', werknemerNaam)
    .eq('week_start', weekStart)
    .eq('dag_van_week', dagVanWeek)

  if (error) {
    console.error('Error checking overlapping taken:', error)
    return []
  }

  // Filter taken die overlappen
  return (data || []).filter((taak: Taak) => {
    const taakEind = taak.start_uur + taak.duur_uren
    const nieuweEind = startUur + duurUren

    // Overlap check: taak start voor nieuwe eindigt EN taak eindigt na nieuwe start
    return taak.start_uur < nieuweEind && taakEind > startUur
  })
}

// Check hard lock (meeting/presentatie op die tijd)
async function checkHardLockConflict(
  werknemerNaam: string,
  weekStart: string,
  dagVanWeek: number,
  startUur: number,
  duurUren: number
): Promise<string | null> {
  // Bereken de exacte datum voor deze dag
  const weekStartDate = parseISO(weekStart)
  const targetDate = format(addDays(weekStartDate, dagVanWeek), 'yyyy-MM-dd')

  // Check meetings op die dag
  const { data: meetings, error } = await supabase
    .from('meetings')
    .select('*')
    .eq('datum', targetDate)
    .contains('deelnemers', [werknemerNaam])
    .eq('is_hard_lock', true)

  if (error || !meetings || meetings.length === 0) {
    return null
  }

  // Check of meeting overlapt met de gewenste tijd
  for (const meeting of meetings) {
    const meetingStartUur = parseInt(meeting.start_tijd.split(':')[0])
    const meetingEindUur = parseInt(meeting.eind_tijd.split(':')[0])
    const nieuweEind = startUur + duurUren

    if (meetingStartUur < nieuweEind && meetingEindUur > startUur) {
      return `${meeting.type}: ${meeting.onderwerp} (${meeting.start_tijd}-${meeting.eind_tijd})`
    }
  }

  return null
}

// Check verlof
async function checkVerlofConflict(
  werknemerNaam: string,
  weekStart: string,
  dagVanWeek: number
) {
  // Bereken de exacte datum
  const weekStartDate = parseISO(weekStart)
  const targetDate = format(addDays(weekStartDate, dagVanWeek), 'yyyy-MM-dd')

  const { data, error } = await supabase
    .from('verlof_aanvragen')
    .select('*')
    .eq('werknemer_naam', werknemerNaam)
    .eq('status', 'goedgekeurd')
    .lte('start_datum', targetDate)
    .gte('eind_datum', targetDate)

  if (error || !data || data.length === 0) {
    return null
  }

  return data[0] // Return eerste match
}

// Check capaciteit
async function checkCapaciteit(werknemerNaam: string, weekStart: string) {
  const { data, error } = await supabase
    .from('taken')
    .select('duur_uren')
    .eq('werknemer_naam', werknemerNaam)
    .eq('week_start', weekStart)

  if (error) {
    console.error('Error checking capaciteit:', error)
    return { percentage: 0, bezet: 0, totaal: 40 }
  }

  // Tel totaal aantal uren deze week
  const bezetUren = (data || []).reduce((sum, taak) => sum + taak.duur_uren, 0)
  const totaalUren = getWerknemerCapaciteit(werknemerNaam)
  const percentage = bezetUren / totaalUren

  return {
    percentage,
    bezet: bezetUren,
    totaal: totaalUren,
  }
}

// ============================================
// WEEK START HELPER
// ============================================

// Bereken week start (maandag) voor een gegeven datum
export function getWeekStart(date: Date = new Date()): string {
  const monday = startOfWeek(date, { weekStartsOn: 1 }) // 1 = Monday
  return format(monday, 'yyyy-MM-dd')
}

// ============================================
// HARD LOCK PERMISSION CHECK
// ============================================

// Check of user een hard lock mag verwijderen/wijzigen
export async function canModifyHardLock(taakId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('taken')
    .select('is_hard_lock, created_by, locked_by')
    .eq('id', taakId)
    .single()

  if (error || !data) {
    return false
  }

  // Niet een hard lock? Iedereen mag wijzigen
  if (!data.is_hard_lock) {
    return true
  }

  // Hard lock: alleen creator of locked_by user mag wijzigen
  return data.created_by === userId || data.locked_by === userId
}
