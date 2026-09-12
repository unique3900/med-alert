import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, DoseWithMedication } from '@/lib/db/types';
import { addDaysToKey, dayKeyInZone, startOfDayUtc } from '@/lib/time/zone';

export const SNOOZE_MINUTES = 10;

export type DoseAction = 'taken' | 'skipped' | 'snooze';

const DOSE_SELECT =
  '*, medications!inner(id, name, strength, form, instructions, accent), profiles!inner(id, full_name, accent)';

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
    const { error } = await supabase
      .from('doses')
      .update({
        due_at: new Date(base + SNOOZE_MINUTES * 60_000).toISOString(),
        status: 'pending',
        alert_count: 0,
        last_alert_at: null,
      })
      .eq('id', doseId);

    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from('doses')
    .update({ status: action, resolved_at: now.toISOString(), resolved_by: actorId })
    .eq('id', doseId);

  if (error) throw error;
}

export async function dosesForDay(
  supabase: SupabaseClient<Database>,
  options: { timezone: string; reference?: Date; profileId?: string },
) {
  const reference = options.reference ?? new Date();
  const dayKey = dayKeyInZone(reference, options.timezone);
  const from = startOfDayUtc(dayKey, options.timezone);
  const to = startOfDayUtc(addDaysToKey(dayKey, 1), options.timezone);

  let query = supabase
    .from('doses')
    .select(DOSE_SELECT)
    .gte('due_at', from.toISOString())
    .lt('due_at', to.toISOString())
    .order('due_at', { ascending: true });

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

  let query = supabase.from('doses').select('status').gte('due_at', since).lt('due_at', new Date().toISOString());
  if (options.profileId) query = query.eq('profile_id', options.profileId);

  const { data, error } = await query.returns<{ status: string }[]>();
  if (error) throw error;

  const rows = data ?? [];
  const taken = rows.filter((row) => row.status === 'taken').length;
  const missed = rows.filter((row) => row.status === 'missed').length;

  return { total: rows.length, taken, missed, rate: rows.length ? taken / rows.length : null };
}
