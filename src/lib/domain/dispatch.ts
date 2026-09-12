import 'server-only';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendAlert } from '@/lib/push/admin';
import { occurrencesBetween } from '@/lib/domain/occurrences';
import { supportedTimeZone } from '@/lib/time/zone';
import type { Dose, Medication, Profile, Schedule } from '@/lib/db/types';

export const ALERT_POLICY = {
  /** How far ahead dose rows are created. */
  horizonMinutes: 120,
  /** A dose is alerted no earlier than this many seconds before it is due. */
  leadSeconds: 30,
  /** Re-alert cadence while a dose stays unresolved. */
  repeatMinutes: 2,
  /** Stop after this many alerts for one dose. */
  maxAlerts: 10,
  /** Unresolved this long past due becomes a missed dose. */
  graceMinutes: 45,
} as const;

type Db = ReturnType<typeof supabaseAdmin>;

type ScheduleContext = Schedule & {
  medications: Pick<Medication, 'id' | 'household_id' | 'profile_id' | 'name'> & {
    households: { id: string; timezone: string };
  };
};

type DueDose = Pick<Dose, 'id' | 'profile_id' | 'due_at' | 'alert_count'> & {
  medications: Pick<Medication, 'name' | 'strength' | 'form'>;
  profiles: Pick<Profile, 'full_name'>;
};

export type DispatchSummary = {
  materialized: number;
  missed: number;
  alerted: number;
  delivered: number;
};

export async function runDispatch(now = new Date()): Promise<DispatchSummary> {
  const db = supabaseAdmin();

  const materialized = await materializeDoses(db, now);
  const missed = await expireOverdueDoses(db, now);
  const { alerted, delivered } = await alertDueDoses(db, now);

  return { materialized, missed, alerted, delivered };
}

const SCHEDULE_SELECT =
  'id, medication_id, kind, times, interval_minutes, window_start, window_end, days_of_week, starts_on, ends_on, is_active, created_at, updated_at, medications!inner(id, household_id, profile_id, name, households!inner(id, timezone))';

async function materializeDoses(db: Db, now: Date) {
  const { data, error } = await db
    .from('schedules')
    .select(SCHEDULE_SELECT)
    .eq('is_active', true)
    .eq('medications.is_active', true)
    .returns<ScheduleContext[]>();

  if (error) throw error;

  const from = new Date(now.getTime() - 5 * 60_000);
  const to = new Date(now.getTime() + ALERT_POLICY.horizonMinutes * 60_000);

  const rows = (data ?? []).flatMap((schedule) => {
    const timezone = supportedTimeZone(schedule.medications.households.timezone);
    return occurrencesBetween(schedule, timezone, from, to).map((at) => ({
      household_id: schedule.medications.household_id,
      profile_id: schedule.medications.profile_id,
      medication_id: schedule.medications.id,
      schedule_id: schedule.id,
      origin_at: at.toISOString(),
      due_at: at.toISOString(),
    }));
  });

  if (rows.length === 0) return 0;

  const { error: upsertError } = await db
    .from('doses')
    .upsert(rows, { onConflict: 'schedule_id,origin_at', ignoreDuplicates: true });

  if (upsertError) throw upsertError;
  return rows.length;
}

async function expireOverdueDoses(db: Db, now: Date) {
  const cutoff = new Date(now.getTime() - ALERT_POLICY.graceMinutes * 60_000).toISOString();

  const { data, error } = await db
    .from('doses')
    .update({ status: 'missed', resolved_at: now.toISOString() })
    .in('status', ['pending', 'notified'])
    .lt('due_at', cutoff)
    .select('id');

  if (error) throw error;
  return data?.length ?? 0;
}

async function alertDueDoses(db: Db, now: Date) {
  const dueBefore = new Date(now.getTime() + ALERT_POLICY.leadSeconds * 1000).toISOString();
  const retryBefore = new Date(now.getTime() - ALERT_POLICY.repeatMinutes * 60_000).toISOString();

  const { data, error } = await db
    .from('doses')
    .select('id, profile_id, due_at, alert_count, medications!inner(name, strength, form), profiles!inner(full_name)')
    .in('status', ['pending', 'notified'])
    .lte('due_at', dueBefore)
    .lt('alert_count', ALERT_POLICY.maxAlerts)
    .or('last_alert_at.is.null,last_alert_at.lte.' + retryBefore)
    .order('due_at', { ascending: true })
    .limit(200)
    .returns<DueDose[]>();

  if (error) throw error;

  const doses = data ?? [];
  if (doses.length === 0) return { alerted: 0, delivered: 0 };

  const tokensByProfile = await loadDeviceTokens(db, [...new Set(doses.map((dose) => dose.profile_id))]);

  let delivered = 0;
  const staleTokens = new Set<string>();

  for (const dose of doses) {
    const tokens = tokensByProfile.get(dose.profile_id) ?? [];
    const attempt = dose.alert_count + 1;

    if (tokens.length > 0) {
      const result = await sendAlert(tokens, {
        doseId: dose.id,
        medication: dose.medications.name,
        detail: doseDetail(dose),
        person: dose.profiles.full_name,
        dueAt: dose.due_at,
        attempt,
      });
      delivered += result.delivered;
      result.staleTokens.forEach((token) => staleTokens.add(token));
    }

    const { error: updateError } = await db
      .from('doses')
      .update({ status: 'notified', alert_count: attempt, last_alert_at: now.toISOString() })
      .eq('id', dose.id);

    if (updateError) throw updateError;
  }

  if (staleTokens.size > 0) {
    await db
      .from('devices')
      .update({ revoked_at: now.toISOString() })
      .in('token', [...staleTokens]);
  }

  return { alerted: doses.length, delivered };
}

async function loadDeviceTokens(db: Db, profileIds: string[]) {
  const { data, error } = await db
    .from('devices')
    .select('profile_id, token')
    .is('revoked_at', null)
    .in('profile_id', profileIds);

  if (error) throw error;

  const map = new Map<string, string[]>();
  for (const device of data ?? []) {
    const list = map.get(device.profile_id) ?? [];
    list.push(device.token);
    map.set(device.profile_id, list);
  }
  return map;
}

function doseDetail(dose: DueDose) {
  const parts = [dose.medications.strength, dose.medications.form].filter(Boolean);
  return parts.length > 0 ? `${dose.profiles.full_name} · ${parts.join(' ')}` : dose.profiles.full_name;
}
