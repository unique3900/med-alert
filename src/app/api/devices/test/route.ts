import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { sendAlert } from '@/lib/push/admin';

export const runtime = 'nodejs';

/**
 * Fires a real alert through the real delivery path, on demand. Waiting for a
 * scheduled dose to prove the alarm works is unreliable — somebody marks it
 * taken first, and then it is impossible to tell a broken pipeline from a
 * closed dose.
 */
export async function POST() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: devices, error } = await supabase
    .from('devices')
    .select('token')
    .is('revoked_at', null)
    .eq('profile_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const tokens = (devices ?? []).map((device) => device.token);
  if (tokens.length === 0) {
    return NextResponse.json({ error: 'No phone is armed for this account yet.' }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();

  try {
    const result = await sendAlert(tokens, {
      doseId: 'test',
      medication: 'Test alarm',
      detail: 'Your phone is set up correctly.',
      person: profile?.full_name ?? 'you',
      dueAt: new Date().toISOString(),
      attempt: 1,
      test: true,
    });

    return NextResponse.json({
      ok: true,
      devices: tokens.length,
      delivered: result.delivered,
      stale: result.staleTokens.length,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Could not send the test alarm.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
