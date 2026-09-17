'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  changePasswordSchema,
  fieldErrorsFrom,
  signInSchema,
  type FormState,
} from '@/lib/validation/auth';

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // One message for "no such account" and "wrong password" alike, so the form
    // cannot be used to discover which email addresses exist.
    return { error: 'That email and password do not match an account.' };
  }

  const user = await getCurrentUser();

  if (!user) {
    // Authenticated against GoTrue, but no usable profile — the account was
    // deactivated. Drop the session rather than leave them in limbo.
    await supabase.auth.signOut();
    return { error: 'That account has been turned off. Ask an admin to turn it back on.' };
  }

  revalidatePath('/', 'layout');

  const next = String(formData.get('next') ?? '').trim();
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';

  redirect(user.mustChangePassword ? '/change-password' : safeNext);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath('/', 'layout');
  redirect('/login');
}

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const parsed = changePasswordSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    if (/should be different|same as the old/i.test(error.message)) {
      return { fieldErrors: { password: 'Choose a password you have not used here before.' } };
    }

    return { error: 'We could not change your password. Please try again.' };
  }

  // must_change_password lives in app_metadata, which only the service role may
  // write — a signed-in user can change their own user_metadata, so trusting
  // that instead would let anyone clear their own forced reset.
  const admin = createAdminClient();
  await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { must_change_password: false },
  });

  revalidatePath('/', 'layout');
  redirect('/');
}
