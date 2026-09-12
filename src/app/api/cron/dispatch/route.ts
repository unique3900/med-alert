import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { runDispatch } from '@/lib/domain/dispatch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function presentedSecret(request: NextRequest) {
  const header = request.headers.get('x-cron-secret');
  if (header) return header;

  const authorization = request.headers.get('authorization');
  return authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
}

function authorized(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const presented = presentedSecret(request);
  if (!expected || !presented) return false;

  const a = Buffer.from(expected);
  const b = Buffer.from(presented);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const summary = await runDispatch();
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error('dispatch failed', error);

    // The caller already proved it holds CRON_SECRET, so the real reason is safe
    // to return. Without it a misconfigured deployment fails silently every
    // minute with nothing but a 500 to go on.
    return NextResponse.json(
      { error: 'dispatch failed', reason: describe(error), env: missingServerEnv() },
      { status: 500 },
    );
  }
}

/** Supabase rejects with a plain object, not an Error, so String() loses everything. */
function describe(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const { message, code, details, hint } = error as Record<string, unknown>;
    if (message ?? code) return { message, code, details, hint };
    return JSON.stringify(error);
  }
  return String(error);
}

function missingServerEnv() {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY',
  ];
  const missing = required.filter((name) => !process.env[name]);
  return missing.length > 0 ? { missing } : 'all present';
}

export const GET = handle;
export const POST = handle;
