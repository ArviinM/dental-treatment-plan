import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

import { env } from '@/lib/env';
import type { Database } from '@/lib/database.types';

/**
 * Refreshes the Supabase session on every request, and turns signed-out
 * visitors away from the app.
 *
 * This is the FIRST gate, never the only one. Roles are re-checked in the
 * layouts and enforced again by row level security in the database. Proxy code
 * runs before rendering and can be deployed to the edge, so it is kept to
 * "signed in or not" — anything role-shaped belongs closer to the data.
 */

/** Paths reachable without a session. Matched exactly, not by prefix. */
const PUBLIC_PATHS = new Set(['/login', '/auth/callback']);

/** Where a signed-in user gets bounced to if they visit a public path. */
const HOME = '/';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Write to the request first so anything downstream in this same pass
        // sees the refreshed token, then rebuild the response around it.
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        response = NextResponse.next({ request });

        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser(), never getSession(): getUser revalidates the token with Supabase,
  // while getSession trusts whatever the cookie says.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.has(pathname);

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    // Send them back where they were headed once they are in.
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (user && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = HOME;
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}
