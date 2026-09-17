'use client';

import { useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { Camera, Check, Loader2, Pencil, Plus, RotateCcw, UserMinus, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cropToCircleDataUrl } from '@/lib/image/circle-crop';
import {
  createStaffMember,
  setStaffActive,
  updateStaffMember,
  uploadStaffPhoto,
} from '@/app/(app)/admin/staff/actions';

export type StaffRow = {
  id: string;
  fullName: string;
  title: string | null;
  photoUrl: string | null;
  isDentist: boolean;
  isActive: boolean;
  locations: string[];
};

export type ClinicOption = { slug: string; name: string };

type Draft = {
  fullName: string;
  title: string;
  isDentist: boolean;
  clinicSlugs: string[];
};

/** Turns a data URL back into a File so it can go through FormData. */
async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], filename, { type: blob.type });
}

export function StaffDirectory({
  staff,
  clinics,
}: {
  staff: StaffRow[];
  clinics: ClinicOption[];
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const active = staff.filter((s) => s.isActive);
  const retired = staff.filter((s) => !s.isActive);

  return (
    <div className="space-y-8">
      {adding ? (
        <StaffForm
          clinics={clinics}
          draft={{ fullName: '', title: '', isDentist: true, clinicSlugs: [] }}
          onDone={() => setAdding(false)}
        />
      ) : (
        <Button type="button" onClick={() => setAdding(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add a dentist
        </Button>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-400">
          {active.length} in the directory
        </h2>
        <ul className="space-y-2">
          {active.map((person) =>
            editingId === person.id ? (
              <li key={person.id}>
                <StaffForm
                  id={person.id}
                  clinics={clinics}
                  draft={{
                    fullName: person.fullName,
                    title: person.title ?? '',
                    isDentist: person.isDentist,
                    clinicSlugs: person.locations,
                  }}
                  onDone={() => setEditingId(null)}
                />
              </li>
            ) : (
              <StaffCard
                key={person.id}
                person={person}
                clinics={clinics}
                onEdit={() => setEditingId(person.id)}
              />
            )
          )}
        </ul>
      </section>

      {retired.length > 0 && (
        <section>
          <h2 className="mb-1 text-sm font-semibold text-slate-400">No longer listed</h2>
          <p className="mb-3 text-sm text-slate-500">
            They stay here so older treatment plans still show who they were from.
          </p>
          <ul className="space-y-2">
            {retired.map((person) => (
              <StaffCard key={person.id} person={person} clinics={clinics} onEdit={() => {}} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function StaffCard({
  person,
  clinics,
  onEdit,
}: {
  person: StaffRow;
  clinics: ClinicOption[];
  onEdit: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const clinicNames = person.locations
    .map((slug) => clinics.find((c) => c.slug === slug)?.name ?? slug)
    .join(', ');

  return (
    <li
      className={`flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border bg-white p-4 ${
        person.isActive ? '' : 'opacity-60'
      }`}
    >
      <Avatar person={person} />

      <div className="min-w-0 flex-1">
        <p className="font-medium text-sia-dark">{person.fullName}</p>
        <p className="text-sm text-slate-500">
          {person.title ? `${person.title} · ` : ''}
          {clinicNames || 'No clinic set'}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        {person.isActive && <PhotoButton id={person.id} hasPhoto={Boolean(person.photoUrl)} />}
        {person.isActive && (
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await setStaffActive(person.id, !person.isActive);
              if (!result.ok) toast.error(result.error ?? 'That did not work.');
              else
                toast.success(
                  person.isActive
                    ? `${person.fullName} removed from the list`
                    : `${person.fullName} is back in the list`
                );
            })
          }
        >
          {person.isActive ? (
            <>
              <UserMinus className="mr-2 h-4 w-4" /> Remove
            </>
          ) : (
            <>
              <RotateCcw className="mr-2 h-4 w-4" /> Bring back
            </>
          )}
        </Button>
      </div>
    </li>
  );
}

function Avatar({ person }: { person: StaffRow }) {
  if (person.photoUrl) {
    return (
      <Image
        src={person.photoUrl}
        alt=""
        width={48}
        height={48}
        className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-sia-teal/40"
        unoptimized
      />
    );
  }

  return (
    <span
      aria-hidden
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-400"
    >
      {person.fullName
        .replace(/^Dr\.?\s*/i, '')
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join('')}
    </span>
  );
}

function PhotoButton({ id, hasPhoto }: { id: string; hasPhoto: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      // Crop here, not on the server: the PDF renderer needs a circular PNG and
      // there is no canvas server-side. Doing it once at upload also means it is
      // not redone on every single download.
      const circleDataUrl = await cropToCircleDataUrl(URL.createObjectURL(file));
      const circle = await dataUrlToFile(circleDataUrl, 'circle.png');

      const formData = new FormData();
      formData.set('id', id);
      formData.set('original', file);
      formData.set('circle', circle);

      startTransition(async () => {
        const result = await uploadStaffPhoto(formData);
        if (!result.ok) toast.error(result.error ?? 'Could not upload that photo.');
        else toast.success('Photo updated');
      });
    } catch {
      toast.error('We could not read that image. Try a JPG or PNG.');
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
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
            <Camera className="mr-2 h-4 w-4" /> {hasPhoto ? 'Change photo' : 'Add photo'}
          </>
        )}
      </Button>
    </>
  );
}

function StaffForm({
  id,
  clinics,
  draft: initial,
  onDone,
}: {
  id?: string;
  clinics: ClinicOption[];
  draft: Draft;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const toggleClinic = (slug: string) =>
    setDraft((d) => ({
      ...d,
      clinicSlugs: d.clinicSlugs.includes(slug)
        ? d.clinicSlugs.filter((s) => s !== slug)
        : [...d.clinicSlugs, slug],
    }));

  const save = () => {
    setFieldErrors({});
    startTransition(async () => {
      const result = id ? await updateStaffMember(id, draft) : await createStaffMember(draft);

      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        if (result.error) toast.error(result.error);
        return;
      }

      toast.success(id ? 'Saved' : `${draft.fullName.trim()} added`);
      onDone();
    });
  };

  return (
    <div className="rounded-lg border border-sia-teal/40 bg-sia-teal/5 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`name-${id ?? 'new'}`}>Full name</Label>
          <Input
            id={`name-${id ?? 'new'}`}
            value={draft.fullName}
            onChange={(e) => setDraft((d) => ({ ...d, fullName: e.target.value }))}
            placeholder="Dr Siv Lengsavath"
          />
          {fieldErrors.fullName && (
            <p className="text-sm text-destructive">{fieldErrors.fullName}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`title-${id ?? 'new'}`}>
            Role <span className="font-normal text-slate-400">— optional</span>
          </Label>
          <Input
            id={`title-${id ?? 'new'}`}
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="Practice Manager"
          />
        </div>
      </div>

      <fieldset className="mt-4">
        <legend className="mb-2 text-sm font-medium">Which clinics do they work at?</legend>
        <div className="flex flex-wrap gap-2">
          {clinics.map((clinic) => {
            const checked = draft.clinicSlugs.includes(clinic.slug);
            return (
              <label
                key={clinic.slug}
                className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  checked
                    ? 'border-sia-teal bg-sia-teal/15 font-medium text-sia-dark'
                    : 'border-input bg-white text-slate-500 hover:text-sia-dark'
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={() => toggleClinic(clinic.slug)}
                />
                {clinic.name}
              </label>
            );
          })}
        </div>
        {fieldErrors.clinicSlugs && (
          <p className="mt-2 text-sm text-destructive">{fieldErrors.clinicSlugs}</p>
        )}
      </fieldset>

      <label className="mt-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.isDentist}
          onChange={(e) => setDraft((d) => ({ ...d, isDentist: e.target.checked }))}
        />
        Show them in the dentist list on a treatment plan
      </label>

      <div className="mt-5 flex gap-2">
        <Button type="button" size="sm" onClick={save} disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" /> Save
            </>
          )}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone} disabled={pending}>
          <X className="mr-2 h-4 w-4" /> Cancel
        </Button>
      </div>

      {!id && (
        <p className="mt-3 text-sm text-slate-500">
          Add them first, then their photo appears as an option on their row.
        </p>
      )}
    </div>
  );
}
