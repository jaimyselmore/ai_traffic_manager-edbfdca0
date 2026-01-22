/**
 * Date helper utilities for planning automation
 */

/**
 * Get the Monday of the week for a given date
 */
export function getMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

/**
 * Get all dates between start and end (inclusive)
 */
export function getDaysBetween(startDate: Date | string, endDate: Date | string): Date[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days: Date[] = [];

  const current = new Date(start);
  while (current <= end) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return days;
}

/**
 * Check if a date is a weekend (Saturday or Sunday)
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Get the next working day (skip weekends)
 */
export function getNextWorkingDay(date: Date): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);

  while (isWeekend(next)) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

/**
 * Get day of week as number (0 = Monday, 4 = Friday)
 */
export function getDayOfWeekNumber(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 6 : day - 1; // Convert Sunday (0) to 6, Monday (1) to 0, etc.
}

/**
 * Format date as readable string
 */
export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('nl-NL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
}

/**
 * Get day name in Dutch
 */
export function getDayName(dayOfWeek: number): string {
  const days = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag'];
  return days[dayOfWeek] || '';
}

/**
 * Check if date is in range
 */
export function isDateInRange(date: Date | string, start: Date | string, end: Date | string): boolean {
  const d = new Date(date);
  const s = new Date(start);
  const e = new Date(end);
  return d >= s && d <= e;
}

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Get working days between two dates (excluding weekends)
 */
export function getWorkingDaysBetween(startDate: Date | string, endDate: Date | string): Date[] {
  const allDays = getDaysBetween(startDate, endDate);
  return allDays.filter(date => !isWeekend(date));
}
