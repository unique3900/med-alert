'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';
import { requireSession } from '@/lib/domain/session';

export type ActionState = { error?: string };

const CLOCK = /^\d{2}:\d{2}(:\d{2})?$/;

const schema = z
  .object({
    id: z.uuid().optional(),
    profileId: z.uuid(),
    name: z.string().trim().min(1, 'Name is required').max(80),
    strength: z.string().trim().max(40).optional(),
    form: z.string().trim().max(40).optional(),
    instructions: z.string().trim().max(300).optional(),
    accent: z.string().trim().max(20).default('violet'),
    isActive: z.boolean().default(true),
    kind: z.enum(['fixed', 'interval']),
    times: z.array(z.string().regex(CLOCK)).default([]),
    intervalMinutes: z.coerce.number().int().min(15).max(1440).optional(),
    windowStart: z.string().regex(CLOCK).default('08:00'),
    windowEnd: z.string().regex(CLOCK).default('22:00'),
    daysOfWeek: z.array(z.coerce.number().int().min(0).max(6)).min(1, 'Pick at least one day'),
    startsOn: z.iso.date(),
    endsOn: z.iso.date().optional(),
  })
  .refine((value) => value.kind !== 'fixed' || value.times.length > 0, {
    message: 'Add at least one time',
    path: ['times'],
  })
  .refine((value) => value.kind !== 'interval' || Boolean(value.intervalMinutes), {
    message: 'Choose how often the dose repeats',
    path: ['intervalMinutes'],
  })
  .refine((value) => value.kind !== 'interval' || value.windowEnd > value.windowStart, {
    message: 'The daily window must end after it starts',
    path: ['windowEnd'],
  });

function readForm(formData: FormData) {
  const optional = (key: string) => {
    const value = String(formData.get(key) ?? '').trim();
    return value === '' ? undefined : value;
  };

  return schema.safeParse({
    id: optional('id'),
    profileId: formData.get('profileId'),
    name: formData.get('name'),
    strength: optional('strength'),
    form: optional('form'),
    instructions: optional('instructions'),
    accent: formData.get('accent') ?? 'violet',
    isActive: formData.get('isActive') === 'on',
    kind: formData.get('kind'),
    times: String(formData.get('times') ?? '')
      .split(',')
      .map((time) => time.trim())
      .filter(Boolean),
    intervalMinutes: optional('intervalMinutes'),
    windowStart: formData.get('windowStart') || '08:00',
    windowEnd: formData.get('windowEnd') || '22:00',
    daysOfWeek: formData.getAll('daysOfWeek'),
    startsOn: formData.get('startsOn'),
    endsOn: optional('endsOn'),
  });
}

export async function saveMedication(_state: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const parsed = readForm(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  }

  const input = parsed.data;
  if (!session.isAdmin && input.profileId !== session.userId) {
    return { error: 'You can only manage your own medications.' };
  }

  const supabase = await supabaseServer();

  const medication = {
    household_id: session.household.id,
    profile_id: input.profileId,
    name: input.name,
    strength: input.strength ?? null,
    form: input.form ?? null,
    instructions: input.instructions ?? null,
    accent: input.accent,
    is_active: input.isActive,
  };

  const { data: saved, error: medicationError } = input.id
    ? await supabase.from('medications').update(medication).eq('id', input.id).select('id').single()
    : await supabase.from('medications').insert(medication).select('id').single();

  if (medicationError || !saved) {
    return { error: medicationError?.message ?? 'Could not save the medication.' };
  }

  const schedule = {
    medication_id: saved.id,
    kind: input.kind,
    times: input.kind === 'fixed' ? input.times : [],
    interval_minutes: input.kind === 'interval' ? (input.intervalMinutes ?? null) : null,
    window_start: input.windowStart,
    window_end: input.windowEnd,
    days_of_week: [...new Set(input.daysOfWeek)].sort((a, b) => a - b),
    starts_on: input.startsOn,
    ends_on: input.endsOn ?? null,
    is_active: input.isActive,
  };

  const { data: existing } = await supabase
    .from('schedules')
    .select('id')
    .eq('medication_id', saved.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const { error: scheduleError } = existing
    ? await supabase.from('schedules').update(schedule).eq('id', existing.id)
    : await supabase.from('schedules').insert(schedule);

  if (scheduleError) return { error: scheduleError.message };

  revalidatePath('/meds');
  revalidatePath('/today');
  redirect('/meds');
}

const deleteSchema = z.object({ id: z.uuid() });

export async function deleteMedication(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const parsed = deleteSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return { error: 'Unknown medication.' };

  const supabase = await supabaseServer();
  const { error } = await supabase.from('medications').delete().eq('id', parsed.data.id);
  if (error) return { error: error.message };

  revalidatePath('/meds');
  revalidatePath('/today');
  redirect('/meds');
}
