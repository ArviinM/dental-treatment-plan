import { createClient } from '@/lib/supabase/server';
import { isAdmin, requireUser } from '@/lib/auth';
import { FeeSchedule, type FeeRow } from '@/components/fees/FeeSchedule';

export const metadata = { title: 'Fee schedule | SIA Dental' };

export default async function FeesPage() {
  const user = await requireUser();
  const admin = isAdmin(user.role);

  const supabase = await createClient();
  const { data } = await supabase
    .from('fee_items')
    .select('id, code, name, description, fee')
    .eq('is_active', true)
    .order('sort_order');

  const items: FeeRow[] = (data ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    fee: Number(row.fee),
  }));

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-sia-dark">Fee schedule</h1>
        <p className="mt-2 text-slate-500">
          {admin
            ? 'One shared price list. A change here shows up for everyone straight away, and the next plan uses it.'
            : 'The prices every plan uses. Search by code or name to look one up.'}
        </p>
        {!admin && (
          <p className="mt-2 text-sm text-slate-400">
            Prices are set by an admin. If one looks wrong, let them know.
          </p>
        )}
      </header>

      <FeeSchedule items={items} canEdit={admin} />
    </div>
  );
}
