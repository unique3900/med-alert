const FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string) {
  let cached = FORMATTERS.get(timeZone);
  if (!cached) {
    cached = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    FORMATTERS.set(timeZone, cached);
  }
  return cached;
}

export type CalendarParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function partsInZone(date: Date, timeZone: string): CalendarParts {
  const parts = formatter(timeZone).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  };
}

function offsetMs(date: Date, timeZone: string) {
  const p = partsInZone(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - date.getTime();
}

/** Wall-clock time in `timeZone` -> the matching UTC instant, DST-correct. */
export function zonedTimeToUtc(parts: Omit<CalendarParts, 'second'> & { second?: number }, timeZone: string): Date {
  const naive = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second ?? 0);
  const firstPass = naive - offsetMs(new Date(naive), timeZone);
  const secondPass = naive - offsetMs(new Date(firstPass), timeZone);
  return new Date(secondPass);
}

export function dayKeyInZone(date: Date, timeZone: string) {
  const { year, month, day } = partsInZone(date, timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function weekdayInZone(date: Date, timeZone: string) {
  const { year, month, day } = partsInZone(date, timeZone);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function startOfDayUtc(dayKey: string, timeZone: string) {
  const [year, month, day] = dayKey.split('-').map(Number);
  return zonedTimeToUtc({ year: year!, month: month!, day: day!, hour: 0, minute: 0 }, timeZone);
}

export function addDaysToKey(dayKey: string, days: number) {
  const [year, month, day] = dayKey.split('-').map(Number);
  const shifted = new Date(Date.UTC(year!, month! - 1, day! + days));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

/** "20:30" | "20:30:00" -> minutes from midnight. */
export function parseClock(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

export function formatClock(minutesFromMidnight: number) {
  const hour = Math.floor(minutesFromMidnight / 60) % 24;
  const minute = minutesFromMidnight % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function supportedTimeZone(value: string | null | undefined, fallback = 'UTC') {
  if (!value) return fallback;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return value;
  } catch {
    return fallback;
  }
}
