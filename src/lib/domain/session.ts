import 'server-only';

import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { supportedTimeZone } from '@/lib/time/zone';
import type { Household, Profile } from '@/lib/db/types';

export type Session = {
  userId: string;
  email: string | null;
  profile: Profile;
  household: Household;
  timezone: string;
  isAdmin: boolean;
};

export async function getSession(): Promise<Session | null> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('*, households!inner(*)')
    .eq('id', user.id)
    .maybeSingle<Profile & { households: Household }>();

  if (!data) return null;

  const { households: household, ...profile } = data;

  return {
    userId: user.id,
    email: user.email ?? null,
    profile,
    household,
    timezone: supportedTimeZone(household.timezone),
    isAdmin: profile.role === 'admin',
  };
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  if (!session.isAdmin) redirect('/today');
  return session;
}
