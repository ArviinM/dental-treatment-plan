'use client';

import { useCallback, useRef, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { TemplateUploader } from '@/components/settings/TemplateUploader';
import { CanvasPreview } from '@/components/preview/CanvasPreview';
import { saveTemplateSettings } from '@/app/(app)/admin/templates/actions';
import type { TemplateSettings, TreatmentPlanData } from '@/types';
import { DEFAULT_TEMPLATE_SETTINGS } from '@/types';

/**
 * A stand-in plan, so the preview has something to position.
 *
 * Deliberately awkward content rather than "John Smith": a long hyphenated name
 * with an apostrophe is what actually overflows the name box, and two visits
 * across two phases is what shows the subtotal rows. If it looks right here it
 * will look right in practice.
 */
const SAMPLE_PLAN: TreatmentPlanData = {
  patientName: 'Jonathan Santos-O’Brien',
  doctorName: 'Dr Siv Lengsavath',
  date: new Date().toISOString().split('T')[0],
  location: 'burwood',
  totalAmount: 559,
  items: [
    {
      id: 's1',
      phase: 1,
      visitNo: 1,
      itemCode: '011',
      times: 1,
      description: 'Comprehensive examination of your teeth, gums and mouth.',
      tooth: '—',
      fees: [{ id: 'f1', quantity: 1, unitFee: 84 }],
    },
    {
      id: 's2',
      phase: 1,
      visitNo: 1,
      itemCode: '114',
      times: 1,
      description: 'Removal of calculus, first visit.',
      tooth: '—',
      fees: [{ id: 'f2', quantity: 1, unitFee: 150 }],
    },
    {
      id: 's3',
      phase: 2,
      visitNo: 1,
      itemCode: '532',
      times: 1,
      description: 'Tooth-coloured restoration, three surfaces.',
      tooth: '36',
      fees: [{ id: 'f3', quantity: 1, unitFee: 325 }],
    },
  ],
};

/**
 * Where text lands on the page.
 *
 * These controls already existed inside the Classic builder's Settings tab, and
 * they stay there. But that tab is the ONLY place they lived, so an admin
 * working in the new builder had no way to reach them at all — which is why
 * they are here too, next to the artwork they position things on.
 *
 * Same component, same controls; only the save differs. In the Classic builder
 * this is a per-person tweak that an admin happens to persist. Here it is
 * explicitly the shared setting for everyone.
 */
export function TemplateSettingsEditor({ initial }: { initial: TemplateSettings }) {
  const [settings, setSettings] = useState<TemplateSettings>(initial);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Number inputs fire on every keystroke, so persisting is debounced —
  // otherwise it is a round trip to Sydney and a history entry per digit.
  const persist = useCallback((next: TemplateSettings) => {
    if (timer.current) clearTimeout(timer.current);

    timer.current = setTimeout(async () => {
      setState('saving');
      const result = await saveTemplateSettings(next);

      if (!result.ok) {
        setState('idle');
        toast.error(result.error ?? 'Could not save those settings.');
        return;
      }

      setState('saved');
    }, 800);
  }, []);

  const onChange = (next: TemplateSettings) => {
    setSettings(next);
    persist(next);
  };

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          These apply to every plan the whole team makes, not just yours.
        </p>
        {state === 'saving' && (
          <span className="flex shrink-0 items-center gap-1.5 text-sm text-slate-400">
            <Loader2 className="h-3 w-3 animate-spin" /> Saving…
          </span>
        )}
        {state === 'saved' && (
          <span className="flex shrink-0 items-center gap-1.5 text-sm text-slate-400">
            <Check className="h-3 w-3 text-sia-teal" /> Saved
          </span>
        )}
      </div>

      <TemplateUploader
        settings={settings}
        onSettingsChange={onChange}
        onResetAll={() => {
          onChange(DEFAULT_TEMPLATE_SETTINGS);
          toast.success('Positions reset to where they started');
        }}
      />
      </div>

      {/* Moving a number without seeing the result is guesswork, so the page
          shows a sample plan that redraws as you type. Same renderer the plan
          builders use, so it is not an approximation. */}
      <aside className="min-w-0 max-xl:hidden">
        <div className="sticky top-6">
          <h3 className="mb-1 text-sm font-semibold text-slate-400">Preview</h3>
          <p className="mb-3 text-sm text-slate-500">
            A sample plan, so you can see where things land.
          </p>
          <CanvasPreview data={SAMPLE_PLAN} settings={settings} />
        </div>
      </aside>
    </div>
  );
}
