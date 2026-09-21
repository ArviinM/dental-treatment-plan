'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, HelpCircle } from 'lucide-react';

import { useLocalPreference } from '@/hooks/useLocalPreference';

const DISMISSED_KEY = 'sia-guide-dismissed';

type Step = {
  title: string;
  body: React.ReactNode;
};

const STEPS: Step[] = [
  {
    title: 'Make a plan',
    body: (
      <>
        Type the patient’s name, pick the dentist, then search for each treatment by name or code —
        the description and fee fill themselves in. Add a visit for each appointment, and the
        treatments underneath it. It saves as you go, so you can stop and come back.
      </>
    ),
  },
  {
    title: 'Prefer the screen you already know?',
    body: (
      <>
        <Link href="/legacy" className="font-medium text-sia-dark underline">
          Classic builder
        </Link>{' '}
        is exactly as it always was and is not going anywhere. Both make the same PDF.
      </>
    ),
  },
  {
    title: 'Finding a plan again',
    body: (
      <>
        Anything you gave a patient name to is under{' '}
        <Link href="/plans" className="font-medium text-sia-dark underline">
          Saved plans
        </Link>
        . Open it to change it or download the PDF again — no need to start over.
      </>
    ),
  },
  {
    title: 'Prices',
    body: (
      <>
        The{' '}
        <Link href="/fees" className="font-medium text-sia-dark underline">
          fee schedule
        </Link>{' '}
        is where every price lives — look any item up by code or name. Only an admin can change a
        price, and every change is recorded.
      </>
    ),
  },
];

/**
 * A short guide on the dashboard, for people meeting the app for the first time.
 *
 * It answers "what do I do here" in four lines rather than explaining features.
 * Dismissable, because it stops being useful after a week — and remembered per
 * browser, so it does not nag. Anyone who wants it back can reopen it.
 */
export function QuickGuide() {
  const [dismissed, setDismissed] = useLocalPreference(DISMISSED_KEY, false);
  const [reopened, setReopened] = useState(false);

  const dismiss = () => {
    setDismissed(true);
    setReopened(false);
  };

  if (dismissed && !reopened) {
    return (
      <button
        type="button"
        onClick={() => setReopened(true)}
        className="mt-10 flex items-center gap-2 text-sm font-medium text-slate-400 transition-colors hover:text-sia-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sia-teal"
      >
        <HelpCircle className="h-4 w-4" aria-hidden />
        Get started
      </button>
    );
  }

  return (
    <section className="mt-10 rounded-xl border bg-white p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-sia-dark">
            <HelpCircle className="h-4 w-4 text-sia-teal" aria-hidden />
            Get started
          </h2>
          <p className="mt-1 text-sm text-slate-500">Four things worth knowing. That is all.</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm text-slate-400 transition-colors hover:text-sia-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sia-teal"
        >
          Got it
          <ChevronDown className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <ol className="space-y-4">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-3">
            {/* Numbered because these genuinely are a sequence — it is the order
                someone meets the app in, not decoration. */}
            <span
              aria-hidden
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sia-teal/10 text-xs font-bold text-sia-teal"
            >
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-sia-dark">{step.title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-slate-500">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
