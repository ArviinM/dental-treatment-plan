'use client';

import { useRef, useState, useTransition } from 'react';
import { FileText, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  finalizeTemplateUpload,
  prepareTemplateUpload,
  restoreTemplate,
} from '@/app/(app)/admin/templates/upload-actions';
import { createClient } from '@/lib/supabase/client';

export type TemplateVersion = {
  id: string;
  createdAt: string;
  isActive: boolean;
};

export type TemplateSlot = {
  kind: 'plan' | 'team';
  clinicSlug: string | null;
  label: string;
  description: string;
  versions: TemplateVersion[];
};

function when(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function TemplateManager({ slots }: { slots: TemplateSlot[] }) {
  return (
    <ul className="divide-y rounded-lg border bg-white">
      {slots.map((slot) => (
        <SlotRow key={`${slot.kind}:${slot.clinicSlug ?? 'shared'}`} slot={slot} />
      ))}
    </ul>
  );
}

/**
 * One row per template.
 *
 * These were cards, which gave four lines of information a whole screen. A row
 * says the same thing: what it is, whether it has been replaced, and how to
 * replace it. Version history stays collapsed until asked for, because most of
 * the time there is none.
 */
const MAX_BYTES = 25 * 1024 * 1024;

type Stage = 'idle' | 'uploading' | 'checking';

function SlotRow({ slot }: { slot: TemplateSlot }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [showHistory, setShowHistory] = useState(false);
  const pending = stage !== 'idle';

  const current = slot.versions.find((v) => v.isActive);
  const older = slot.versions.filter((v) => !v.isActive);

  const onFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    // Caught here first so a wrong file fails instantly, with a sentence, rather
    // than after a multi-megabyte upload.
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
   * The file goes from the browser STRAIGHT to storage. Sending it through a
   * server action is what broke in production: those reject bodies over 1 MB,
   * and a Canva team page export is 2-5 MB.
   */
  const upload = async (file: File) => {
    try {
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

      const { error: uploadError } = await createClient()
        .storage.from('plan-templates')
        .uploadToSignedUrl(prepared.path, prepared.token, file, {
          contentType: 'application/pdf',
        });

      if (uploadError) {
        toast.error('The upload did not finish. Check your connection and try again.');
        return;
      }

      setStage('checking');

      const result = await finalizeTemplateUpload({
        kind: slot.kind,
        clinicSlug: slot.clinicSlug,
        path: prepared.path,
      });

      if (!result.ok) {
        toast.error(result.error ?? 'We could not use that file.');
        return;
      }

      toast.success(`${slot.label} replaced. The next plan will use it.`);
    } catch {
      // Whatever went wrong, the admin gets a sentence and the page keeps
      // working — never the "This page couldn't load" crash she reported.
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
            {current ? `Replaced ${when(current.createdAt)}` : 'Original design'}
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
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          {pending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {stage === 'checking' ? 'Checking…' : 'Uploading…'}
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" /> Replace
            </>
          )}
        </Button>
      </div>

      {showHistory && older.length > 0 && (
        <ul className="mt-2 space-y-1 border-t pt-2 pl-8">
          {older.map((version) => (
            <li key={version.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-500">Uploaded {when(version.createdAt)}</span>
              <RestoreButton id={version.id} label={slot.label} />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function RestoreButton({ id, label }: { id: string; label: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await restoreTemplate(id);
          if (!result.ok) toast.error(result.error ?? 'Could not restore that version.');
          else toast.success(`${label} put back`);
        })
      }
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Put this back'}
    </Button>
  );
}
