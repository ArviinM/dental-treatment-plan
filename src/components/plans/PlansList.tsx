'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { FileText, Loader2, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { deletePlanAction } from '@/app/(app)/plans/actions';
import type { PlanSummary } from '@/lib/plans/mutations';

function money(value: number): string {
  return `$${value.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function when(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function PlansList({ plans }: { plans: PlanSummary[] }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return plans;
    return plans.filter(
      (plan) =>
        plan.patientName.toLowerCase().includes(q) ||
        plan.dentistName.toLowerCase().includes(q) ||
        plan.clinicName.toLowerCase().includes(q)
    );
  }, [plans, query]);

  // An empty screen is an invitation to act, not an apology.
  if (!plans.length) {
    return (
      <div className="rounded-lg border bg-white p-10 text-center">
        <FileText className="mx-auto h-8 w-8 text-slate-300" aria-hidden />
        <p className="mt-3 font-medium text-sia-dark">No saved plans yet</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
          Plans you save show up here, so you can open one again later instead of starting over.
        </p>
        <Button asChild className="mt-5">
          <Link href="/plans/new">Make a plan</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by patient, dentist or clinic"
          className="pl-9"
          aria-label="Search saved plans"
        />
      </div>

      <ul className="divide-y rounded-lg border bg-white">
        {filtered.map((plan) => (
          <li key={plan.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
            <Link href={`/plans/${plan.id}`} className="group min-w-48 flex-1">
              <p className="font-medium text-sia-dark group-hover:underline">{plan.patientName}</p>
              <p className="text-sm text-slate-500">
                {plan.dentistName || 'No dentist set'} · {plan.clinicName} · {when(plan.planDate)}
              </p>
            </Link>

            {plan.status === 'draft' && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                Draft
              </span>
            )}

            <span className="w-24 shrink-0 text-right font-medium tabular-nums text-sia-dark">
              {money(plan.totalAmount)}
            </span>

            <DeleteButton id={plan.id} patientName={plan.patientName} />
          </li>
        ))}

        {!filtered.length && (
          <li className="p-8 text-center text-sm text-slate-500">Nothing matches “{query}”.</li>
        )}
      </ul>
    </div>
  );
}

function DeleteButton({ id, patientName }: { id: string; patientName: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setConfirming(true)}
        aria-label={`Remove ${patientName}'s plan`}
      >
        <Trash2 className="h-4 w-4 text-slate-400" />
      </Button>
    );
  }

  return (
    <span className="flex items-center gap-1">
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await deletePlanAction(id);
            if (!result.ok) {
              toast.error(result.error ?? 'Could not remove that plan.');
              setConfirming(false);
              return;
            }
            toast.success(`${patientName}'s plan removed from the list`);
          })
        }
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Remove'}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </span>
  );
}
