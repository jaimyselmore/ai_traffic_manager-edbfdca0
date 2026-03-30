/**
 * Validators voor SchedulerResult.
 *
 * Controleert:
 * 1. Totale minuten per taak == durationMinutes uit de spec
 * 2. Geen overlap per assignee per dag (dag-granulariteit)
 * 3. Alle blokken liggen binnen werktijden
 * 4. Alle work_proposal blokken eindigen vóór de milestone-buffer
 * 5. Locked mode: precedence-check (taak met lager orderIndex eindigt vóór hogere start)
 */

import { z } from 'zod';
import type { SchedulingSpec, SchedulerResult, ProposalEvent } from './workbackScheduler';

// ── ZOD SCHEMAS ────────────────────────────────────────────────────────────────

export const ProposalEventSchema = z.object({
  eventId: z.string(),
  projectId: z.string(),
  assigneeId: z.string(),
  taskId: z.string(),
  milestoneId: z.string(),
  type: z.literal('work_proposal'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startHour: z.number().min(0).max(24),
  durationMinutes: z.number().positive(),
  splitIndex: z.number().int().min(0),
  splitTotal: z.number().int().min(1),
}).strict();

export const UnscheduledTaskSchema = z.object({
  taskId: z.string(),
  assigneeId: z.string(),
  milestoneId: z.string(),
  reason: z.string(),
  remainingMinutes: z.number().positive(),
}).strict();

export const SchedulerResultSchema = z.object({
  projectId: z.string(),
  mode: z.enum(['locked', 'unlocked']),
  events: z.array(ProposalEventSchema),
  unscheduled: z.array(UnscheduledTaskSchema),
  warnings: z.array(z.string()),
}).strict();

// ── CONFLICT TYPE ──────────────────────────────────────────────────────────────

export interface ValidationConflict {
  type:
    | 'minutes_mismatch'
    | 'assignee_overlap'
    | 'outside_working_hours'
    | 'after_anchor_buffer'
    | 'precedence_violation';
  taskId?: string;
  assigneeId?: string;
  date?: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  conflicts: ValidationConflict[];
}

// ── HOOFD VALIDATOR ────────────────────────────────────────────────────────────

/**
 * Valideer een SchedulerResult tegen de originele spec.
 *
 * Geeft `valid: true` als er geen conflicts zijn.
 * Bij conflicts worden de redenen gedetailleerd teruggegeven zodat
 * Ellen (of de planner) gerichte alternatieven kan voorstellen.
 */
export function validateSchedulerResult(
  result: SchedulerResult,
  spec: SchedulingSpec
): ValidationResult {
  const conflicts: ValidationConflict[] = [];
  const { workingHours, tasks, milestones, mode } = spec;
  const maxEndHour = workingHours.end;
  const minStartHour = workingHours.start;

  // Bouw milestones map voor snelle lookup
  const milestoneMap = new Map(milestones.map(m => [m.milestoneId, m]));

  // Groepeer events per taskId
  const eventsByTask = new Map<string, ProposalEvent[]>();
  for (const ev of result.events) {
    const list = eventsByTask.get(ev.taskId) || [];
    list.push(ev);
    eventsByTask.set(ev.taskId, list);
  }

  // ── 1. Totale minuten per taak ─────────────────────────────────────────────
  for (const task of tasks) {
    const events = eventsByTask.get(task.taskId) || [];
    const totalPlanned = events.reduce((sum, ev) => sum + ev.durationMinutes, 0);
    if (totalPlanned !== task.durationMinutes) {
      conflicts.push({
        type: 'minutes_mismatch',
        taskId: task.taskId,
        assigneeId: task.assigneeId,
        message: `Taak ${task.taskId}: gepland ${totalPlanned} min, verwacht ${task.durationMinutes} min`,
      });
    }
  }

  // ── 2. Geen overlap per assignee per dag ───────────────────────────────────
  // Key: `assigneeId-date` → totale geplande minuten
  const dailyMinutes = new Map<string, { total: number; taskIds: string[] }>();
  for (const ev of result.events) {
    const key = `${ev.assigneeId}-${ev.date}`;
    const existing = dailyMinutes.get(key) || { total: 0, taskIds: [] };
    existing.total += ev.durationMinutes;
    if (!existing.taskIds.includes(ev.taskId)) existing.taskIds.push(ev.taskId);
    dailyMinutes.set(key, existing);
  }

  const maxDayMinutes = (workingHours.end - workingHours.start) * 60;
  for (const [key, info] of dailyMinutes) {
    if (info.total > maxDayMinutes) {
      const [assigneeId, date] = key.split(/-(?=\d{4})/); // split op `YYYY`
      conflicts.push({
        type: 'assignee_overlap',
        assigneeId,
        date,
        message: `${assigneeId} heeft ${info.total} min op ${date} (max ${maxDayMinutes} min/dag). Taken: ${info.taskIds.join(', ')}`,
      });
    }
  }

  // ── 3. Binnen werktijden ───────────────────────────────────────────────────
  for (const ev of result.events) {
    const endHour = ev.startHour + ev.durationMinutes / 60;
    if (ev.startHour < minStartHour || endHour > maxEndHour) {
      conflicts.push({
        type: 'outside_working_hours',
        taskId: ev.taskId,
        assigneeId: ev.assigneeId,
        date: ev.date,
        message: `${ev.assigneeId} heeft blok buiten werktijden op ${ev.date}: ${ev.startHour}:00-${endHour}:00 (werktijden ${minStartHour}:00-${maxEndHour}:00)`,
      });
    }
  }

  // ── 4. Blokken eindigen vóór milestone-buffer ──────────────────────────────
  for (const ev of result.events) {
    const milestone = milestoneMap.get(ev.milestoneId);
    if (!milestone) continue;

    // Werkdag vóór de presentatiedatum = laatste toegestane dag.
    // Gebruik lokale datum-componenten (niet toISOString!) om UTC-offset fouten te vermijden.
    const anchorDate = new Date(milestone.anchorStart + 'T00:00:00');
    const latestDate = new Date(anchorDate);
    latestDate.setDate(latestDate.getDate() - 1);
    const latestDateStr = [
      latestDate.getFullYear(),
      String(latestDate.getMonth() + 1).padStart(2, '0'),
      String(latestDate.getDate()).padStart(2, '0'),
    ].join('-');

    if (ev.date > latestDateStr) {
      conflicts.push({
        type: 'after_anchor_buffer',
        taskId: ev.taskId,
        assigneeId: ev.assigneeId,
        date: ev.date,
        message: `${ev.assigneeId} heeft workload op ${ev.date}, maar presentatie is op ${milestone.anchorStart} (max toegestaan: ${latestDateStr})`,
      });
    }
  }

  // ── 5. Precedence check (locked mode) ─────────────────────────────────────
  if (mode === 'locked') {
    // Groepeer taken per (milestoneId, assigneeId)
    const tasksByMilestoneAssignee = new Map<string, typeof tasks>();
    for (const task of tasks) {
      const key = `${task.milestoneId}-${task.assigneeId}`;
      const list = tasksByMilestoneAssignee.get(key) || [];
      list.push(task);
      tasksByMilestoneAssignee.set(key, list);
    }

    for (const [, gruppe] of tasksByMilestoneAssignee) {
      const sorted = [...gruppe].sort((a, b) => a.orderIndex - b.orderIndex);
      for (let i = 0; i < sorted.length - 1; i++) {
        const earlier = sorted[i];
        const later = sorted[i + 1];

        const earlierEvents = eventsByTask.get(earlier.taskId) || [];
        const laterEvents = eventsByTask.get(later.taskId) || [];

        if (earlierEvents.length === 0 || laterEvents.length === 0) continue;

        // Laatste blok van `earlier` moet eindigen vóór eerste blok van `later`
        const earlierLastDate = [...earlierEvents].sort((a, b) => b.date.localeCompare(a.date))[0].date;
        const laterFirstDate = [...laterEvents].sort((a, b) => a.date.localeCompare(b.date))[0].date;

        if (earlierLastDate >= laterFirstDate) {
          conflicts.push({
            type: 'precedence_violation',
            taskId: earlier.taskId,
            assigneeId: earlier.assigneeId,
            message: `Volgorde-fout: ${earlier.taskId} (orderIndex ${earlier.orderIndex}) eindigt op ${earlierLastDate}, maar ${later.taskId} (orderIndex ${later.orderIndex}) begint al op ${laterFirstDate}`,
          });
        }
      }
    }
  }

  return {
    valid: conflicts.length === 0,
    conflicts,
  };
}
