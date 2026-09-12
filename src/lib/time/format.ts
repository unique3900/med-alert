const cache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string, options: Intl.DateTimeFormatOptions) {
  const key = `${timeZone}:${JSON.stringify(options)}`;
  let found = cache.get(key);
  if (!found) {
    found = new Intl.DateTimeFormat('en-GB', { ...options, timeZone });
    cache.set(key, found);
  }
  return found;
}

export function formatTime(value: string | Date, timeZone: string) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return formatter(timeZone, { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}

export function formatDayLong(value: string | Date, timeZone: string) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return formatter(timeZone, { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
}

export function formatDateShort(value: string | Date, timeZone: string) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return formatter(timeZone, { day: 'numeric', month: 'short' }).format(date);
}

export function relativeMinutes(target: Date, from = new Date()) {
  return Math.round((target.getTime() - from.getTime()) / 60_000);
}

export function humanizeMinutes(minutes: number) {
  const absolute = Math.abs(minutes);
  if (absolute < 1) return 'now';
  if (absolute < 60) return `${absolute} min`;

  const hours = Math.floor(absolute / 60);
  const rest = absolute % 60;
  if (hours < 24) return rest ? `${hours} h ${rest} min` : `${hours} h`;

  const days = Math.floor(hours / 24);
  return `${days} d`;
}
