import { signIn } from '../actions';
import { AuthForm } from '@/components/auth/AuthForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'Sign in | SIA Dental' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Sign in</CardTitle>
        <CardDescription>Treatment plans for Essendon, Burwood and Mulgrave.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <AuthForm
          action={signIn}
          hidden={next ? { next } : undefined}
          submitLabel="Sign in"
          pendingLabel="Signing in…"
          fields={[
            {
              name: 'email',
              label: 'Email',
              type: 'email',
              autoComplete: 'email',
              placeholder: 'you@siadental.com.au',
            },
            { name: 'password', label: 'Password', type: 'password', autoComplete: 'current-password' },
          ]}
        />
        <p className="text-center text-sm text-muted-foreground">
          Ericka sets up accounts. Ask her if you need one, or if you have forgotten your password.
        </p>
      </CardContent>
    </Card>
  );
}
