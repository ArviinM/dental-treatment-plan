import { cache } from 'react';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/database.types';

/**
 * Who is signed in, and what they may do.
 *
 * Roles are derived from the database, never from the JWT's own claims, so
 * deactivating someone takes effect on their next request rather than whenever
 * their token happens to expire.
 */

export type AppRole = Database['public']['Enums']['app_role'];

export type CurrentUser = {
  id: string;
  email: string;
  role: AppRole;
  fullName: string;
  mustChangePassword: boolean;
};

/**
 * Wrapped in React `cache()` so a layout and the page inside it share one round
 * trip. Supabase is in Sydney; without this, every redundant guard would be
 * another trip across the network.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email, is_active, must_change_password')
    .eq('id', user.id)
    .maybeSingle();

  // No profile, or a deactivated one, is treated as signed out. The account
  // still exists in auth.users; it simply cannot do anything here.
  if (!profile || !profile.is_active) return null;

  return {
    id: user.id,
    email: profile.email,
    role: profile.role,
    fullName: profile.full_name,
    mustChangePassword: profile.must_change_password,
  };
});

export function isAdmin(role: AppRole): boolean {
  return role === 'admin';
}

/** Signed in, or bounced to the login page. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

/**
 * Signed in AND an admin, or sent home.
 *
 * Home rather than the login page: they are signed in, they simply are not
 * allowed here, and showing a login form would be confusing.
 */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!isAdmin(user.role)) redirect('/');
  return user;
}

/** First name only, for greetings. */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}
