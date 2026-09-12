/**
 * A dose keeps alerting until somebody resolves it. The cadence backs off as it
 * ages so a forgotten dose stays loud for the first half hour without buzzing
 * every two minutes for the rest of the day.
 */
export const ALERT_LADDER = [
  { untilMinutesOverdue: 30, everyMinutes: 2 },
  { untilMinutesOverdue: 120, everyMinutes: 5 },
  { untilMinutesOverdue: 360, everyMinutes: 15 },
  { untilMinutesOverdue: Infinity, everyMinutes: 30 },
] as const;

export const ALERT_POLICY = {
  /** How far ahead dose rows are created. */
  horizonMinutes: 120,
  /** A dose is alerted no earlier than this many seconds before it is due. */
  leadSeconds: 30,
  /**
   * Absolute backstop. A dose is normally closed by the next dose of the same
   * medication falling due; this only catches medications taken less often than
   * every two days.
   */
  stopAfterHours: 48,
  /** A dose taken this long after it was due is recorded as taken late. */
  lateAfterMinutes: 15,
} as const;

export function alertIntervalMinutes(minutesOverdue: number) {
  const step = ALERT_LADDER.find((entry) => minutesOverdue < entry.untilMinutesOverdue);
  return step?.everyMinutes ?? ALERT_LADDER[ALERT_LADDER.length - 1]!.everyMinutes;
}

export type AlertCandidate = {
  dueAt: string;
  lastAlertAt: string | null;
};

/** Whether this dose should ring on the current dispatcher pass. */
export function shouldAlert(dose: AlertCandidate, now: Date) {
  const due = Date.parse(dose.dueAt);
  if (now.getTime() + ALERT_POLICY.leadSeconds * 1000 < due) return false;
  if (!dose.lastAlertAt) return true;

  const minutesOverdue = Math.max(0, (now.getTime() - due) / 60_000);
  const sinceLast = (now.getTime() - Date.parse(dose.lastAlertAt)) / 60_000;

  return sinceLast >= alertIntervalMinutes(minutesOverdue);
}

export function isAbandoned(dose: { dueAt: string }, now: Date) {
  return now.getTime() - Date.parse(dose.dueAt) > ALERT_POLICY.stopAfterHours * 3_600_000;
}

export type Lateness = 'on-time' | 'late';

export function classifyTaken(dueAt: string, resolvedAt: string | null): { lateness: Lateness; minutesLate: number } {
  if (!resolvedAt) return { lateness: 'on-time', minutesLate: 0 };

  const minutesLate = Math.round((Date.parse(resolvedAt) - Date.parse(dueAt)) / 60_000);
  return {
    lateness: minutesLate > ALERT_POLICY.lateAfterMinutes ? 'late' : 'on-time',
    minutesLate: Math.max(0, minutesLate),
  };
}

/**
 * Of the open doses already due for one medication, only the most recent keeps
 * alerting — an 08:00 dose is not still owed once the 20:00 dose arrives.
 */
export function supersededIds<T extends { id: string; medicationId: string; dueAt: string }>(
  doses: T[],
  now: Date,
): string[] {
  const newestByMedication = new Map<string, T>();

  for (const dose of doses) {
    if (Date.parse(dose.dueAt) > now.getTime()) continue;
    const current = newestByMedication.get(dose.medicationId);
    if (!current || Date.parse(dose.dueAt) > Date.parse(current.dueAt)) {
      newestByMedication.set(dose.medicationId, dose);
    }
  }

  return doses
    .filter((dose) => {
      if (Date.parse(dose.dueAt) > now.getTime()) return false;
      const newest = newestByMedication.get(dose.medicationId);
      return newest !== undefined && newest.id !== dose.id;
    })
    .map((dose) => dose.id);
}
