import { dayKeyInZone } from '@/lib/time/zone';

/** Calendar maths on `YYYY-MM` / `YYYY-MM-DD` keys, which are already local to the household. */

export function monthKeyInZone(date: Date, timeZone: string) {
  return dayKeyInZone(date, timeZone).slice(0, 7);
}

export function isMonthKey(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function parseMonth(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  return { year: year!, month: month! };
}

export function addMonthsToKey(monthKey: string, offset: number) {
  const { year, month } = parseMonth(monthKey);
  const shifted = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function daysInMonth(monthKey: string) {
  const { year, month } = parseMonth(monthKey);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthDayKeys(monthKey: string) {
  return Array.from(
    { length: daysInMonth(monthKey) },
    (_, index) => `${monthKey}-${String(index + 1).padStart(2, '0')}`,
  );
}

export function weekdayOfDayKey(dayKey: string) {
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay();
}

export function formatMonthLabel(monthKey: string) {
  const { year, month } = parseMonth(monthKey);
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

export function formatDayLabel(dayKey: string) {
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year!, month! - 1, day!)));
}
