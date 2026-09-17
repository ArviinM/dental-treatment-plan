import Link from 'next/link';
import { ArrowRight, Check, FilePlus2 } from 'lucide-react';

import { requireUser, isAdmin, firstName } from '@/lib/auth';
import { getSetupCounts } from '@/lib/data/reference';
import { QuickGuide } from '@/components/shell/QuickGuide';

export const metadata = { title: 'Home | SIA Dental' };

/**
 * Dashboard home.
 *
 * Deliberately thin. The people using this are mid-appointment and not
 * technical, so it answers one question — "how do I make a plan?" — before
 * anything else.
 *
 * Ericka additionally gets a setup checklist until each item is done. Every
 * item is already seeded, so each one is a *review*, not data entry, and none
 * of it gates making a plan.
 */
export default async function HomePage() {
  const user = await requireUser();
  const admin = isAdmin(user.role);
  const counts = admin ? await getSetupCounts() : null;

  const checklist = counts
    ? [
        { done: counts.clinics >= 3, label: 'Confirm your three clinics', href: '/admin/staff', detail: `${counts.clinics} set up` },
        { done: counts.staff > 0, label: 'Review the dentists', href: '/admin/staff', detail: `${counts.staff} listed` },
        { done: counts.fees > 0, label: 'Review the fee schedule', href: '/fees', detail: `${counts.fees} items` },
        { done: counts.templates > 0, label: 'Upload a team page for each clinic', href: '/admin/templates', detail: counts.templates > 0 ? `${counts.templates} uploaded` : 'using the originals' },
        { done: counts.accounts > 1, label: 'Invite your team', href: '/admin/accounts', detail: `${counts.accounts} ${counts.accounts === 1 ? 'account' : 'accounts'}` },
      ]
    : [];

  const remaining = checklist.filter((item) => !item.done).length;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 lg:py-16">
      <h1 className="text-3xl font-bold tracking-tight text-sia-dark">
        Good to see you, {firstName(user.fullName)}
      </h1>
      <p className="mt-2 text-slate-500">
        Everything works the way it always has. Nothing you rely on has moved.
      </p>

      <Link
        href="/plans/new"
        className="mt-8 flex items-center gap-5 rounded-xl border border-sia-teal/40 bg-white p-6 transition-colors hover:border-sia-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sia-teal"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sia-teal/10">
          <FilePlus2 className="h-6 w-6 text-sia-teal" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-semibold text-sia-dark">Make a plan</span>
          <span className="mt-0.5 block text-sm text-slate-500">
            Fill in the patient and treatment details, then download the PDF.
          </span>
        </span>
        <ArrowRight className="h-5 w-5 shrink-0 text-sia-teal" aria-hidden />
      </Link>

      <QuickGuide />

      {admin && remaining > 0 && (
        <section className="mt-12">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-400">Setting up</h2>
            <p className="text-sm text-slate-400">
              {checklist.length - remaining} of {checklist.length} done
            </p>
          </div>

          <ul className="divide-y rounded-lg border bg-white">
            {checklist.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 p-4 transition-colors hover:bg-slate-900/[0.02]"
                >
                  <span
                    aria-hidden
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      item.done ? 'border-sia-teal bg-sia-teal text-white' : 'border-slate-300'
                    }`}
                  >
                    {item.done && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  <span
                    className={`min-w-0 flex-1 text-sm ${
                      item.done ? 'text-slate-400 line-through' : 'font-medium text-sia-dark'
                    }`}
                  >
                    {item.label}
                  </span>
                  <span className="shrink-0 text-sm text-slate-400">{item.detail}</span>
                </Link>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-sm text-slate-400">
            Everything is already filled in from what the app shipped with, so these are a quick
            look rather than a job. Your team can make plans either way.
          </p>
        </section>
      )}
    </div>
  );
}
