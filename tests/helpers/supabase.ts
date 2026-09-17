import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';

/**
 * Harness for the integration suite.
 *
 * ⚠️ THESE TESTS RUN AGAINST THE REAL SUPABASE PROJECT. There is no local
 * stack. Everything created here is prefixed or suffixed with `TEST_TAG` and
 * removed in afterAll, and nothing deletes a row it did not create — the same
 * database holds Ericka's account and the seeded fee schedule.
 *
 * Do not run this suite once real patient records exist.
 */

export type Client = SupabaseClient<Database>;

/** Stamped on every fixture so a leaked row is obvious and easy to find. */
export const TEST_TAG = 'zz-autotest';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Integration tests need .env.local.`);
  return value;
}

const url = () => required('NEXT_PUBLIC_SUPABASE_URL');

/**
 * Service role. Bypasses RLS entirely, so it is used ONLY to build and tear
 * down fixtures — never to assert what a user can see. An assertion made with
 * this client would pass no matter how broken the policies were.
 */
export function adminClient(): Client {
  return createClient<Database>(url(), required('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Exactly what a stranger holding the publishable key has. */
export function anonClient(): Client {
  return createClient<Database>(url(), required('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Short random suffix, so concurrent runs cannot collide on unique columns. */
export function uid(): string {
  return crypto.randomUUID().slice(0, 8);
}

export type TestUser = {
  id: string;
  email: string;
  /** Already signed in, and subject to RLS. Assertions use THIS. */
  client: Client;
};

/**
 * Creates a real auth user and returns a client signed in as them.
 *
 * The role goes in app_metadata because that is the only channel the database
 * trusts — which is itself one of the things this suite proves.
 */
export async function createTestUser(role: 'admin' | 'staff', fullName?: string): Promise<TestUser> {
  const admin = adminClient();
  const suffix = uid();
  const email = `${TEST_TAG}-${suffix}@example.com`;
  // Ephemeral, used once, deleted minutes later.
  const password = `Test-${crypto.randomUUID()}`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName ?? `${TEST_TAG} ${suffix}` },
    app_metadata: { role },
  });

  if (error || !data.user) throw new Error(`could not create test user: ${error?.message}`);

  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`could not sign in test user: ${signInError.message}`);

  return { id: data.user.id, email, client };
}

/** Removes test users. Profiles go with them via ON DELETE CASCADE. */
export async function deleteTestUsers(ids: string[]): Promise<void> {
  const admin = adminClient();
  await Promise.all(ids.map((id) => admin.auth.admin.deleteUser(id)));
}

/**
 * Deletes only rows this suite created, matched on the tag. Deliberately
 * narrow: a broad cleanup here would eat the seeded reference data.
 */
export async function cleanupTaggedRows(): Promise<void> {
  const admin = adminClient();

  await admin.from('treatment_plans').delete().like('patient_name', `${TEST_TAG}%`);
  await admin.from('fee_items').delete().like('code', `${TEST_TAG}%`);
  await admin.from('staff_members').delete().like('slug', `${TEST_TAG}%`);
  await admin.from('activity_log').delete().like('summary', `%${TEST_TAG}%`);
}
