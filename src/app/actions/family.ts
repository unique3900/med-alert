'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { supabaseServer } from '@/lib/supabase/server';
import { requireAdmin, requireSession } from '@/lib/domain/session';
import { supportedTimeZone } from '@/lib/time/zone';

export type FamilyState = { error?: string; notice?: string; credentials?: { email: string; password: string } };

const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function temporaryPassword(length = 12) {
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('');
}

const memberSchema = z.object({
  email: z.email(),
  fullName: z.string().trim().min(1, 'Name is required').max(60),
  role: z.enum(['admin', 'member']),
  accent: z.string().trim().max(20).default('violet'),
});

export async function addMember(_state: FamilyState, formData: FormData): Promise<FamilyState> {
  const session = await requireAdmin();

  const parsed = memberSchema.safeParse({
    email: String(formData.get('email') ?? '').trim(),
    fullName: formData.get('fullName'),
    role: formData.get('role') ?? 'member',
    accent: formData.get('accent') ?? 'violet',
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };

  const password = temporaryPassword();
  const { error } = await supabaseAdmin().auth.admin.createUser({
    email: parsed.data.email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.data.fullName,
      household_id: session.household.id,
      role: parsed.data.role,
      accent: parsed.data.accent,
    },
  });

  if (error) return { error: error.message };

  revalidatePath('/family');
  return {
    notice: `${parsed.data.fullName} can sign in now. Share these details once — they are not stored.`,
    credentials: { email: parsed.data.email, password },
  };
}

const roleSchema = z.object({ profileId: z.uuid(), role: z.enum(['admin', 'member']) });

export async function setMemberRole(_state: FamilyState, formData: FormData): Promise<FamilyState> {
  const session = await requireAdmin();

  const parsed = roleSchema.safeParse({ profileId: formData.get('profileId'), role: formData.get('role') });
  if (!parsed.success) return { error: 'Unknown member.' };

  if (parsed.data.profileId === session.userId && parsed.data.role === 'member') {
    return { error: 'Promote someone else to admin before stepping down.' };
  }

  const { error } = await supabaseAdmin()
    .from('profiles')
    .update({ role: parsed.data.role })
    .eq('id', parsed.data.profileId)
    .eq('household_id', session.household.id);

  if (error) return { error: error.message };

  revalidatePath('/family');
  return { notice: 'Role updated.' };
}

const removeSchema = z.object({ profileId: z.uuid() });

export async function removeMember(_state: FamilyState, formData: FormData): Promise<FamilyState> {
  const session = await requireAdmin();

  const parsed = removeSchema.safeParse({ profileId: formData.get('profileId') });
  if (!parsed.success) return { error: 'Unknown member.' };
  if (parsed.data.profileId === session.userId) return { error: 'You cannot remove your own account.' };

  const admin = supabaseAdmin();
  const { data: target } = await admin
    .from('profiles')
    .select('id, household_id')
    .eq('id', parsed.data.profileId)
    .maybeSingle();

  if (!target || target.household_id !== session.household.id) return { error: 'Unknown member.' };

  const { error } = await admin.auth.admin.deleteUser(parsed.data.profileId);
  if (error) return { error: error.message };

  revalidatePath('/family');
  revalidatePath('/today');
  return { notice: 'Member removed.' };
}

const householdSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60),
  timezone: z.string().trim().min(1),
});

export async function updateHousehold(_state: FamilyState, formData: FormData): Promise<FamilyState> {
  const session = await requireAdmin();

  const parsed = householdSchema.safeParse({ name: formData.get('name'), timezone: formData.get('timezone') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };

  const timezone = supportedTimeZone(parsed.data.timezone, session.household.timezone);
  if (timezone !== parsed.data.timezone) return { error: 'That time zone is not recognised.' };

  const supabase = await supabaseServer();
  const { error } = await supabase
    .from('households')
    .update({ name: parsed.data.name, timezone })
    .eq('id', session.household.id);

  if (error) return { error: error.message };

  revalidatePath('/settings');
  revalidatePath('/today');
  return { notice: 'Household updated.' };
}

const profileSchema = z.object({
  fullName: z.string().trim().min(1, 'Name is required').max(60),
  accent: z.string().trim().max(20),
});

export async function updateOwnProfile(_state: FamilyState, formData: FormData): Promise<FamilyState> {
  const session = await requireSession();

  const parsed = profileSchema.safeParse({ fullName: formData.get('fullName'), accent: formData.get('accent') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };

  const supabase = await supabaseServer();
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: parsed.data.fullName, accent: parsed.data.accent })
    .eq('id', session.userId);

  if (error) return { error: error.message };

  revalidatePath('/settings');
  return { notice: 'Profile updated.' };
}

const passwordSchema = z
  .object({
    password: z.string().min(8, 'Use at least 8 characters'),
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, { message: 'Passwords do not match', path: ['confirm'] });

export async function changePassword(_state: FamilyState, formData: FormData): Promise<FamilyState> {
  await requireSession();

  const parsed = passwordSchema.safeParse({ password: formData.get('password'), confirm: formData.get('confirm') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };

  return { notice: 'Password changed.' };
}
