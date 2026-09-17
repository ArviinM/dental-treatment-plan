import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { AccountsManager, type AccountRow } from '@/components/admin/AccountsManager';

export const metadata = { title: 'Accounts | SIA Dental' };

export default async function AccountsPage() {
  // The admin layout already guards this; re-checking here is cheap because
  // getCurrentUser is wrapped in React cache(), and it means the page is never
  // reachable by accident if the layout is ever restructured.
  const admin = await requireAdmin();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, is_active, must_change_password')
    .order('role', { ascending: true })
    .order('full_name', { ascending: true });

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight text-sia-dark">Accounts</h1>
        <p className="mt-4 text-sm text-destructive">
          We could not load the accounts just now. Refresh the page to try again.
        </p>
      </div>
    );
  }

  const accounts: AccountRow[] = (data ?? []).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    isActive: row.is_active,
    mustChangePassword: row.must_change_password,
  }));

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-sia-dark">Accounts</h1>
        <p className="mt-2 text-slate-500">
          Who can sign in, and what they are allowed to do.
        </p>
      </header>

      <AccountsManager accounts={accounts} currentUserId={admin.id} />
    </div>
  );
}
