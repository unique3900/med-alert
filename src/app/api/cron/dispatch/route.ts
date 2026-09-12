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
    return NextResponse.json({ error: 'dispatch failed' }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
