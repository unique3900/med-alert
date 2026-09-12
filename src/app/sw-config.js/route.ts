import { NextResponse } from 'next/server';
import { publicEnv } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The service worker imports this instead of taking its config from a query
 * string. That keeps the worker's URL constant, so changing configuration never
 * replaces the registration and orphans its push subscription.
 */
export async function GET() {
  const body = `self.__FIREBASE_CONFIG__ = ${JSON.stringify(publicEnv.firebase)};`;

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
