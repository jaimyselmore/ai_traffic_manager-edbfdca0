// ===========================================
// UTILITY FUNCTIONS - Week & Date Helpers
// Alle mock data is verwijderd en vervangen door echte Supabase data
// ===========================================

/**
 * Berekent het weeknummer van een datum
 */
export function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)
}

/**
 * Geeft de eerste dag (maandag) van de week waarin de datum valt
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is sunday
  return new Date(d.setDate(diff))
}

/**
 * Formatteert een datumbereik als string (bijvoorbeeld "1 jan - 7 jan")
 */
export function formatDateRange(start: Date, end: Date): string {
  const startStr = start.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
  const endStr = end.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
  return `${startStr} - ${endStr}`
}

/**
 * Geeft het einde van de week (zondag) voor een gegeven weekstart
 */
export function getWeekEnd(weekStart: Date): Date {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  return weekEnd
}

/**
 * Checkt of een datum in de huidige week valt
 */
export function isCurrentWeek(date: Date): boolean {
  const today = new Date()
  const weekStart = getWeekStart(today)
  const weekEnd = getWeekEnd(weekStart)
  return date >= weekStart && date <= weekEnd
}
