import { z } from 'zod';

/**
 * Validation for the sign-in and password forms.
 *
 * Messages are written to be read by someone who is not technical and is
 * probably between patients: say what to do, not what rule was violated.
 */

export const signInSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email address.').email('That does not look like an email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

/**
 * Eight characters is Supabase's own floor. Deliberately no symbol/digit rules:
 * they push people towards `Password1!` and towards writing it on a sticky note.
 */
export const changePasswordSchema = z
  .object({
    password: z.string().min(8, 'Use at least 8 characters.'),
    confirmPassword: z.string().min(1, 'Type your new password again.'),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Those two passwords do not match.',
  });

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

/** Flattens a zod failure into the flat map the forms render. */
export function fieldErrorsFrom(issues: z.core.$ZodIssue[]): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  for (const issue of issues) {
    const key = String(issue.path[0]);
    fieldErrors[key] ??= issue.message;
  }

  return fieldErrors;
}
