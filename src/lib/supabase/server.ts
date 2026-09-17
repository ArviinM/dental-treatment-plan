import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

import { env } from '@/lib/env';
import type { Database } from '@/lib/database.types';

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * Async because `cookies()` is. Note this shares the name `createClient` with
 * the browser version — import the one matching where the code runs.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // A Server Component cannot set cookies. That is expected and safe to
          // swallow: src/proxy.ts refreshes the session on every request, so a
          // rotated token is still persisted.
        }
      },
    },
  });
}
