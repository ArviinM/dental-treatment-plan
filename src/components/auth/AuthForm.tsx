'use client';

import { useActionState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FormState } from '@/lib/validation/auth';

type Field = {
  name: string;
  label: string;
  type: 'email' | 'password';
  autoComplete: string;
  placeholder?: string;
  /** Shown under the input when there is no error to show instead. */
  hint?: string;
};

type AuthFormProps = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  fields: Field[];
  submitLabel: string;
  pendingLabel: string;
  /** Extra values posted with the form, e.g. where to go after signing in. */
  hidden?: Record<string, string>;
};

/**
 * The shared shape of the sign-in and change-password forms.
 *
 * Errors appear under the field they belong to, in plain language, and the
 * button says what it is doing while it does it. The people using this are not
 * technical — a form that fails silently is a support call.
 */
export function AuthForm({ action, fields, submitLabel, pendingLabel, hidden }: AuthFormProps) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-5">
      {hidden &&
        Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}

      {state.error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      )}

      {fields.map((field) => {
        const error = state.fieldErrors?.[field.name];
        const describedBy = error
          ? `${field.name}-error`
          : field.hint
            ? `${field.name}-hint`
            : undefined;

        return (
          <div key={field.name} className="space-y-1.5">
            <Label htmlFor={field.name}>{field.label}</Label>
            <Input
              id={field.name}
              name={field.name}
              type={field.type}
              autoComplete={field.autoComplete}
              placeholder={field.placeholder}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              className={error ? 'border-destructive' : undefined}
            />
            {error ? (
              <p id={`${field.name}-error`} role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : field.hint ? (
              <p id={`${field.name}-hint`} className="text-sm text-muted-foreground">
                {field.hint}
              </p>
            ) : null}
          </div>
        );
      })}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {pendingLabel}
          </>
        ) : (
          submitLabel
        )}
      </Button>
    </form>
  );
}
