/**
 * Regressietests voor WorkbackScheduler
 *
 * Dekt:
 * - Locked mode: finish-to-start keten per assignee
 * - Unlocked mode: onafhankelijke workback
 * - Splits: 8u / 16u / 32u worden correct over meerdere dagen verdeeld
 * - Geen work_proposal blokken op of ná presentatiedag
 * - Geen event type anders dan "work_proposal"
 * - Deterministisch: zelfde input → zelfde output
 * - Variant B: bezette dag wordt overgeslagen
 */

import { describe, it, expect } from 'vitest';
import { workbackSchedule, getWorkingDays } from '../workbackScheduler';
import {
  makeCBRSpec,
  makeBusyVariantB,
  ANCHOR_DATE,
  MILESTONE_ID,
} from './cbr_guidingidea.fixture';
import { validateSchedulerResult } from '../validators';

const DAY_BEFORE_ANCHOR = '2026-04-08'; // dinsdag 8 april (dag vóór presentatie)

// ── Helper ──────────────────────────────────────────────────────────────────

function lastEventDate(result: ReturnType<typeof workbackSchedule>): string {
  return result.events
    .map(e => e.date)
    .sort()
    .slice(-1)[0];
}

function eventsForTask(result: ReturnType<typeof workbackSchedule>, taskId: string) {
  return result.events.filter(e => e.taskId === taskId);
}

// ── LOCKED MODE ─────────────────────────────────────────────────────────────

describe('locked mode — CBR Guiding Idea (variant A, leeg)', () => {
  const spec = makeCBRSpec('locked');
  const result = workbackSchedule(spec);

  it('heeft geen unscheduled taken', () => {
    expect(result.unscheduled).toHaveLength(0);
  });

  it('alle events hebben type work_proposal', () => {
    expect(result.events.every(e => e.type === 'work_proposal')).toBe(true);
  });

  it('geen enkel blok op of ná presentatiedag', () => {
    expect(result.events.every(e => e.date < ANCHOR_DATE)).toBe(true);
  });

  it('laatste werkdag vóór presentatie is uiterlijk 8 april', () => {
    // Locked mode: de taak dichtst bij het anker (Ira, orderIndex 3) eindigt op 8 april
    expect(lastEventDate(result) <= DAY_BEFORE_ANCHOR).toBe(true);
    // Minstens één event op de dag vlak voor de presentatie
    expect(result.events.some(e => e.date === DAY_BEFORE_ANCHOR)).toBe(true);
  });

  it('Tom (16u) is volledig gepland in 2+ blokken', () => {
    const tomEvents = eventsForTask(result, 'tom-uitwerking');
    // Totale minuten = 16 * 60
    const total = tomEvents.reduce((s, e) => s + e.durationMinutes, 0);
    expect(total).toBe(16 * 60);
    // Split over minstens 2 dagen (16u > max 1 dag)
    expect(tomEvents.length).toBeGreaterThanOrEqual(2);
  });

  it('Ira (32u) is volledig gepland in 4+ blokken', () => {
    const iraEvents = eventsForTask(result, 'ira-productie');
    const total = iraEvents.reduce((s, e) => s + e.durationMinutes, 0);
    expect(total).toBe(32 * 60);
    expect(iraEvents.length).toBeGreaterThanOrEqual(4);
  });

  it('splitIndex en splitTotal zijn correct', () => {
    const tomEvents = eventsForTask(result, 'tom-uitwerking');
    const sorted = [...tomEvents].sort((a, b) => a.date.localeCompare(b.date));
    expect(sorted[0].splitIndex).toBe(0);
    expect(sorted[0].splitTotal).toBe(2);
    expect(sorted[1].splitIndex).toBe(1);
    expect(sorted[1].splitTotal).toBe(2);
  });

  it('passes validator', () => {
    const validation = validateSchedulerResult(result, spec);
    expect(validation.valid).toBe(true);
    expect(validation.conflicts).toHaveLength(0);
  });

  it('deterministisch: twee runs leveren identieke output', () => {
    const result2 = workbackSchedule(makeCBRSpec('locked'));
    // Vergelijk dates + durationMinutes per taskId
    const summarize = (r: typeof result) =>
      r.events.map(e => `${e.taskId}:${e.date}:${e.durationMinutes}`).sort().join('|');
    expect(summarize(result)).toBe(summarize(result2));
  });
});

// ── UNLOCKED MODE ────────────────────────────────────────────────────────────

describe('unlocked mode — CBR Guiding Idea (variant A, leeg)', () => {
  const spec = makeCBRSpec('unlocked');
  const result = workbackSchedule(spec);

  it('heeft geen unscheduled taken', () => {
    expect(result.unscheduled).toHaveLength(0);
  });

  it('alle events hebben type work_proposal', () => {
    expect(result.events.every(e => e.type === 'work_proposal')).toBe(true);
  });

  it('geen enkel blok op of ná presentatiedag', () => {
    expect(result.events.every(e => e.date < ANCHOR_DATE)).toBe(true);
  });

  it('Ira (32u) heeft 4 blokken verdeeld over de beschikbare werkdagen', () => {
    const iraEvents = eventsForTask(result, 'ira-productie');
    expect(iraEvents).toHaveLength(4);
    const totalMinutes = iraEvents.reduce((s, e) => s + e.durationMinutes, 0);
    expect(totalMinutes).toBe(32 * 60);
  });

  it('passes validator', () => {
    const validation = validateSchedulerResult(result, spec);
    expect(validation.valid).toBe(true);
  });
});

// ── VARIANT B: BEZETTE DAG ───────────────────────────────────────────────────

describe('locked mode — variant B (Niels halve dag bezet op 7 april)', () => {
  const spec = makeCBRSpec('locked');
  const busy = makeBusyVariantB(); // Niels bezet op 2026-04-07
  const result = workbackSchedule(spec, busy);

  it('Niels heeft geen blok op 2026-04-07', () => {
    const nielsEvents = eventsForTask(result, 'niels-concepontwikkeling');
    expect(nielsEvents.every(e => e.date !== '2026-04-07')).toBe(true);
  });

  it('Niels totale minuten zijn toch 8u', () => {
    const nielsEvents = eventsForTask(result, 'niels-concepontwikkeling');
    const total = nielsEvents.reduce((s, e) => s + e.durationMinutes, 0);
    expect(total).toBe(8 * 60);
  });

  it('geen blok op of ná presentatiedag', () => {
    expect(result.events.every(e => e.date < ANCHOR_DATE)).toBe(true);
  });

  it('passes validator', () => {
    const validation = validateSchedulerResult(result, spec);
    expect(validation.valid).toBe(true);
  });
});

// ── EDGE CASES ───────────────────────────────────────────────────────────────

describe('splits voor grotere workloads', () => {
  it('64u (8 dagen) wordt correct gesplit — locked mode', () => {
    const spec = makeCBRSpec('locked');
    // Vervang Ira's taak met 64u
    spec.tasks = spec.tasks.map(t =>
      t.taskId === 'ira-productie'
        ? { ...t, durationMinutes: 64 * 60 }
        : t
    );
    const result = workbackSchedule(spec);
    const iraEvents = eventsForTask(result, 'ira-productie');
    const total = iraEvents.reduce((s, e) => s + e.durationMinutes, 0);
    expect(total).toBe(64 * 60);
    expect(iraEvents.length).toBeGreaterThanOrEqual(8);
  });

  it('geen voorbereiding of prep events in output — nooit', () => {
    const result = workbackSchedule(makeCBRSpec('locked'));
    const badTypes = result.events.filter(e => e.type !== 'work_proposal');
    expect(badTypes).toHaveLength(0);
    const prepNamen = result.events.filter(e =>
      (e.taskId || '').toLowerCase().includes('voorbereiding') ||
      (e.taskId || '').toLowerCase().includes('prep')
    );
    expect(prepNamen).toHaveLength(0);
  });
});

// ── LOCKED VS UNLOCKED VERGELIJKING ─────────────────────────────────────────

describe('locked vs unlocked volgorde-verschil', () => {
  it('locked: Jakko (orderIndex 0) eindigt vóór Niels (orderIndex 1) begint', () => {
    const result = workbackSchedule(makeCBRSpec('locked'));
    const jakkoEvents = eventsForTask(result, 'jakko-concepontwikkeling');
    const nielsEvents = eventsForTask(result, 'niels-concepontwikkeling');

    if (jakkoEvents.length > 0 && nielsEvents.length > 0) {
      const jakkoLast = [...jakkoEvents].sort((a, b) => b.date.localeCompare(a.date))[0].date;
      const nielsFirst = [...nielsEvents].sort((a, b) => a.date.localeCompare(b.date))[0].date;
      expect(jakkoLast < nielsFirst).toBe(true);
    }
  });

  it('unlocked: Jakko en Niels kunnen dezelfde of overlappende periodes hebben', () => {
    const result = workbackSchedule(makeCBRSpec('unlocked'));
    // In unlocked mode kunnen zij onafhankelijk gepland zijn — geen harde eis op volgorde
    const jakkoEvents = eventsForTask(result, 'jakko-concepontwikkeling');
    const nielsEvents = eventsForTask(result, 'niels-concepontwikkeling');
    // Wél: nog steeds allemaal vóór presentatiedag
    expect(jakkoEvents.every(e => e.date < ANCHOR_DATE)).toBe(true);
    expect(nielsEvents.every(e => e.date < ANCHOR_DATE)).toBe(true);
  });
});

// ── getWorkingDays helper ────────────────────────────────────────────────────

describe('getWorkingDays helper', () => {
  it('geeft alleen ma-vr terug', () => {
    const days = getWorkingDays('2026-04-06', '2026-04-13'); // ma t/m zo
    expect(days).toEqual([
      '2026-04-06', // ma
      '2026-04-07', // di
      '2026-04-08', // wo
      '2026-04-09', // do — maar dit is de ANCHOR dus exclusief bij workload-window
      '2026-04-10', // vr
    ]);
  });

  it('end is exclusief', () => {
    const days = getWorkingDays('2026-04-06', '2026-04-07');
    expect(days).toEqual(['2026-04-06']);
  });
});
