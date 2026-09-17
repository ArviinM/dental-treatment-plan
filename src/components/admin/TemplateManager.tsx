'use client';

import { useRef, useState, useTransition } from 'react';
import { FileText, History, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    <div className="space-y-4">
      {slots.map((slot) => (
        <SlotCard key={`${slot.kind}:${slot.clinicSlug ?? 'shared'}`} slot={slot} />
      ))}
    </div>
  );
}

function SlotCard({ slot }: { slot: TemplateSlot }) {
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
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{slot.label}</CardTitle>
            <CardDescription>{slot.description}</CardDescription>
          </div>
          <div className="flex gap-2">
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
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <FileText className="h-4 w-4 text-slate-400" aria-hidden />
          {current
            ? `Uploaded ${when(current.createdAt)}`
            : 'Using the original design that shipped with the app.'}
        </p>

        {older.length > 0 && (
          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory((v) => !v)}
            >
              <History className="mr-2 h-4 w-4" />
              {showHistory ? 'Hide' : `${older.length} earlier ${older.length === 1 ? 'version' : 'versions'}`}
            </Button>

            {showHistory && (
              <ul className="mt-2 space-y-1 border-t pt-2">
                {older.map((version) => (
                  <li key={version.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-500">Uploaded {when(version.createdAt)}</span>
                    <RestoreButton id={version.id} label={slot.label} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
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
