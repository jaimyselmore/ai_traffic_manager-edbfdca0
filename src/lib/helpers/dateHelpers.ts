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

/**
 * Get week number of a date (ISO 8601)
 */
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Get the Monday (week start) of the week for a given date
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Format date range for week display (Dutch)
 */
export function formatDateRange(weekStart: Date): string {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 4); // Friday

  const months = [
    'januari', 'februari', 'maart', 'april', 'mei', 'juni',
    'juli', 'augustus', 'september', 'oktober', 'november', 'december'
  ];

  const startDay = weekStart.getDate();
  const endDay = weekEnd.getDate();
  const month = months[weekEnd.getMonth()];
  const year = weekEnd.getFullYear();

  return `${startDay} t/m ${endDay} ${month} ${year}`;
}

/**
 * Get the end of the week (Sunday) for a given week start
 */
export function getWeekEnd(weekStart: Date): Date {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  return weekEnd;
}

/**
 * Check if a date is in the current week
 */
export function isCurrentWeek(date: Date): boolean {
  const today = new Date();
  const weekStart = getWeekStart(today);
  const weekEnd = getWeekEnd(weekStart);
  return date >= weekStart && date <= weekEnd;
}
