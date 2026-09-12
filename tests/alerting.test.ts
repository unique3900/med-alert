import { describe, expect, it } from 'vitest';
import {
  ALERT_POLICY,
  alertIntervalMinutes,
  classifyTaken,
  isAbandoned,
  shouldAlert,
  supersededIds,
} from '@/lib/domain/alerting';
import { doseOutcome, minutesLate, summarize } from '@/lib/domain/doses';
import type { Dose } from '@/lib/db/types';

const NOW = new Date('2026-09-12T20:00:00Z');
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();

describe('alert cadence', () => {
  it('rings every two minutes for the first half hour', () => {
    expect(alertIntervalMinutes(0)).toBe(2);
    expect(alertIntervalMinutes(29)).toBe(2);
  });

  it('backs off as the dose ages', () => {
    expect(alertIntervalMinutes(30)).toBe(5);
    expect(alertIntervalMinutes(119)).toBe(5);
    expect(alertIntervalMinutes(120)).toBe(15);
    expect(alertIntervalMinutes(359)).toBe(15);
    expect(alertIntervalMinutes(360)).toBe(30);
    expect(alertIntervalMinutes(10_000)).toBe(30);
  });
});

describe('shouldAlert', () => {
  it('stays quiet before the dose is due', () => {
    expect(shouldAlert({ dueAt: minutesAgo(-10), lastAlertAt: null }, NOW)).toBe(false);
  });

  it('fires within the lead window', () => {
    const justAhead = new Date(NOW.getTime() + 20_000).toISOString();
    expect(ALERT_POLICY.leadSeconds).toBe(30);
    expect(shouldAlert({ dueAt: justAhead, lastAlertAt: null }, NOW)).toBe(true);
  });

  it('fires immediately the first time', () => {
    expect(shouldAlert({ dueAt: minutesAgo(0), lastAlertAt: null }, NOW)).toBe(true);
  });

  it('waits out the interval for the current tier', () => {
    const dueAt = minutesAgo(10);
    expect(shouldAlert({ dueAt, lastAlertAt: minutesAgo(1) }, NOW)).toBe(false);
    expect(shouldAlert({ dueAt, lastAlertAt: minutesAgo(2) }, NOW)).toBe(true);
  });

  it('uses the slower tier once the dose is hours old', () => {
    const dueAt = minutesAgo(200);
    expect(shouldAlert({ dueAt, lastAlertAt: minutesAgo(10) }, NOW)).toBe(false);
    expect(shouldAlert({ dueAt, lastAlertAt: minutesAgo(15) }, NOW)).toBe(true);
  });

  it('never stops on its own', () => {
    const dueAt = minutesAgo(40 * 60);
    expect(shouldAlert({ dueAt, lastAlertAt: minutesAgo(31) }, NOW)).toBe(true);
  });
});

describe('backstop', () => {
  it('gives up only after the configured window', () => {
    expect(isAbandoned({ dueAt: minutesAgo(47 * 60) }, NOW)).toBe(false);
    expect(isAbandoned({ dueAt: minutesAgo(49 * 60) }, NOW)).toBe(true);
  });
});

describe('supersede', () => {
  const dose = (id: string, medicationId: string, dueMinutesAgo: number) => ({
    id,
    medicationId,
    dueAt: minutesAgo(dueMinutesAgo),
  });

  it('leaves a lone open dose alone', () => {
    expect(supersededIds([dose('a', 'med-1', 30)], NOW)).toEqual([]);
  });

  it('closes the earlier dose once a later one of the same medication is due', () => {
    const doses = [dose('morning', 'med-1', 720), dose('evening', 'med-1', 5)];
    expect(supersededIds(doses, NOW)).toEqual(['morning']);
  });

  it('does not let a future dose supersede anything yet', () => {
    const doses = [dose('morning', 'med-1', 720), dose('evening', 'med-1', -60)];
    expect(supersededIds(doses, NOW)).toEqual([]);
  });

  it('treats medications independently', () => {
    const doses = [
      dose('a-morning', 'med-1', 720),
      dose('a-evening', 'med-1', 5),
      dose('b-only', 'med-2', 400),
    ];
    expect(supersededIds(doses, NOW)).toEqual(['a-morning']);
  });
});

describe('lateness', () => {
  it('counts a prompt dose as on time', () => {
    expect(classifyTaken(minutesAgo(20), minutesAgo(10))).toEqual({ lateness: 'on-time', minutesLate: 10 });
  });

  it('counts a forgotten dose as late', () => {
    expect(classifyTaken(minutesAgo(200), minutesAgo(10))).toEqual({ lateness: 'late', minutesLate: 190 });
  });

  it('never reports negative lateness for an early dose', () => {
    expect(classifyTaken(minutesAgo(10), minutesAgo(20)).minutesLate).toBe(0);
  });
});

describe('outcomes', () => {
  const dose = (overrides: Partial<Dose>) =>
    ({ status: 'pending', due_at: minutesAgo(60), resolved_at: null, ...overrides }) as Dose;

  it('separates taken from taken late', () => {
    expect(doseOutcome(dose({ status: 'taken', due_at: minutesAgo(60), resolved_at: minutesAgo(55) }), NOW)).toBe(
      'taken',
    );
    expect(doseOutcome(dose({ status: 'taken', due_at: minutesAgo(60), resolved_at: minutesAgo(5) }), NOW)).toBe(
      'late',
    );
  });

  it('separates upcoming from overdue', () => {
    expect(doseOutcome(dose({ due_at: minutesAgo(-30) }), NOW)).toBe('upcoming');
    expect(doseOutcome(dose({ due_at: minutesAgo(30) }), NOW)).toBe('overdue');
  });

  it('reports how late a dose was taken', () => {
    expect(minutesLate(dose({ status: 'taken', due_at: minutesAgo(90), resolved_at: minutesAgo(30) }))).toBe(60);
    expect(minutesLate(dose({ status: 'missed' }))).toBe(0);
  });

  it('summarises a month', () => {
    const summary = summarize(
      [
        dose({ status: 'taken', due_at: minutesAgo(300), resolved_at: minutesAgo(299) }),
        dose({ status: 'taken', due_at: minutesAgo(200), resolved_at: minutesAgo(100) }),
        dose({ status: 'missed', due_at: minutesAgo(400), resolved_at: minutesAgo(390) }),
        dose({ status: 'skipped', due_at: minutesAgo(500), resolved_at: minutesAgo(495) }),
        dose({ status: 'pending', due_at: minutesAgo(60) }),
        dose({ status: 'pending', due_at: minutesAgo(-60) }),
      ],
      NOW,
    );

    expect(summary).toMatchObject({
      total: 6,
      taken: 1,
      late: 1,
      missed: 1,
      skipped: 1,
      overdue: 1,
      upcoming: 1,
    });
    // 2 consumed out of 2 consumed + 1 missed + 1 overdue; skipped and upcoming are excluded.
    expect(summary.adherence).toBe(0.5);
  });
});
