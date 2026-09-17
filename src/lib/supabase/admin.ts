import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import { env, serviceRoleKey } from '@/lib/env';
import type { Database } from '@/lib/database.types';

/**
 * Service-role client. Bypasses row level security completely — it can read and
 * write every patient record in the database.
 *
 * Only for privileged work the publishable key genuinely cannot do: creating
 * accounts on an admin's behalf, resetting passwords, and reading private
 * storage. EVERY CALLER MUST CHECK THE CALLER'S OWN ROLE FIRST. This client will
 * happily do whatever it is asked.
 *
 * `server-only` makes importing this from a client component a build error
 * rather than a leaked key.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(env.supabaseUrl, serviceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
