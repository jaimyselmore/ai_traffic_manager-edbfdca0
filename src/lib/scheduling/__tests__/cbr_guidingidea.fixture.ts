/**
 * CBR Guiding Idea — Golden Fixture
 *
 * Scenario: 4 medewerkers, elk 8u workload, presentatie 2026-04-09 16:00.
 * Deadline 2026-04-10.
 *
 * Variant A: geen bezette dagen
 * Variant B: Niels heeft dinsdag 7 april halve dag bezet
 *
 * Splits zijn niet begrensd tot 8u — de scheduler verdeelt elk willekeurig aantal
 * uren over werkdagen (8u/dag max). Bijv. 16u = 2×8u, 32u = 4×8u.
 */

import type { SchedulingSpec } from '../workbackScheduler';

export const MILESTONE_ID = 'cbr-presentatie';
export const ANCHOR_DATE = '2026-04-09'; // presentatiedag

/** Spec met variant A (leeg) */
export function makeCBRSpec(mode: 'locked' | 'unlocked'): SchedulingSpec {
  return {
    projectId: 'cbr-guiding-idea',
    workingHours: { start: 9, end: 17.5 },
    milestones: [
      {
        milestoneId: MILESTONE_ID,
        type: 'presentation',
        anchorStart: ANCHOR_DATE,
        // bufferBeforeMinutes >= 510 (werkdaglengte) → workload eindigt uiterlijk dag vóór presentatie
        bufferBeforeMinutes: 510,
      },
    ],
    tasks: [
      // Jakko — 8u (1 dag)
      {
        taskId: 'jakko-concepontwikkeling',
        milestoneId: MILESTONE_ID,
        assigneeId: 'Jakko',
        durationMinutes: 8 * 60,
        orderIndex: 0,
        preferredGranularityMinutes: 120,
      },
      // Niels — 8u (1 dag)
      {
        taskId: 'niels-concepontwikkeling',
        milestoneId: MILESTONE_ID,
        assigneeId: 'Niels',
        durationMinutes: 8 * 60,
        orderIndex: 1,
        preferredGranularityMinutes: 120,
      },
      // Tom — 16u (2 dagen) — test split over meerdere dagen
      {
        taskId: 'tom-uitwerking',
        milestoneId: MILESTONE_ID,
        assigneeId: 'Tom',
        durationMinutes: 16 * 60,
        orderIndex: 2,
        preferredGranularityMinutes: 120,
      },
      // Ira — 32u (4 dagen) — grote workload test
      {
        taskId: 'ira-productie',
        milestoneId: MILESTONE_ID,
        assigneeId: 'Ira',
        durationMinutes: 32 * 60,
        orderIndex: 3,
        preferredGranularityMinutes: 120,
      },
    ],
    mode,
  };
}

/** Variant B: Niels heeft dinsdag 7 april bezet */
export function makeBusyVariantB(): Map<string, Set<string>> {
  const busy = new Map<string, Set<string>>();
  busy.set('Niels', new Set(['2026-04-07']));
  return busy;
}
