'use client';

import { useCallback, useRef, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { TemplateUploader } from '@/components/settings/TemplateUploader';
import { CanvasPreview } from '@/components/preview/CanvasPreview';
import { saveTemplateSettings } from '@/app/(app)/admin/templates/actions';
import type { TemplateSettings } from '@/types';
import { samplePlan } from '@/lib/pdf/sample-plan';
import type { TemplateBackgrounds } from '@/lib/data/reference';
import { DEFAULT_TEMPLATE_SETTINGS } from '@/types';

const SAMPLE_PLAN = samplePlan();

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
export function TemplateSettingsEditor({
  initial,
  backgrounds,
}: {
  initial: TemplateSettings;
  /** The live artwork, so positions are nudged against what actually prints. */
  backgrounds?: TemplateBackgrounds;
}) {
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
    // Two columns when there is room; stacked otherwise. The preview is NEVER
    // hidden — these are raw coordinates, and without seeing the result the
    // controls are just numbers. Stacked, the preview goes FIRST so it is the
    // thing you see before you start changing values.
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="order-2 min-w-0 lg:order-1">
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
      <aside className="order-1 min-w-0 lg:order-2">
        <div className="lg:sticky lg:top-6">
          <h3 className="mb-1 text-sm font-semibold text-slate-400">Preview</h3>
          <p className="mb-3 text-sm text-slate-500">
            A sample plan, so you can see where things land.
          </p>
          <div className="mx-auto max-w-xs lg:max-w-none">
            <CanvasPreview data={SAMPLE_PLAN} settings={settings} backgrounds={backgrounds} />
          </div>
        </div>
      </aside>
    </div>
  );
}
