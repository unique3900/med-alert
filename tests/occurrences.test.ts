import { describe, expect, it } from 'vitest';
import { describeSchedule, nextOccurrence, occurrencesBetween } from '@/lib/domain/occurrences';
import { dayKeyInZone, zonedTimeToUtc } from '@/lib/time/zone';
import type { Schedule } from '@/lib/db/types';

type ScheduleShape = Parameters<typeof occurrencesBetween>[0];

function schedule(overrides: Partial<Schedule> = {}): ScheduleShape {
  return {
    kind: 'fixed',
    times: ['20:00'],
    interval_minutes: null,
    window_start: '08:00',
    window_end: '22:00',
    days_of_week: [0, 1, 2, 3, 4, 5, 6],
    starts_on: '2026-01-01',
    ends_on: null,
    ...overrides,
  } as ScheduleShape;
}

const KATHMANDU = 'Asia/Kathmandu';
const LONDON = 'Europe/London';

describe('fixed schedules', () => {
  it('fires once a day at the local wall-clock time', () => {
    const from = new Date('2026-03-02T00:00:00Z');
    const to = new Date('2026-03-05T00:00:00Z');

    const hits = occurrencesBetween(schedule({ times: ['20:00'] }), KATHMANDU, from, to);

    expect(hits).toHaveLength(3);
    // Kathmandu is UTC+5:45, so 20:00 local is 14:15 UTC.
    expect(hits[0]!.toISOString()).toBe('2026-03-02T14:15:00.000Z');
  });

  it('supports several times a day and keeps them ordered', () => {
    const from = new Date('2026-03-02T00:00:00Z');
    const to = new Date('2026-03-03T00:00:00Z');

    const hits = occurrencesBetween(schedule({ times: ['08:00', '20:30', '13:00'] }), LONDON, from, to);

    expect(hits.map((hit) => hit.toISOString())).toEqual([
      '2026-03-02T08:00:00.000Z',
      '2026-03-02T13:00:00.000Z',
      '2026-03-02T20:30:00.000Z',
    ]);
  });

  it('honours the weekday filter', () => {
    const from = new Date('2026-03-02T00:00:00Z'); // Monday
    const to = new Date('2026-03-09T00:00:00Z');

    const hits = occurrencesBetween(schedule({ days_of_week: [1, 4] }), LONDON, from, to);

    expect(hits).toHaveLength(2);
    expect(hits.map((hit) => hit.getUTCDay())).toEqual([1, 4]);
  });

  it('respects the start and end dates', () => {
    const from = new Date('2026-03-01T00:00:00Z');
    const to = new Date('2026-03-10T00:00:00Z');

    const hits = occurrencesBetween(
      schedule({ starts_on: '2026-03-03', ends_on: '2026-03-05' }),
      LONDON,
      from,
      to,
    );

    expect(hits).toHaveLength(3);
  });

  it('keeps the local hour across a DST change', () => {
    // London springs forward on 2026-03-29.
    const from = new Date('2026-03-27T00:00:00Z');
    const to = new Date('2026-03-31T00:00:00Z');

    const hits = occurrencesBetween(schedule({ times: ['20:00'] }), LONDON, from, to);
    const localHours = hits.map((hit) =>
      Number(
        new Intl.DateTimeFormat('en-GB', { timeZone: LONDON, hour: '2-digit', hour12: false }).format(hit),
      ),
    );

    expect(hits).toHaveLength(4);
    expect(new Set(localHours)).toEqual(new Set([20]));
    expect(hits[0]!.toISOString()).toBe('2026-03-27T20:00:00.000Z');
    expect(hits.at(-1)!.toISOString()).toBe('2026-03-30T19:00:00.000Z');
  });
});

describe('interval schedules', () => {
  it('steps through the daily window', () => {
    const from = new Date('2026-03-02T00:00:00Z');
    const to = new Date('2026-03-03T00:00:00Z');

    const hits = occurrencesBetween(
      schedule({ kind: 'interval', times: [], interval_minutes: 360, window_start: '08:00', window_end: '22:00' }),
      LONDON,
      from,
      to,
    );

    expect(hits.map((hit) => hit.toISOString())).toEqual([
      '2026-03-02T08:00:00.000Z',
      '2026-03-02T14:00:00.000Z',
      '2026-03-02T20:00:00.000Z',
    ]);
  });

  it('never fires past the end of the window', () => {
    const from = new Date('2026-03-02T00:00:00Z');
    const to = new Date('2026-03-03T00:00:00Z');

    const hits = occurrencesBetween(
      schedule({ kind: 'interval', times: [], interval_minutes: 240, window_start: '09:00', window_end: '18:00' }),
      LONDON,
      from,
      to,
    );

    expect(hits.at(-1)!.toISOString()).toBe('2026-03-02T17:00:00.000Z');
  });
});

describe('boundaries', () => {
  it('excludes the upper bound so repeated dispatch windows never double-fire', () => {
    const at = zonedTimeToUtc({ year: 2026, month: 3, day: 2, hour: 20, minute: 0 }, LONDON);

    const inclusive = occurrencesBetween(schedule(), LONDON, at, new Date(at.getTime() + 1));
    const exclusive = occurrencesBetween(schedule(), LONDON, new Date(at.getTime() + 1), new Date(at.getTime() + 2));

    expect(inclusive).toHaveLength(1);
    expect(exclusive).toHaveLength(0);
  });

  it('finds the next occurrence after a moment', () => {
    const after = new Date('2026-03-02T15:00:00Z');
    const next = nextOccurrence(schedule({ times: ['20:00'] }), LONDON, after);

    expect(next?.toISOString()).toBe('2026-03-02T20:00:00.000Z');
  });

  it('returns null when the course has ended', () => {
    const after = new Date('2026-03-02T15:00:00Z');
    const next = nextOccurrence(schedule({ ends_on: '2026-03-01' }), LONDON, after);

    expect(next).toBeNull();
  });
});

describe('helpers', () => {
  it('describes a fixed schedule', () => {
    expect(describeSchedule(schedule({ times: ['08:00:00', '20:30:00'] }))).toBe('08:00, 20:30 · every day');
  });

  it('describes an interval schedule', () => {
    expect(
      describeSchedule(
        schedule({ kind: 'interval', times: [], interval_minutes: 360, days_of_week: [1, 3] }),
      ),
    ).toBe('every 6h · 08:00–22:00 · Mon, Wed');
  });

  it('reads the local calendar day', () => {
    expect(dayKeyInZone(new Date('2026-03-02T19:00:00Z'), KATHMANDU)).toBe('2026-03-03');
  });
});
