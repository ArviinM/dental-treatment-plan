/**
 * Environment variables, validated once.
 *
 * Deliberately not zod: this runs in the browser bundle too, and a schema
 * library is a lot of weight for four strings.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`
    );
  }

  return value;
}

/**
 * Public values. These reach the browser, which is fine — row level security is
 * what actually protects the data, not the secrecy of the publishable key.
 *
 * Referenced statically rather than through a variable, because Next only
 * inlines `process.env.NEXT_PUBLIC_*` when it can see the literal name.
 */
export const env = Object.freeze({
  supabaseUrl: required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: required(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ),
});

/**
 * The service role key, as a FUNCTION rather than a property.
 *
 * A property would be evaluated whenever this module is imported, including
 * from a client component, and a missing-variable throw would surface in the
 * browser. As a function it is only read when something actually needs it —
 * and the only thing that does is src/lib/supabase/admin.ts, which is
 * `server-only`.
 */
export function serviceRoleKey(): string {
  return required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY);
}
