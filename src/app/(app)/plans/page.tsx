import Link from 'next/link';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { requireUser } from '@/lib/auth';
import { listPlans } from '@/lib/plans/mutations';
import { PlansList } from '@/components/plans/PlansList';

export const metadata = { title: 'Saved plans | SIA Dental' };

export default async function PlansPage() {
  await requireUser();
  const plans = await listPlans();

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-sia-dark">Saved plans</h1>
          <p className="mt-2 text-slate-500">
            Plans the team has kept, newest first. Open one to pick up where you left off.
          </p>
        </div>
        <Button asChild>
          <Link href="/plans/new">
            <Plus className="mr-2 h-4 w-4" /> New plan
          </Link>
        </Button>
      </header>

      <PlansList plans={plans} />

      <p className="mt-8 text-sm text-slate-400">
        Removing a plan takes it off this list but does not erase it — dental records have to be
        kept for a period, so it is retained and then removed automatically.
      </p>
    </div>
  );
}
