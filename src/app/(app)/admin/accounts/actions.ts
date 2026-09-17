'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin, type AppRole } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

/**
 * Account management.
 *
 * Every action here follows the same four steps, in this order:
 *
 *   1. requireAdmin()                — is the CALLER allowed to be here at all
 *   2. an explicit rule check        — is this specific act allowed
 *   3. read the target via RLS       — a row they cannot read is one they
 *                                      cannot act on
 *   4. only then createAdminClient() — the service role bypasses RLS entirely,
 *                                      so it is reached for last, never first
 */

export type ActionResult = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Present after a create or a reset — shown once, never stored. */
  credentials?: { email: string; temporaryPassword: string };
};

/**
 * Readable temporary password: no ambiguous characters and no symbols, because
 * Ericka will read this down a phone or write it on paper. Single use — the
 * account is forced to change it at first sign-in.
 */
function temporaryPassword(): string {
  const words = ['Molar', 'Canine', 'Enamel', 'Incisor', 'Bracket', 'Fluoride', 'Crown', 'Veneer'];
  const word = words[Math.floor(Math.random() * words.length)];
  const digits = String(Math.floor(1000 + Math.random() * 9000));
  return `${word}${digits}`;
}

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function createAccount(values: {
  fullName: string;
  email: string;
  role: AppRole;
}): Promise<ActionResult> {
  await requireAdmin();

  const fullName = values.fullName.trim();
  const email = values.email.trim().toLowerCase();

  const fieldErrors: Record<string, string> = {};
  if (fullName.length < 2) fieldErrors.fullName = 'Enter their full name.';
  if (!EMAIL_PATTERN.test(email)) fieldErrors.email = 'Enter a valid email address.';
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };

  const password = temporaryPassword();
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    // app_metadata is the only trustworthy source for role: a signed-in user
    // can write their own user_metadata, but only the service role can write
    // this. handle_new_user() and the app_metadata sync trigger both read here.
    app_metadata: { role: values.role, must_change_password: true },
  });

  if (error) {
    if (/already been registered|already registered|duplicate/i.test(error.message)) {
      return { ok: false, fieldErrors: { email: 'That email already has an account.' } };
    }

    return { ok: false, error: 'We could not create that account. Please try again.' };
  }

  await logActivity({
    action: 'account.create',
    entityType: 'account',
    entityId: data.user?.id,
    summary: `${fullName} was given a ${values.role === 'admin' ? 'admin' : 'staff'} account`,
    metadata: { email, role: values.role },
  });

  revalidatePath('/admin/accounts');
  return { ok: true, credentials: { email, temporaryPassword: password } };
}

export async function resetPassword(userId: string): Promise<ActionResult> {
  await requireAdmin();

  // Read through the caller's own client: RLS decides what they can see, so a
  // profile they cannot read is a profile they cannot reset.
  const supabase = await createClient();
  const { data: target } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('id', userId)
    .maybeSingle();

  if (!target) return { ok: false, error: 'You cannot manage that account.' };

  const password = temporaryPassword();
  const admin = createAdminClient();

  const { error } = await admin.auth.admin.updateUserById(userId, {
    password,
    app_metadata: { must_change_password: true },
  });

  if (error) return { ok: false, error: 'We could not reset that password. Please try again.' };

  await logActivity({
    action: 'account.reset_password',
    entityType: 'account',
    entityId: userId,
    summary: `${target.full_name}'s password was reset`,
  });

  revalidatePath('/admin/accounts');
  return { ok: true, credentials: { email: target.email, temporaryPassword: password } };
}

export async function setAccountActive(
  userId: string,
  isActive: boolean
): Promise<ActionResult> {
  const admin = await requireAdmin();

  // Without this an admin can switch themselves off and lock everyone out of
  // account management, with no way back in short of the bootstrap script.
  if (userId === admin.id && !isActive) {
    return { ok: false, error: 'You cannot turn off your own account.' };
  }

  const supabase = await createClient();
  const { data: target } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('id', userId)
    .maybeSingle();

  if (!target) return { ok: false, error: 'You cannot manage that account.' };

  const { error } = await supabase
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', userId);

  if (error) return { ok: false, error: 'We could not change that account. Please try again.' };

  await logActivity({
    action: isActive ? 'account.enable' : 'account.disable',
    entityType: 'account',
    entityId: userId,
    summary: `${target.full_name}'s account was turned ${isActive ? 'on' : 'off'}`,
  });

  revalidatePath('/admin/accounts');
  return { ok: true };
}

export async function setAccountRole(userId: string, role: AppRole): Promise<ActionResult> {
  const admin = await requireAdmin();

  // Same lockout guard: the last admin must not be able to demote themselves.
  if (userId === admin.id && role !== 'admin') {
    return { ok: false, error: 'You cannot remove your own admin access.' };
  }

  const supabase = await createClient();
  const { data: target } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('id', userId)
    .maybeSingle();

  if (!target) return { ok: false, error: 'You cannot manage that account.' };

  // Written to app_metadata rather than to profiles.role directly. The sync
  // trigger mirrors it down, which keeps app_metadata and the profile in step —
  // update the table alone and the next metadata change would overwrite it.
  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    app_metadata: { role },
  });

  if (error) return { ok: false, error: 'We could not change that role. Please try again.' };

  await logActivity({
    action: 'account.set_role',
    entityType: 'account',
    entityId: userId,
    summary: `${target.full_name} was made ${role === 'admin' ? 'an admin' : 'a staff member'}`,
    metadata: { role },
  });

  revalidatePath('/admin/accounts');
  return { ok: true };
}
