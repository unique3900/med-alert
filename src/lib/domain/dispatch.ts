import 'server-only';

import { firebaseAdminEnv } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendAlert } from '@/lib/push/admin';
import { occurrencesBetween } from '@/lib/domain/occurrences';
import { ALERT_POLICY, isAbandoned, shouldAlert, supersededIds } from '@/lib/domain/alerting';
import { supportedTimeZone } from '@/lib/time/zone';
import type { Dose, Medication, Profile, Schedule } from '@/lib/db/types';

type Db = ReturnType<typeof supabaseAdmin>;

type ScheduleContext = Schedule & {
  medications: Pick<Medication, 'id' | 'household_id' | 'profile_id' | 'name'> & {
    households: { id: string; timezone: string };
  };
};

type OpenDose = Pick<
  Dose,
  'id' | 'household_id' | 'profile_id' | 'medication_id' | 'due_at' | 'alert_count' | 'last_alert_at'
> & {
  medications: Pick<Medication, 'name' | 'strength' | 'form'>;
  profiles: Pick<Profile, 'full_name'>;
};

export type DispatchSummary = {
  materialized: number;
  superseded: number;
  abandoned: number;
  alerted: number;
  delivered: number;
};

export async function runDispatch(now = new Date()): Promise<DispatchSummary> {
  // Check the push credentials on every run, not only when something is due.
  // Otherwise a deployment missing them answers 200 all day and only fails at
  // the exact moment a dose needs to ring.
  firebaseAdminEnv();

  const db = supabaseAdmin();

  const materialized = await materializeDoses(db, now);
  const open = await loadOpenDoses(db, now);
  const { superseded, abandoned, remaining } = await closeStaleDoses(db, open, now);
  const { alerted, delivered } = await alertDueDoses(db, remaining, now);

  return { materialized, superseded, abandoned, alerted, delivered };
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

/**
 * Every dose that is due and still unresolved, however old. The alerting rules
 * are applied in memory because the retry interval depends on how overdue each
 * dose is, which PostgREST cannot express in one filter.
 */
async function loadOpenDoses(db: Db, now: Date) {
  const dueBefore = new Date(now.getTime() + ALERT_POLICY.leadSeconds * 1000).toISOString();

  const { data, error } = await db
    .from('doses')
    .select(
      'id, household_id, profile_id, medication_id, due_at, alert_count, last_alert_at, medications!inner(name, strength, form), profiles!doses_profile_id_fkey!inner(full_name)',
    )
    .in('status', ['pending', 'notified'])
    .lte('due_at', dueBefore)
    .order('due_at', { ascending: true })
    .limit(1000)
    .returns<OpenDose[]>();

  if (error) throw error;
  return data ?? [];
}

async function closeStaleDoses(db: Db, open: OpenDose[], now: Date) {
  const shape = open.map((dose) => ({ id: dose.id, medicationId: dose.medication_id, dueAt: dose.due_at }));

  const superseded = new Set(supersededIds(shape, now));
  const abandoned = new Set(
    shape.filter((dose) => !superseded.has(dose.id) && isAbandoned(dose, now)).map((dose) => dose.id),
  );

  const closing = [...superseded, ...abandoned];
  if (closing.length > 0) {
    const { error } = await db
      .from('doses')
      .update({ status: 'missed', resolved_at: now.toISOString() })
      .in('id', closing);

    if (error) throw error;
  }

  return {
    superseded: superseded.size,
    abandoned: abandoned.size,
    remaining: open.filter((dose) => !superseded.has(dose.id) && !abandoned.has(dose.id)),
  };
}

async function alertDueDoses(db: Db, open: OpenDose[], now: Date) {
  const due = open.filter((dose) => shouldAlert({ dueAt: dose.due_at, lastAlertAt: dose.last_alert_at }, now));
  if (due.length === 0) return { alerted: 0, delivered: 0 };

  const caregiversByHousehold = await loadCaregivers(db, [...new Set(due.map((dose) => dose.household_id))]);
  const everyone = new Set(due.map((dose) => dose.profile_id));
  caregiversByHousehold.forEach((ids) => ids.forEach((id) => everyone.add(id)));
  const tokensByProfile = await loadDeviceTokens(db, [...everyone]);

  let delivered = 0;
  const staleTokens = new Set<string>();

  for (const dose of due) {
    // The person the dose is for, plus whoever actually administers it.
    const recipients = new Set([dose.profile_id, ...(caregiversByHousehold.get(dose.household_id) ?? [])]);
    const tokens = [...new Set([...recipients].flatMap((id) => tokensByProfile.get(id) ?? []))];
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

    const { error } = await db
      .from('doses')
      .update({ status: 'notified', alert_count: attempt, last_alert_at: now.toISOString() })
      .eq('id', dose.id);

    if (error) throw error;
  }

  if (staleTokens.size > 0) {
    await db
      .from('devices')
      .update({ revoked_at: now.toISOString() })
      .in('token', [...staleTokens]);
  }

  return { alerted: due.length, delivered };
}

async function loadCaregivers(db: Db, householdIds: string[]) {
  const { data, error } = await db
    .from('profiles')
    .select('id, household_id')
    .eq('receives_all_alerts', true)
    .in('household_id', householdIds);

  if (error) throw error;

  const map = new Map<string, string[]>();
  for (const profile of data ?? []) {
    map.set(profile.household_id, [...(map.get(profile.household_id) ?? []), profile.id]);
  }
  return map;
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

/** The person is in the title, because the alert also reaches their caregiver. */
function doseDetail(dose: OpenDose) {
  const parts = [dose.medications.strength, dose.medications.form].filter(Boolean);
  const what = parts.length > 0 ? parts.join(' ') : 'Scheduled dose';
  const overdueMinutes = Math.round((Date.now() - Date.parse(dose.due_at)) / 60_000);

  return overdueMinutes > ALERT_POLICY.lateAfterMinutes
    ? `${what} · ${overdueLabel(overdueMinutes)} overdue`
    : what;
}

function overdueLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} h` : `${Math.floor(hours / 24)} d`;
}
