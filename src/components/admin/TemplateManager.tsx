'use client';

import { useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { ExternalLink, FileText, Loader2, RotateCcw, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { CanvasPreview } from '@/components/preview/CanvasPreview';
import {
  discardTemplateDraft,
  finalizeTemplateUpload,
  prepareTemplateUpload,
  publishTemplate,
  restoreTemplate,
  revertToOriginalTemplate,
} from '@/app/(app)/admin/templates/upload-actions';
import { createClient } from '@/lib/supabase/client';
import { renderTemplatePreviews } from '@/lib/pdf/render-previews';
import { samplePlan } from '@/lib/pdf/sample-plan';
import type { TemplateBackgrounds } from '@/lib/data/reference';
import type { Location, TemplateSettings } from '@/types';

export type TemplateVersion = {
  id: string;
  createdAt: string;
  isActive: boolean;
  publishedAt: string | null;
  previewUrls: string[];
};

export type TemplateSlot = {
  kind: 'plan' | 'team';
  clinicSlug: Location | null;
  label: string;
  description: string;
  /** Published versions, newest first. */
  versions: TemplateVersion[];
  /** An upload waiting to be checked. Affects nobody until published. */
  draft: TemplateVersion | null;
};

const MAX_BYTES = 25 * 1024 * 1024;

function when(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function TemplateManager({
  slots,
  settings,
  liveBackgrounds,
}: {
  slots: TemplateSlot[];
  settings: TemplateSettings;
  liveBackgrounds: TemplateBackgrounds;
}) {
  return (
    <ul className="divide-y rounded-lg border bg-white">
      {slots.map((slot) => (
        <SlotRow
          key={`${slot.kind}:${slot.clinicSlug ?? 'shared'}`}
          slot={slot}
          settings={settings}
          liveBackgrounds={liveBackgrounds}
        />
      ))}
    </ul>
  );
}

type Stage = 'idle' | 'reading' | 'uploading' | 'checking';

const STAGE_LABEL: Record<Exclude<Stage, 'idle'>, string> = {
  reading: 'Reading…',
  uploading: 'Uploading…',
  checking: 'Checking…',
};

/**
 * One row per template.
 *
 * An upload does NOT go live. It waits as a draft, with a sample plan drawn on
 * it, until someone publishes it — because the one time an upload went live
 * immediately, it broke every plan and nobody could see why.
 */
function SlotRow({
  slot,
  settings,
  liveBackgrounds,
}: {
  slot: TemplateSlot;
  settings: TemplateSettings;
  liveBackgrounds: TemplateBackgrounds;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [showHistory, setShowHistory] = useState(false);
  const [pending, startTransition] = useTransition();
  const busy = stage !== 'idle' || pending;

  const current = slot.versions.find((v) => v.isActive);
  const older = slot.versions.filter((v) => !v.isActive);

  const run = (action: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.error ?? 'That did not work. Please try again.');
      else toast.success(success);
    });

  const onFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    // Caught here first so a wrong file fails instantly, with a sentence,
    // rather than after a multi-megabyte upload.
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('That needs to be a PDF. In Canva, choose Share → Download → PDF.');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(
        `That PDF is ${(file.size / 1048576).toFixed(1)} MB — the limit is 25 MB. Try exporting it from Canva at a lower quality.`
      );
      return;
    }

    void upload(file);
  };

  /**
   * The file goes from the browser STRAIGHT to storage — never through a
   * server action, which rejects anything over 1 MB. Preview images are made
   * here too, since the server has no way to draw a PDF page.
   */
  const upload = async (file: File) => {
    try {
      setStage('reading');
      let images: Blob[];
      try {
        ({ images } = await renderTemplatePreviews(file, slot.kind));
      } catch {
        toast.error('That file could not be opened as a PDF. Try exporting it again from Canva.');
        return;
      }

      setStage('uploading');
      const prepared = await prepareTemplateUpload({
        kind: slot.kind,
        clinicSlug: slot.clinicSlug,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      });

      if (!prepared.ok) {
        toast.error(prepared.error);
        return;
      }

      const storage = createClient().storage;
      const results = await Promise.all([
        storage
          .from('plan-templates')
          .uploadToSignedUrl(prepared.pdf.path, prepared.pdf.token, file, {
            contentType: 'application/pdf',
          }),
        ...prepared.previews.map((target, i) =>
          storage
            .from('template-previews')
            .uploadToSignedUrl(target.path, target.token, images[i], { contentType: 'image/png' })
        ),
      ]);

      if (results.some((r) => r.error)) {
        toast.error('The upload did not finish. Check your connection and try again.');
        return;
      }

      setStage('checking');
      const result = await finalizeTemplateUpload({
        kind: slot.kind,
        clinicSlug: slot.clinicSlug,
        path: prepared.pdf.path,
        previewPaths: prepared.previews.map((p) => p.path),
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success('Uploaded. Check the sample below — nothing changes until you publish.');
    } catch {
      // Whatever went wrong, the admin gets a sentence and the page keeps
      // working — never the "This page couldn't load" crash that was reported.
      toast.error('Something went wrong uploading that file. Please try again.');
    } finally {
      setStage('idle');
    }
  };

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <FileText className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />

        <div className="min-w-48 flex-1">
          <p className="font-medium text-sia-dark">{slot.label}</p>
          <p className="text-sm text-slate-500">
            {current
              ? `Replaced ${when(current.publishedAt ?? current.createdAt)}`
              : 'Original design'}
            {current && (
              <>
                {' · '}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => revertToOriginalTemplate({ kind: slot.kind, clinicSlug: slot.clinicSlug }),
                      `${slot.label} is back to the original design`
                    )
                  }
                  className="underline hover:text-sia-dark disabled:opacity-50"
                >
                  use the original
                </button>
              </>
            )}
            {older.length > 0 && (
              <>
                {' · '}
                <button
                  type="button"
                  onClick={() => setShowHistory((v) => !v)}
                  className="underline hover:text-sia-dark"
                >
                  {showHistory ? 'hide' : `${older.length} earlier`}
                </button>
              </>
            )}
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          onChange={onFile}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {stage !== 'idle' ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {STAGE_LABEL[stage]}
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" /> Replace
            </>
          )}
        </Button>
      </div>

      {slot.draft && (
        <DraftPanel
          slot={slot}
          draft={slot.draft}
          settings={settings}
          liveBackgrounds={liveBackgrounds}
          busy={busy}
          onPublish={() =>
            run(
              () => publishTemplate(slot.draft!.id),
              `${slot.label} published. New plans use it now.`
            )
          }
          onDiscard={() => run(() => discardTemplateDraft(slot.draft!.id), 'Draft discarded')}
        />
      )}

      {showHistory && older.length > 0 && (
        <ul className="mt-2 space-y-1 border-t pl-8 pt-2">
          {older.map((version) => (
            <li key={version.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-500">
                Used from {when(version.publishedAt ?? version.createdAt)}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => run(() => restoreTemplate(version.id), `${slot.label} put back`)}
              >
                <RotateCcw className="mr-2 h-3.5 w-3.5" /> Put this back
              </Button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * The check before anything goes live.
 *
 * For the plan template it draws the sample plan ON the new artwork, because
 * that is where a collision shows — a heading printed twice, a table on top of
 * a table. A team page has nothing drawn on it, so the page itself is enough.
 * Either way "Open a sample plan" renders a real PDF with the real renderer,
 * which is the proof rather than the approximation.
 */
function DraftPanel({
  slot,
  draft,
  settings,
  liveBackgrounds,
  busy,
  onPublish,
  onDiscard,
}: {
  slot: TemplateSlot;
  draft: TemplateVersion;
  settings: TemplateSettings;
  liveBackgrounds: TemplateBackgrounds;
  busy: boolean;
  onPublish: () => void;
  onDiscard: () => void;
}) {
  const backgrounds: TemplateBackgrounds =
    slot.kind === 'plan'
      ? {
          ...liveBackgrounds,
          cover: draft.previewUrls[0],
          treatment: draft.previewUrls[1],
          continuation: draft.previewUrls[2],
        }
      : liveBackgrounds;

  return (
    <div className="mt-3 rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
      <p className="font-medium text-amber-950">A new version is waiting to be checked</p>
      <p className="mt-1 text-sm text-amber-900">
        Nobody&apos;s plans use it yet. Look at the sample below — if the patient&apos;s name, the
        heading or the table land on top of something already printed on the page, those parts
        need removing in Canva before it can be used.
      </p>

      <div className="mt-4 max-w-xs">
        {slot.kind === 'plan' ? (
          <CanvasPreview data={samplePlan()} settings={settings} backgrounds={backgrounds} />
        ) : draft.previewUrls[0] ? (
          <Image
            src={draft.previewUrls[0]}
            alt={`The new ${slot.label}`}
            width={1080}
            height={1920}
            className="h-auto w-full rounded border bg-white"
            unoptimized
          />
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" asChild>
          <a href={`/api/templates/${draft.id}/sample`} target="_blank" rel="noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" /> Open a sample plan
          </a>
        </Button>
        <Button type="button" size="sm" disabled={busy} onClick={onPublish}>
          Publish
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onDiscard}>
          Discard
        </Button>
      </div>
    </div>
  );
}
