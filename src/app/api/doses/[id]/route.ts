import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';
import { resolveDose } from '@/lib/domain/doses';

export const runtime = 'nodejs';

const bodySchema = z.object({ action: z.enum(['taken', 'skipped', 'snooze']) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid action' }, { status: 400 });

  const { id } = await params;

  try {
    await resolveDose(supabase, id, parsed.data.action, user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'could not update dose';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
