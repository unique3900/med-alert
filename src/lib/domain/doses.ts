import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Dose, DoseWithMedication } from '@/lib/db/types';
import { classifyTaken } from '@/lib/domain/alerting';
import { addDaysToKey, dayKeyInZone, startOfDayUtc } from '@/lib/time/zone';
import { addMonthsToKey } from '@/lib/time/calendar';

export const SNOOZE_MINUTES = 10;

export type DoseAction = 'taken' | 'skipped' | 'snooze';

/** What a dose ended up being, once lateness is folded into the raw status. */
export type DoseOutcome = 'upcoming' | 'overdue' | 'taken' | 'late' | 'skipped' | 'missed';

// doses points at profiles twice - profile_id and resolved_by - so the foreign
// key has to be named or PostgREST refuses the embed as ambiguous (PGRST201).
const DOSE_SELECT =
  '*, medications!inner(id, name, strength, form, instructions, accent), profiles!doses_profile_id_fkey!inner(id, full_name, accent)';

type OutcomeInput = Pick<Dose, 'status' | 'due_at' | 'resolved_at'>;

export function doseOutcome(dose: OutcomeInput, now = new Date()): DoseOutcome {
  switch (dose.status) {
    case 'taken':
      return classifyTaken(dose.due_at, dose.resolved_at).lateness === 'late' ? 'late' : 'taken';
    case 'skipped':
      return 'skipped';
    case 'missed':
      return 'missed';
    default:
      return Date.parse(dose.due_at) <= now.getTime() ? 'overdue' : 'upcoming';
  }
}

export function minutesLate(dose: OutcomeInput) {
  return dose.status === 'taken' ? classifyTaken(dose.due_at, dose.resolved_at).minutesLate : 0;
}

export type DoseSummary = {
  total: number;
  taken: number;
  late: number;
  skipped: number;
  missed: number;
  overdue: number;
  upcoming: number;
  /** Doses taken, on time or late, as a share of those that came due. */
  adherence: number | null;
};

export function summarize(doses: OutcomeInput[], now = new Date()): DoseSummary {
  const counts: Record<DoseOutcome, number> = {
    upcoming: 0,
    overdue: 0,
    taken: 0,
    late: 0,
    skipped: 0,
    missed: 0,
  };

  for (const dose of doses) counts[doseOutcome(dose, now)] += 1;

  const consumed = counts.taken + counts.late;
  const accountable = consumed + counts.missed + counts.overdue;

  return {
    total: doses.length,
    ...counts,
    adherence: accountable > 0 ? consumed / accountable : null,
  };
}

export async function resolveDose(
  supabase: SupabaseClient<Database>,
  doseId: string,
  action: DoseAction,
  actorId: string,
) {
  const now = new Date();

  if (action === 'snooze') {
    const { data: current, error: readError } = await supabase
      .from('doses')
      .select('due_at')
      .eq('id', doseId)
      .single();

    if (readError) throw readError;

    const base = Math.max(now.getTime(), Date.parse(current.due_at));
    const { data, error } = await supabase
      .from('doses')
      .update({
        due_at: new Date(base + SNOOZE_MINUTES * 60_000).toISOString(),
        status: 'pending',
        last_alert_at: null,
      })
      .eq('id', doseId)
      .select('id');

    if (error) throw error;
    assertChanged(data);
    return;
  }

  const { data, error } = await supabase
    .from('doses')
    .update({ status: action, resolved_at: now.toISOString(), resolved_by: actorId })
    .eq('id', doseId)
    .select('id');

  if (error) throw error;
  assertChanged(data);
}

/**
 * A row-level security policy that rejects the update does not raise - it just
 * matches nothing. Without this check the caller reports success and the dose
 * silently stays open, which is the worst possible failure for a medication
 * reminder.
 */
function assertChanged(rows: { id: string }[] | null) {
  if (!rows || rows.length === 0) {
    throw new Error('You can only change doses for yourself, unless you are the household admin.');
  }
}

async function dosesBetween(
  supabase: SupabaseClient<Database>,
  from: Date,
  to: Date,
  profileId?: string,
) {
  let query = supabase
    .from('doses')
    .select(DOSE_SELECT)
    .gte('due_at', from.toISOString())
    .lt('due_at', to.toISOString())
    .order('due_at', { ascending: true });

  if (profileId) query = query.eq('profile_id', profileId);

  const { data, error } = await query.returns<DoseWithMedication[]>();
  if (error) throw error;
  return data ?? [];
}

export async function dosesForDay(
  supabase: SupabaseClient<Database>,
  options: { timezone: string; reference?: Date; profileId?: string },
) {
  const dayKey = dayKeyInZone(options.reference ?? new Date(), options.timezone);

  return dosesBetween(
    supabase,
    startOfDayUtc(dayKey, options.timezone),
    startOfDayUtc(addDaysToKey(dayKey, 1), options.timezone),
    options.profileId,
  );
}

export async function dosesForMonth(
  supabase: SupabaseClient<Database>,
  options: { timezone: string; monthKey: string; profileId?: string },
) {
  return dosesBetween(
    supabase,
    startOfDayUtc(`${options.monthKey}-01`, options.timezone),
    startOfDayUtc(`${addMonthsToKey(options.monthKey, 1)}-01`, options.timezone),
    options.profileId,
  );
}

/**
 * Doses still owed from before today — forgotten ones keep alerting, so they
 * belong on the current screen rather than buried in last week's list.
 */
export async function outstandingBefore(
  supabase: SupabaseClient<Database>,
  options: { timezone: string; reference?: Date; profileId?: string },
) {
  const now = options.reference ?? new Date();
  const dayKey = dayKeyInZone(now, options.timezone);

  let query = supabase
    .from('doses')
    .select(DOSE_SELECT)
    .in('status', ['pending', 'notified'])
    .lt('due_at', startOfDayUtc(dayKey, options.timezone).toISOString())
    .order('due_at', { ascending: true })
    .limit(50);

  if (options.profileId) query = query.eq('profile_id', options.profileId);

  const { data, error } = await query.returns<DoseWithMedication[]>();
  if (error) throw error;
  return data ?? [];
}

export async function recentAdherence(
  supabase: SupabaseClient<Database>,
  options: { days: number; profileId?: string },
) {
  const since = new Date(Date.now() - options.days * 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from('doses')
    .select('status, due_at, resolved_at')
    .gte('due_at', since)
    .lt('due_at', new Date().toISOString());

  if (options.profileId) query = query.eq('profile_id', options.profileId);

  const { data, error } = await query.returns<OutcomeInput[]>();
  if (error) throw error;

  return summarize(data ?? []);
}
