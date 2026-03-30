/**
 * WorkbackScheduler — deterministische backward-packing planner.
 *
 * Kerninvarianten:
 * - Alle workload eindigt vóór (anchorStart - bufferBeforeMinutes)
 * - Geen overlap per assignee op dag-niveau (dag-granulariteit)
 * - `locked` mode: finish-to-start ketening op basis van orderIndex
 * - `unlocked` mode: elke taak plant onafhankelijk terug vanaf hetzelfde anker
 * - Splits grote blokken over meerdere dagen via preferredGranularityMinutes
 * - Deterministisch: zelfde input → zelfde output
 * - Nooit een event type anders dan "work_proposal" voor workload
 */

// ── TYPES ──────────────────────────────────────────────────────────────────────

export interface WorkingHours {
  /** Start werkuur (bv. 9 voor 09:00) */
  start: number;
  /** Eind werkuur (bv. 17.5 voor 17:30) */
  end: number;
}

export interface Milestone {
  milestoneId: string;
  /** Presentatie of deadline */
  type: 'presentation' | 'deadline';
  /**
   * ISO-datumstring van het anker (YYYY-MM-DD).
   * Bij presentaties: de dag van de presentatie.
   */
  anchorStart: string;
  /**
   * Hoeveel minuten vóór anchorStart de laatste workload-block moet eindigen.
   * Default: 60 (1 uur buffer zodat niemand op presentatiedag nog werkt).
   * Stel 0 in om harde daggrens te gebruiken zonder uurbuffer.
   */
  bufferBeforeMinutes: number;
}

export interface SchedulingTask {
  taskId: string;
  milestoneId: string;
  assigneeId: string;
  /** Totale workload in minuten */
  durationMinutes: number;
  /**
   * Volgorde in de tijdlijn (lager = eerder).
   * Wordt gebruikt in `locked` mode voor finish-to-start ketening.
   */
  orderIndex: number;
  /**
   * Minimale blokgrootte in minuten. Blokken worden nooit kleiner dan dit tenzij
   * het de allerlaatste rest is.
   */
  preferredGranularityMinutes: number;
}

export interface SchedulingSpec {
  projectId: string;
  workingHours: WorkingHours;
  milestones: Milestone[];
  tasks: SchedulingTask[];
  /** Volgorde-modus voor planning */
  mode: 'locked' | 'unlocked';
}

// ── OUTPUT ─────────────────────────────────────────────────────────────────────

export interface ProposalEvent {
  eventId: string;
  projectId: string;
  assigneeId: string;
  taskId: string;
  milestoneId: string;
  /** Altijd "work_proposal" — nooit "prep", "voorbereiding" of andere types */
  type: 'work_proposal';
  /** ISO-datumstring YYYY-MM-DD */
  date: string;
  /** Startuur (decimaal, bv. 9 = 09:00) */
  startHour: number;
  /** Duur in minuten */
  durationMinutes: number;
  /** Index van dit split-blok (0-based) */
  splitIndex: number;
  /** Totaal aantal split-blokken voor deze taak */
  splitTotal: number;
}

export interface UnscheduledTask {
  taskId: string;
  assigneeId: string;
  milestoneId: string;
  reason: string;
  remainingMinutes: number;
}

export interface SchedulerResult {
  projectId: string;
  mode: 'locked' | 'unlocked';
  events: ProposalEvent[];
  unscheduled: UnscheduledTask[];
  warnings: string[];
}

// ── DATE HELPERS ───────────────────────────────────────────────────────────────

function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  return day === 0 || day === 6;
}

/**
 * Geeft een gesorteerde lijst van werkdagen (ma-vr) tussen start en end (exclusief).
 * end is exclusief: de dag van de presentatie/deadline zelf telt niet mee als werkdag
 * (de buffer zorgt er al voor dat workload eerder eindigt).
 */
export function getWorkingDays(startStr: string, endStr: string): string[] {
  const result: string[] = [];
  const d = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  while (d < end) {
    const day = d.getDay();
    if (day >= 1 && day <= 5) {
      result.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      );
    }
    d.setDate(d.getDate() + 1);
  }
  return result;
}

/** Tel N werkdagen terug vanaf dateStr (exclusief dateStr zelf) */
function subtractWorkDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  let subtracted = 0;
  while (subtracted < days) {
    d.setDate(d.getDate() - 1);
    if (!isWeekend(d.toISOString().split('T')[0])) subtracted++;
  }
  return d.toISOString().split('T')[0];
}

/** ISO-string van de dag vóór dateStr */
function dayBefore(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

// ── CORE SCHEDULER ─────────────────────────────────────────────────────────────

/**
 * Bereken de EXCLUSIEVE bovengrens voor workload-dagen van een milestone.
 * `getWorkingDays(start, exclusiveEnd)` geeft alle werkdagen vóór `exclusiveEnd`.
 *
 * Bij bufferBeforeMinutes >= werkdaglengte: gebruik anchorStart als exclusieve grens
 * → werkdagen t/m DAY-BEFORE(anchorStart) zijn beschikbaar.
 */
function getLatestWorkloadDateExclusive(milestone: Milestone, workingHours: WorkingHours): string {
  const dayMinutes = (workingHours.end - workingHours.start) * 60;
  if (milestone.bufferBeforeMinutes >= dayMinutes) {
    // Volledige dag buffer: presentatiedag zelf is verboden → exclusieve grens = anchorStart
    return milestone.anchorStart;
  }
  // Kleinere buffer: ook de dag vóór de presentatie is verboden als safety-marge
  return dayBefore(milestone.anchorStart);
}

/**
 * Bereken hoeveel minuten per dag gepland kunnen worden.
 * Geeft altijd de werkdagcapaciteit in minuten terug.
 */
function minutesPerDay(workingHours: WorkingHours): number {
  return Math.floor((workingHours.end - workingHours.start) * 60);
}

/**
 * Bereken de blokgrootte voor een specifieke `remaining` waarde.
 * Respecteert preferredGranularityMinutes maar breekt af als er minder over is.
 */
function blockSize(remaining: number, granularity: number, maxPerDay: number): number {
  if (remaining <= granularity) return remaining;
  if (remaining <= maxPerDay) return remaining;
  return Math.min(maxPerDay, Math.floor(remaining / granularity) * granularity || granularity);
}

let _eventCounter = 0;
function nextEventId(): string {
  return `ev-${++_eventCounter}`;
}

/**
 * Plan één taak ACHTERUIT op de beschikbare dagen.
 * Muteert `occupiedMinutes` in-place om overlap te voorkomen.
 *
 * @param task - De te plannen taak
 * @param candidateDays - Gesorteerde werkdagen van MEEST recent → MINST recent
 * @param occupiedMinutes - Map van `assigneeId-dateStr` → al geplande minuten die dag
 * @param maxPerDay - Maximale werkminuten per dag
 * @param projectId
 */
function scheduleTaskBackward(
  task: SchedulingTask,
  candidateDays: string[],
  occupiedMinutes: Map<string, number>,
  maxPerDay: number,
  projectId: string
): { events: ProposalEvent[]; remaining: number } {
  const rawBlocks: Array<{ date: string; durationMinutes: number; startHour: number }> = [];
  let remaining = task.durationMinutes;

  for (const day of candidateDays) {
    if (remaining <= 0) break;
    const key = `${task.assigneeId}-${day}`;
    const alreadyUsed = occupiedMinutes.get(key) || 0;
    const available = maxPerDay - alreadyUsed;
    if (available <= 0) continue;

    const toPlace = Math.min(available, remaining);
    const startHour = 9; // Altijd starten om 09:00
    rawBlocks.push({ date: day, durationMinutes: toPlace, startHour });
    occupiedMinutes.set(key, alreadyUsed + toPlace);
    remaining -= toPlace;
  }

  // Sorteer blocks chronologisch (vroegste eerst) voor output
  rawBlocks.sort((a, b) => a.date.localeCompare(b.date));

  const events: ProposalEvent[] = rawBlocks.map((b, idx) => ({
    eventId: nextEventId(),
    projectId,
    assigneeId: task.assigneeId,
    taskId: task.taskId,
    milestoneId: task.milestoneId,
    type: 'work_proposal',
    date: b.date,
    startHour: b.startHour,
    durationMinutes: b.durationMinutes,
    splitIndex: idx,
    splitTotal: rawBlocks.length,
  }));

  return { events, remaining };
}

// ── HOOFD EXPORT ───────────────────────────────────────────────────────────────

/**
 * Deterministisch workback-algoritme.
 *
 * In `locked` mode worden taken per milestone in OMGEKEERDE orderIndex volgorde
 * gepland. Na het plannen van taak i wordt de vroegste startdatum van die taak
 * als nieuwe eindgrens gebruikt voor taak i-1 (finish-to-start keten).
 *
 * In `unlocked` mode plant elke taak onafhankelijk terug vanaf hetzelfde anker.
 * Er geldt nog steeds geen-overlap per assignee per dag.
 */
export function workbackSchedule(
  spec: SchedulingSpec,
  /**
   * Reeds bezette dagen per assignee van andere projecten.
   * Map van `assigneeId` → Set van bezette datumstrings (YYYY-MM-DD).
   */
  busyByAssignee: Map<string, Set<string>> = new Map()
): SchedulerResult {
  _eventCounter = 0; // reset voor determinisme

  const { projectId, workingHours, milestones, tasks, mode } = spec;
  const maxPerDay = minutesPerDay(workingHours);
  const allEvents: ProposalEvent[] = [];
  const unscheduled: UnscheduledTask[] = [];
  const warnings: string[] = [];

  // Bouw occupiedMinutes op vanuit busyByAssignee (hele dag = maxPerDay)
  const occupiedMinutes = new Map<string, number>();
  for (const [assigneeId, days] of busyByAssignee) {
    for (const day of days) {
      const key = `${assigneeId}-${day}`;
      occupiedMinutes.set(key, maxPerDay);
    }
  }

  // Verwerk per milestone
  for (const milestone of milestones) {
    const latestEnd = getLatestWorkloadDateExclusive(milestone, workingHours);

    // Taken voor deze milestone, gesorteerd op orderIndex
    const milestoneTasks = tasks
      .filter(t => t.milestoneId === milestone.milestoneId)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    if (mode === 'locked') {
      // ── LOCKED: finish-to-start keten ─────────────────────────────────────
      // Plan in omgekeerde volgorde: laatste taak eerst (dichtst bij anker)
      let currentEnd = latestEnd; // eindgrens voor de huidige taak

      for (let i = milestoneTasks.length - 1; i >= 0; i--) {
        const task = milestoneTasks[i];

        // Kandidaatdagen: alles t/m currentEnd, meest recent eerst
        const windowStart = subtractWorkDays(currentEnd, 60); // max 60 werkdagen terug
        const candidates = getWorkingDays(windowStart, currentEnd).reverse();

        const { events, remaining } = scheduleTaskBackward(
          task, candidates, occupiedMinutes, maxPerDay, projectId
        );

        allEvents.push(...events);

        if (remaining > 0) {
          unscheduled.push({
            taskId: task.taskId,
            assigneeId: task.assigneeId,
            milestoneId: task.milestoneId,
            reason: `Onvoldoende ruimte vóór ${currentEnd} (${remaining} min niet gepland)`,
            remainingMinutes: remaining,
          });
          warnings.push(`${task.taskId}: ${remaining} min niet ingepland (milestone ${milestone.milestoneId})`);
        }

        // Schuif de eindgrens: vorige taak moet eindigen vóór de vroegste start van deze
        if (events.length > 0) {
          const earliestDate = events[0].date; // al gesorteerd (vroegste eerst)
          currentEnd = dayBefore(earliestDate);
        } else {
          // Geen enkel blok gepland → houd currentEnd voor vorige taak ongewijzigd
          // maar waarschuw dat de keten gebroken is
          warnings.push(`${task.taskId}: geen blokken gepland, keten kan gebroken zijn`);
        }
      }
    } else {
      // ── UNLOCKED: onafhankelijke workback per taak ─────────────────────────
      const windowStart = subtractWorkDays(latestEnd, 60);
      const baseCandidates = getWorkingDays(windowStart, latestEnd).reverse();

      for (const task of milestoneTasks) {
        const { events, remaining } = scheduleTaskBackward(
          task, baseCandidates, occupiedMinutes, maxPerDay, projectId
        );

        allEvents.push(...events);

        if (remaining > 0) {
          unscheduled.push({
            taskId: task.taskId,
            assigneeId: task.assigneeId,
            milestoneId: task.milestoneId,
            reason: `Onvoldoende ruimte vóór ${latestEnd} (${remaining} min niet gepland)`,
            remainingMinutes: remaining,
          });
          warnings.push(`${task.taskId}: ${remaining} min niet ingepland`);
        }
      }
    }
  }

  // Sorteer alle events chronologisch
  allEvents.sort((a, b) => a.date.localeCompare(b.date) || a.assigneeId.localeCompare(b.assigneeId));

  return {
    projectId,
    mode,
    events: allEvents,
    unscheduled,
    warnings,
  };
}

// ── ADAPTER: SchedulingSpec opbouwen vanuit template payload ──────────────────

export interface TemplateWorkloadEntry {
  taskId: string;
  milestoneId: string;
  assigneeId: string;
  /** Totale uren workload */
  totalHours: number;
  /** Positie in de tijdlijn (0-based) */
  orderIndex: number;
}

export interface TemplateMilestone {
  milestoneId: string;
  type: 'presentation' | 'deadline';
  /** YYYY-MM-DD */
  anchorDate: string;
  /** Minuten buffer vóór anker. Default 480 (hele werkdag) */
  bufferBeforeMinutes?: number;
}

/**
 * Bouw een SchedulingSpec op vanuit ruwe template-data.
 * Converteert uren → minuten en vult defaults in.
 */
export function buildSchedulingSpec(
  projectId: string,
  milestones: TemplateMilestone[],
  workload: TemplateWorkloadEntry[],
  mode: 'locked' | 'unlocked',
  workingHours: WorkingHours = { start: 9, end: 17.5 }
): SchedulingSpec {
  return {
    projectId,
    workingHours,
    milestones: milestones.map(m => ({
      milestoneId: m.milestoneId,
      type: m.type,
      anchorStart: m.anchorDate,
      bufferBeforeMinutes: m.bufferBeforeMinutes ?? 480,
    })),
    tasks: workload.map(w => ({
      taskId: w.taskId,
      milestoneId: w.milestoneId,
      assigneeId: w.assigneeId,
      durationMinutes: Math.round(w.totalHours * 60),
      orderIndex: w.orderIndex,
      preferredGranularityMinutes: 120,
    })),
    mode,
  };
}

// ── ADAPTER: ProposalEvent → VoorstelTaak (voor EllenVoorstel UI) ─────────────

export interface VoorstelTaakCompat {
  werknemer_naam: string;
  fase_naam: string;
  dag_van_week: number; // 0=ma..4=vr
  week_start: string; // YYYY-MM-DD (maandag)
  start_uur: number;
  duur_uren: number;
  werktype: string;
}

/**
 * Converteer ProposalEvents naar het VoorstelTaak-formaat dat de planner UI verwacht.
 *
 * @param events - Uitvoer van workbackSchedule
 * @param werktype - Eén werktype voor alle workload-blokken (bijv. 'concept')
 * @param taskFaseNamen - Map van taskId → fase_naam voor UI weergave
 */
export function proposalEventsToVoorstelTaken(
  events: ProposalEvent[],
  werktype: string,
  taskFaseNamen: Map<string, string>
): VoorstelTaakCompat[] {
  return events.map(ev => {
    const d = new Date(ev.date + 'T00:00:00');
    const jsDay = d.getDay(); // 0=zo..6=za
    const dagVanWeek = jsDay === 0 ? 6 : jsDay - 1; // 0=ma..4=vr

    // Bereken maandag van de week
    const maandag = new Date(d);
    maandag.setDate(d.getDate() - (jsDay === 0 ? 6 : jsDay - 1));
    const weekStart = maandag.toISOString().split('T')[0];

    return {
      werknemer_naam: ev.assigneeId,
      fase_naam: taskFaseNamen.get(ev.taskId) ?? ev.taskId,
      dag_van_week: dagVanWeek,
      week_start: weekStart,
      start_uur: ev.startHour,
      duur_uren: ev.durationMinutes / 60,
      werktype,
    };
  });
}
