'use client';

import { useRef, useState, useTransition } from 'react';
import { FileText, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { restoreTemplate, uploadTemplate } from '@/app/(app)/admin/templates/upload-actions';

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
function SlotRow({ slot }: { slot: TemplateSlot }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [showHistory, setShowHistory] = useState(false);

  const current = slot.versions.find((v) => v.isActive);
  const older = slot.versions.filter((v) => !v.isActive);

  const onFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const formData = new FormData();
    formData.set('kind', slot.kind);
    if (slot.clinicSlug) formData.set('clinicSlug', slot.clinicSlug);
    formData.set('file', file);

    startTransition(async () => {
      const result = await uploadTemplate(formData);
      if (!result.ok) toast.error(result.error ?? 'Could not upload that file.');
      else toast.success(`${slot.label} replaced`);
    });
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
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…
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
