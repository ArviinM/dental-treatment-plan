import { redirect } from 'next/navigation';

import { changePassword } from '../actions';
import { AuthForm } from '@/components/auth/AuthForm';
import { getCurrentUser } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'Choose a password | SIA Dental' };

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // Reachable voluntarily from the account menu, so the copy shifts depending on
  // whether this is the forced first-sign-in reset or someone just changing it.
  const forced = user.mustChangePassword;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          {forced ? 'Choose your own password' : 'Change your password'}
        </CardTitle>
        <CardDescription>
          {forced
            ? 'You are signed in with a temporary password. Pick one only you know.'
            : 'Pick a new password for your account.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AuthForm
          action={changePassword}
          submitLabel="Save password"
          pendingLabel="Saving…"
          fields={[
            {
              name: 'password',
              label: 'New password',
              type: 'password',
              autoComplete: 'new-password',
              hint: 'At least 8 characters.',
            },
            {
              name: 'confirmPassword',
              label: 'Type it again',
              type: 'password',
              autoComplete: 'new-password',
            },
          ]}
        />
      </CardContent>
    </Card>
  );
}
