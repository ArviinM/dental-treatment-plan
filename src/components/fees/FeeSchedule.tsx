'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import Papa from 'papaparse';
import { Check, Loader2, Pencil, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createFeeItem,
  deleteFeeItem,
  importFeeItems,
  updateFeeItem,
  type ImportRow,
} from '@/app/(app)/fees/actions';

export type FeeRow = {
  id: string;
  code: string;
  name: string;
  description: string;
  fee: number;
};

type Draft = { code: string; name: string; description: string; fee: string };

const EMPTY: Draft = { code: '', name: '', description: '', fee: '' };

function money(value: number): string {
  return `$${value.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * The shared fee schedule.
 *
 * Search sits at the top because the common task is "what does item 011 cost",
 * not "browse 168 items". Editing happens in place rather than in a dialog, so
 * you can see the row you are changing next to the ones around it.
 */
export function FeeSchedule({ items, canDelete }: { items: FeeRow[]; canDelete: boolean }) {
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.code.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
    );
  }, [items, query]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by code, name or description"
            className="pl-9"
            aria-label="Search the fee schedule"
          />
        </div>
        <ImportButton />
        <Button type="button" onClick={() => setAdding(true)} disabled={adding}>
          <Plus className="mr-2 h-4 w-4" /> Add item
        </Button>
      </div>

      {adding && <EditorRow draft={EMPTY} onCancel={() => setAdding(false)} />}

      <p className="text-sm text-slate-400">
        {filtered.length === items.length
          ? `${items.length} items`
          : `${filtered.length} of ${items.length} items`}
      </p>

      <ul className="divide-y rounded-lg border bg-white">
        {filtered.map((item) =>
          editingId === item.id ? (
            <li key={item.id} className="p-4">
              <EditorRow
                id={item.id}
                draft={{ ...item, fee: String(item.fee) }}
                onCancel={() => setEditingId(null)}
              />
            </li>
          ) : (
            <li key={item.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 p-4">
              <code className="w-14 shrink-0 font-mono text-sm font-semibold text-sia-purple">
                {item.code}
              </code>
              <div className="min-w-48 flex-1">
                <p className="font-medium text-sia-dark">{item.name}</p>
                {item.description && (
                  <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{item.description}</p>
                )}
              </div>
              <span className="w-24 shrink-0 text-right font-medium tabular-nums text-sia-dark">
                {money(item.fee)}
              </span>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingId(item.id)}
                  aria-label={`Edit item ${item.code}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                {canDelete && <DeleteButton id={item.id} code={item.code} />}
              </div>
            </li>
          )
        )}

        {!filtered.length && (
          <li className="p-8 text-center text-sm text-slate-500">
            Nothing matches “{query}”. Try a different code or name.
          </li>
        )}
      </ul>
    </div>
  );
}

function EditorRow({
  id,
  draft: initial,
  onCancel,
}: {
  id?: string;
  draft: Draft;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const save = () => {
    setFieldErrors({});
    const values = {
      code: draft.code,
      name: draft.name,
      description: draft.description,
      fee: Number(draft.fee),
    };

    startTransition(async () => {
      const result = id ? await updateFeeItem(id, values) : await createFeeItem(values);

      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        if (result.error) toast.error(result.error);
        return;
      }

      toast.success(id ? `Item ${values.code} saved` : `Item ${values.code} added`);
      onCancel();
    });
  };

  const set = (key: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => ({ ...d, [key]: e.target.value }));

  return (
    <div className="rounded-lg border border-sia-teal/40 bg-sia-teal/5 p-4">
      <div className="grid gap-3 sm:grid-cols-[6rem_1fr_7rem]">
        <div className="space-y-1">
          <Label htmlFor={`code-${id ?? 'new'}`}>Code</Label>
          <Input id={`code-${id ?? 'new'}`} value={draft.code} onChange={set('code')} />
          {fieldErrors.code && <p className="text-xs text-destructive">{fieldErrors.code}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor={`name-${id ?? 'new'}`}>Name</Label>
          <Input id={`name-${id ?? 'new'}`} value={draft.name} onChange={set('name')} />
          {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor={`fee-${id ?? 'new'}`}>Fee</Label>
          <Input
            id={`fee-${id ?? 'new'}`}
            type="number"
            step="0.01"
            min="0"
            value={draft.fee}
            onChange={set('fee')}
          />
          {fieldErrors.fee && <p className="text-xs text-destructive">{fieldErrors.fee}</p>}
        </div>
      </div>

      <div className="mt-3 space-y-1">
        <Label htmlFor={`desc-${id ?? 'new'}`}>
          Description <span className="font-normal text-slate-400">— what the patient reads</span>
        </Label>
        <Input id={`desc-${id ?? 'new'}`} value={draft.description} onChange={set('description')} />
      </div>

      <div className="mt-4 flex gap-2">
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
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
          <X className="mr-2 h-4 w-4" /> Cancel
        </Button>
      </div>
    </div>
  );
}

function DeleteButton({ id, code }: { id: string; code: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setConfirming(true)}
        aria-label={`Remove item ${code}`}
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
            const result = await deleteFeeItem(id);
            if (!result.ok) {
              toast.error(result.error ?? 'Could not remove that item.');
              setConfirming(false);
              return;
            }
            toast.success(`Item ${code} removed`);
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

function ImportButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  const onFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data }) => {
        // Accept the column spellings that actually turn up in exports rather
        // than insisting on one exact header row.
        const rows: ImportRow[] = data.map((row) => {
          const get = (...keys: string[]) => {
            for (const key of keys) {
              const found = Object.keys(row).find((k) => k.trim().toLowerCase() === key);
              if (found && row[found]) return row[found];
            }
            return '';
          };

          return {
            code: get('code', 'item', 'item code', 'itemcode'),
            name: get('name', 'title', 'treatment'),
            description: get('description', 'desc', 'details'),
            fee: Number(String(get('fee', 'price', 'amount', 'cost')).replace(/[^0-9.]/g, '')),
          };
        });

        startTransition(async () => {
          const result = await importFeeItems(rows);
          if (!result.ok) {
            toast.error(result.error ?? 'Could not import that file.');
            return;
          }
          toast.success(
            `Imported: ${result.added} added, ${result.updated} updated. Nothing was removed.`
          );
        });
      },
      error: () => toast.error('We could not read that file. Is it a CSV?'),
    });

    event.target.value = '';
  };

  return (
    <>
      <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
      <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing…
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" /> Import CSV
          </>
        )}
      </Button>
    </>
  );
}
