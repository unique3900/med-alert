import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { serverEnv } from '@/lib/env';
import type { Database } from '@/lib/db/types';

/** Bypasses RLS. Only for the dispatcher and admin-guarded server actions. */
export function supabaseAdmin() {
  const { supabaseUrl, serviceRoleKey } = serverEnv();
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
