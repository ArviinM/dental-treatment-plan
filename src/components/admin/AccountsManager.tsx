'use client';

import { useState, useTransition } from 'react';
import { Check, Copy, KeyRound, Loader2, ShieldCheck, UserPlus, UserX } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createAccount,
  resetPassword,
  setAccountActive,
  setAccountRole,
  type ActionResult,
} from '@/app/(app)/admin/accounts/actions';
import type { AppRole } from '@/lib/auth';

export type AccountRow = {
  id: string;
  fullName: string;
  email: string;
  role: AppRole;
  isActive: boolean;
  mustChangePassword: boolean;
};

type Credentials = { email: string; temporaryPassword: string };

/**
 * Ericka's account management.
 *
 * The important interaction is the temporary password: it exists for exactly
 * one moment, and if she loses it before passing it on, her only option is to
 * reset again. So it is shown in a panel that does not disappear on its own,
 * with a copy button, and it says plainly that it will not be shown again.
 */
export function AccountsManager({
  accounts,
  currentUserId,
}: {
  accounts: AccountRow[];
  currentUserId: string;
}) {
  const [credentials, setCredentials] = useState<Credentials | null>(null);

  return (
    <div className="space-y-8">
      {credentials && (
        <CredentialsPanel credentials={credentials} onDismiss={() => setCredentials(null)} />
      )}

      <NewAccountForm onCreated={setCredentials} />

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-400">
          {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}
        </h2>
        <ul className="space-y-2">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              isSelf={account.id === currentUserId}
              onReset={setCredentials}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

function CredentialsPanel({
  credentials,
  onDismiss,
}: {
  credentials: Credentials;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(credentials.temporaryPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy. Select the password and copy it by hand.');
    }
  };

  return (
    <Card className="border-sia-teal/40 bg-sia-teal/5">
      <CardHeader>
        <CardTitle className="text-base">Temporary password</CardTitle>
        <CardDescription>
          Give this to <span className="font-medium text-sia-dark">{credentials.email}</span>. They
          will be asked to choose their own password as soon as they sign in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <code className="rounded-md border bg-white px-3 py-2 font-mono text-lg tracking-wide text-sia-dark">
            {credentials.temporaryPassword}
          </code>
          <Button type="button" variant="outline" size="sm" onClick={copy}>
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4" /> Copied
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" /> Copy
              </>
            )}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          This is the only time it is shown. If you lose it, reset the password again — nothing is
          broken by doing that.
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
          Done
        </Button>
      </CardContent>
    </Card>
  );
}

function NewAccountForm({ onCreated }: { onCreated: (c: Credentials) => void }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AppRole>('staff');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setFieldErrors({});

    startTransition(async () => {
      const result = await createAccount({ fullName, email, role });

      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        if (result.error) toast.error(result.error);
        return;
      }

      setFullName('');
      setEmail('');
      setRole('staff');
      if (result.credentials) onCreated(result.credentials);
      toast.success(`Account created for ${result.credentials?.email}`);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add someone</CardTitle>
        <CardDescription>
          They get a temporary password to sign in with, then choose their own.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Maria Santos"
              aria-invalid={fieldErrors.fullName ? true : undefined}
            />
            {fieldErrors.fullName && (
              <p className="text-sm text-destructive">{fieldErrors.fullName}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="maria@siadental.com.au"
              aria-invalid={fieldErrors.email ? true : undefined}
            />
            {fieldErrors.email && <p className="text-sm text-destructive">{fieldErrors.email}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="role">What can they do?</Label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as AppRole)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-2 focus-visible:outline-sia-teal"
            >
              <option value="staff">Make treatment plans</option>
              <option value="admin">Everything, including accounts</option>
            </select>
          </div>

          <div className="flex items-end">
            <Button type="submit" disabled={pending} className="w-full sm:w-auto">
              {pending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" /> Create account
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function AccountCard({
  account,
  isSelf,
  onReset,
}: {
  account: AccountRow;
  isSelf: boolean;
  onReset: (c: Credentials) => void;
}) {
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<ActionResult>, onOk?: (r: ActionResult) => void) => {
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        toast.error(result.error ?? 'That did not work. Please try again.');
        return;
      }
      onOk?.(result);
    });
  };

  return (
    <li
      className={`flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border bg-white p-4 ${
        account.isActive ? '' : 'opacity-60'
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-medium text-sia-dark">
          {account.fullName}
          {isSelf && <span className="text-xs font-normal text-slate-400">you</span>}
          {account.role === 'admin' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sia-purple/10 px-2 py-0.5 text-xs font-medium text-sia-purple">
              <ShieldCheck className="h-3 w-3" aria-hidden /> Admin
            </span>
          )}
          {!account.isActive && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
              Turned off
            </span>
          )}
          {account.mustChangePassword && account.isActive && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
              Has not signed in yet
            </span>
          )}
        </p>
        <p className="truncate text-sm text-muted-foreground">{account.email}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            run(
              () => resetPassword(account.id),
              (r) => r.credentials && onReset(r.credentials)
            )
          }
        >
          <KeyRound className="mr-2 h-4 w-4" /> Reset password
        </Button>

        {!isSelf && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(() => setAccountRole(account.id, account.role === 'admin' ? 'staff' : 'admin'))
              }
            >
              {account.role === 'admin' ? 'Make staff' : 'Make admin'}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => run(() => setAccountActive(account.id, !account.isActive))}
            >
              <UserX className="mr-2 h-4 w-4" />
              {account.isActive ? 'Turn off' : 'Turn on'}
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
