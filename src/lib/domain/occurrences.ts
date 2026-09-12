import type { Schedule } from '@/lib/db/types';
import {
  addDaysToKey,
  dayKeyInZone,
  parseClock,
  weekdayInZone,
  zonedTimeToUtc,
} from '@/lib/time/zone';

const MINUTES_IN_DAY = 24 * 60;

/** Local-clock minute offsets a schedule fires at on a single day. */
export function dailyOffsets(schedule: Pick<Schedule, 'kind' | 'times' | 'interval_minutes' | 'window_start' | 'window_end'>) {
  if (schedule.kind === 'fixed') {
    return [...new Set(schedule.times.map(parseClock))].sort((a, b) => a - b);
  }

  const step = schedule.interval_minutes ?? 0;
  if (step <= 0) return [];

  const start = parseClock(schedule.window_start);
  const rawEnd = parseClock(schedule.window_end);
  const end = rawEnd > start ? rawEnd : MINUTES_IN_DAY - 1;

  const offsets: number[] = [];
  for (let minute = start; minute <= end; minute += step) offsets.push(minute);
  return offsets;
}

function withinDateRange(dayKey: string, schedule: Pick<Schedule, 'starts_on' | 'ends_on'>) {
  if (dayKey < schedule.starts_on) return false;
  if (schedule.ends_on && dayKey > schedule.ends_on) return false;
  return true;
}

/**
 * Every instant this schedule fires inside [from, to), resolved against the
 * household's wall clock so DST shifts do not move a dose.
 */
export function occurrencesBetween(
  schedule: Pick<
    Schedule,
    'kind' | 'times' | 'interval_minutes' | 'window_start' | 'window_end' | 'days_of_week' | 'starts_on' | 'ends_on'
  >,
  timeZone: string,
  from: Date,
  to: Date,
): Date[] {
  const offsets = dailyOffsets(schedule);
  if (offsets.length === 0) return [];

  const days = new Set(schedule.days_of_week);
  const results: Date[] = [];

  let dayKey = addDaysToKey(dayKeyInZone(from, timeZone), -1);
  const lastKey = addDaysToKey(dayKeyInZone(to, timeZone), 1);

  while (dayKey <= lastKey) {
    if (withinDateRange(dayKey, schedule)) {
      const [year, month, day] = dayKey.split('-').map(Number);

      for (const offset of offsets) {
        const at = zonedTimeToUtc(
          { year: year!, month: month!, day: day!, hour: Math.floor(offset / 60), minute: offset % 60 },
          timeZone,
        );
        if (at < from || at >= to) continue;
        if (!days.has(weekdayInZone(at, timeZone))) continue;
        results.push(at);
      }
    }
    dayKey = addDaysToKey(dayKey, 1);
  }

  return results.sort((a, b) => a.getTime() - b.getTime());
}

export function nextOccurrence(
  schedule: Parameters<typeof occurrencesBetween>[0],
  timeZone: string,
  after: Date,
  horizonDays = 14,
): Date | null {
  const to = new Date(after.getTime() + horizonDays * 24 * 60 * 60 * 1000);
  return occurrencesBetween(schedule, timeZone, after, to)[0] ?? null;
}

export function describeSchedule(
  schedule: Pick<Schedule, 'kind' | 'times' | 'interval_minutes' | 'window_start' | 'window_end' | 'days_of_week'>,
) {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const everyDay = schedule.days_of_week.length === 7;
  const dayLabel = everyDay
    ? 'every day'
    : schedule.days_of_week
        .slice()
        .sort((a, b) => a - b)
        .map((day) => dayNames[day])
        .join(', ');

  if (schedule.kind === 'fixed') {
    const times = schedule.times.map((time) => time.slice(0, 5)).join(', ');
    return `${times} · ${dayLabel}`;
  }

  const minutes = schedule.interval_minutes ?? 0;
  const every = minutes % 60 === 0 ? `every ${minutes / 60}h` : `every ${minutes}m`;
  return `${every} · ${schedule.window_start.slice(0, 5)}–${schedule.window_end.slice(0, 5)} · ${dayLabel}`;
}
