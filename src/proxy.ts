import type { NextRequest } from 'next/server';

import { updateSession } from '@/lib/supabase/proxy';

/**
 * Next 16 renamed the `middleware` convention to `proxy`. The exported function
 * must be named `proxy` (or be the default export).
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Everything except static assets. Without the exclusions the auth redirect
  // would fire for CSS, JS and images too, and the app would render unstyled.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|brand/|fonts/|templates/|dentist-photos/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|ttf|woff2?)$).*)',
  ],
};
