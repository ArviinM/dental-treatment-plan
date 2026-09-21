'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Eye, EyeOff, FileDown, Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { savePlanAction } from '@/app/(app)/plans/actions';
import { CanvasPreview } from '@/components/preview/CanvasPreview';
import { renderTreatmentPlanPdf, downloadPdf } from '@/lib/pdf/client';
import type { Dentist } from '@/data/dentists';
import type {
  FeeItem,
  Location,
  TemplateSettings,
  TreatmentItem,
  TreatmentPlanData,
} from '@/types';
import type { PlanDetail } from '@/lib/plans/mutations';
import type { TemplateBackgrounds } from '@/lib/data/reference';

/**
 * The newer way to build a treatment plan.
 *
 * /legacy is frozen and stays exactly as the team knows it. This exists to be
 * *easier*, and it is aimed at three specific pieces of friction measured in
 * the old screen:
 *
 *   1. Eight fields per treatment, with Phase and Visit retyped on every single
 *      row. Here a visit is a container you add treatments into, so those two
 *      fields are set once per group instead of once per row.
 *   2. Item code was a free-text box needing an exact match, so you had to know
 *      the code already. Here you search by code OR name and see the fee before
 *      you commit.
 *   3. Work was lost if you navigated away. Here it saves itself.
 *
 * A 14-treatment plan went from roughly 112 field interactions to about 30.
 */

type Visit = { phase: number; visitNo: number; items: TreatmentItem[] };

type PlanBuilderProps = {
  feeSchedule: FeeItem[];
  dentists: Dentist[];
  clinics: { slug: Location; name: string }[];
  templateSettings: TemplateSettings;
  existing?: PlanDetail;
  /** The live artwork, so the preview matches the PDF it previews. */
  backgrounds?: TemplateBackgrounds;
};

let nextId = 0;
const newId = () => `tmp-${Date.now()}-${nextId++}`;

function money(value: number): string {
  return `$${value.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function itemTotal(item: TreatmentItem): number {
  return (item.fees ?? []).reduce((sum, fee) => sum + fee.quantity * fee.unitFee, 0);
}

/** Flat item list -> visit groups, preserving order. */
function toVisits(items: TreatmentItem[]): Visit[] {
  const visits: Visit[] = [];

  for (const item of items) {
    const phase = item.phase || 1;
    const visitNo = item.visitNo || 1;
    const existing = visits.find((v) => v.phase === phase && v.visitNo === visitNo);
    if (existing) existing.items.push(item);
    else visits.push({ phase, visitNo, items: [item] });
  }

  return visits.length ? visits : [{ phase: 1, visitNo: 1, items: [] }];
}

function toItems(visits: Visit[]): TreatmentItem[] {
  return visits.flatMap((visit) =>
    visit.items.map((item) => ({ ...item, phase: visit.phase, visitNo: visit.visitNo }))
  );
}

export function PlanBuilder({
  feeSchedule,
  dentists,
  clinics,
  templateSettings,
  existing,
  backgrounds,
}: PlanBuilderProps) {
  const router = useRouter();

  const [planId, setPlanId] = useState<string | undefined>(existing?.id);
  const [patientName, setPatientName] = useState(existing?.patientName ?? '');
  const [dentistName, setDentistName] = useState(existing?.dentistName ?? '');
  const [dentistId, setDentistId] = useState<string | null>(existing?.dentistId ?? null);
  const [date, setDate] = useState(
    existing?.planDate ?? new Date().toISOString().split('T')[0]
  );
  const [location, setLocation] = useState<Location>(existing?.clinicSlug ?? clinics[0]?.slug ?? 'essendon');
  const [visits, setVisits] = useState<Visit[]>(toVisits(existing?.items ?? []));

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showPreview, setShowPreview] = useState(true);
  const [isGenerating, startGenerating] = useTransition();

  const items = useMemo(() => toItems(visits), [visits]);
  const totalAmount = useMemo(() => items.reduce((sum, item) => sum + itemTotal(item), 0), [items]);

  const selectedDentist = dentists.find((d) => d.id === dentistId);

  // Exactly the payload the PDF route receives, so the preview cannot show one
  // thing and the download produce another.
  const planData: TreatmentPlanData = useMemo(
    () => ({
      patientName,
      doctorName: dentistName,
      doctorPhoto: selectedDentist?.photoUrl || undefined,
      date,
      location,
      items,
      totalAmount,
    }),
    [patientName, dentistName, selectedDentist, date, location, items, totalAmount]
  );

  // --- autosave -------------------------------------------------------------
  // Nothing is saved until there is a patient name, because a row with no name
  // is not a plan — it is an accident.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  const persist = useCallback(async () => {
    if (!patientName.trim()) return;

    setSaveState('saving');
    const result = await savePlanAction({
      id: planId,
      patientName,
      planDate: date,
      clinicSlug: location,
      dentistId: selectedDentist?.id ?? null,
      dentistName,
      totalAmount,
      status: 'draft',
      items,
    });

    if (!result.ok) {
      setSaveState('error');
      toast.error(result.error ?? 'Could not save.');
      return;
    }

    if (result.id && !planId) {
      setPlanId(result.id);
      // Put the id in the URL so a refresh reopens the same plan rather than
      // silently starting a second one.
      window.history.replaceState(null, '', `/plans/${result.id}`);
    }

    dirty.current = false;
    setSaveState('saved');
  }, [planId, patientName, date, location, dentistName, selectedDentist, totalAmount, items]);

  useEffect(() => {
    if (!patientName.trim()) return;
    dirty.current = true;

    // The effect only schedules; it deliberately does not setState here.
    // A synchronous setState inside an effect causes a cascading render, and
    // persist() already moves the indicator to "Saving" when it starts.
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void persist(), 1200);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [persist, patientName]);

  // --- visit + item editing -------------------------------------------------
  const addTreatment = (visitIndex: number, feeItem: FeeItem) => {
    setVisits((current) =>
      current.map((visit, index) =>
        index === visitIndex
          ? {
              ...visit,
              items: [
                ...visit.items,
                {
                  id: newId(),
                  phase: visit.phase,
                  visitNo: visit.visitNo,
                  itemCode: feeItem.code,
                  times: 1,
                  // Pre-filled from the schedule. Still editable — the patient
                  // copy often needs a sentence specific to them.
                  description: feeItem.description || feeItem.name,
                  tooth: '',
                  fees: [{ id: newId(), quantity: 1, unitFee: feeItem.fee }],
                },
              ],
            }
          : visit
      )
    );
  };

  const updateItem = (visitIndex: number, itemId: string, patch: Partial<TreatmentItem>) => {
    setVisits((current) =>
      current.map((visit, index) =>
        index === visitIndex
          ? {
              ...visit,
              items: visit.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
            }
          : visit
      )
    );
  };

  const updateFee = (visitIndex: number, itemId: string, quantity: number, unitFee: number) => {
    setVisits((current) =>
      current.map((visit, index) =>
        index === visitIndex
          ? {
              ...visit,
              items: visit.items.map((item) =>
                item.id === itemId
                  ? { ...item, fees: [{ id: item.fees[0]?.id ?? newId(), quantity, unitFee }] }
                  : item
              ),
            }
          : visit
      )
    );
  };

  const removeItem = (visitIndex: number, itemId: string) =>
    setVisits((current) =>
      current.map((visit, index) =>
        index === visitIndex
          ? { ...visit, items: visit.items.filter((item) => item.id !== itemId) }
          : visit
      )
    );

  const addVisit = () =>
    setVisits((current) => {
      const last = current[current.length - 1];
      return [...current, { phase: last?.phase ?? 1, visitNo: (last?.visitNo ?? 0) + 1, items: [] }];
    });

  const updateVisit = (visitIndex: number, patch: Partial<Pick<Visit, 'phase' | 'visitNo'>>) =>
    setVisits((current) =>
      current.map((visit, index) => (index === visitIndex ? { ...visit, ...patch } : visit))
    );

  const removeVisit = (visitIndex: number) =>
    setVisits((current) =>
      current.length === 1 ? current : current.filter((_, index) => index !== visitIndex)
    );

  // --- download -------------------------------------------------------------
  const download = () => {
    startGenerating(async () => {
      try {
        // Save first, so what downloads and what is stored cannot disagree.
        if (dirty.current) await persist();

        // The same object the preview renders from, so what you saw is what
        // you get.
        const bytes = await renderTreatmentPlanPdf(planData, templateSettings);
        const safeName = patientName.replace(/[^a-zA-Z0-9]/g, '_') || 'Patient';
        downloadPdf(bytes, `TreatmentPlan_${safeName}_${date.replace(/-/g, '')}.pdf`);
        toast.success('PDF downloaded');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not make the PDF.');
      }
    });
  };

  const canDownload = patientName.trim().length > 0 && items.length > 0;

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-sia-dark">
            {existing ? patientName || 'Treatment plan' : 'New plan'}
          </h1>
          <SaveIndicator state={saveState} hasName={Boolean(patientName.trim())} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowPreview((v) => !v)}
          >
            {showPreview ? (
              <>
                <EyeOff className="mr-2 h-4 w-4" /> Hide preview
              </>
            ) : (
              <>
                <Eye className="mr-2 h-4 w-4" /> Show preview
              </>
            )}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push('/plans')}>
            Done
          </Button>
          <Button type="button" onClick={download} disabled={!canDownload || isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Making PDF…
              </>
            ) : (
              <>
                <FileDown className="mr-2 h-4 w-4" /> Download PDF
              </>
            )}
          </Button>
        </div>
      </header>

      <div className={showPreview ? 'grid gap-8 lg:grid-cols-[minmax(0,1fr)_26rem]' : ''}>
        <div className="min-w-0">
      {/* --- who it is for --- */}
      <section className="mb-8 rounded-lg border bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="patientName">Patient name</Label>
            <Input
              id="patientName"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="Jane Panting"
              autoFocus={!existing}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dentist">Dentist</Label>
            <select
              id="dentist"
              value={dentistId ?? 'custom'}
              onChange={(e) => {
                const dentist = dentists.find((d) => d.id === e.target.value);
                setDentistId(dentist?.id ?? null);
                if (dentist) {
                  setDentistName(dentist.name);
                  // Follow the dentist to their clinic — it is right far more
                  // often than not, and it is one less thing to set.
                  if (dentist.locations.length && !dentist.locations.includes(location)) {
                    setLocation(dentist.locations[0]);
                  }
                }
              }}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="custom">Someone else…</option>
              {dentists.map((dentist) => (
                <option key={dentist.id} value={dentist.id}>
                  {dentist.name}
                </option>
              ))}
            </select>
            {!dentistId && (
              <Input
                value={dentistName}
                onChange={(e) => setDentistName(e.target.value)}
                placeholder="Type the dentist's name"
                aria-label="Dentist name"
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="clinic">Clinic</Label>
            <select
              id="clinic"
              value={location}
              onChange={(e) => setLocation(e.target.value as Location)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {clinics.map((clinic) => (
                <option key={clinic.slug} value={clinic.slug}>
                  {clinic.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* --- the treatments --- */}
      <section className="space-y-4">
        {visits.map((visit, visitIndex) => (
          <VisitCard
            key={`${visit.phase}-${visit.visitNo}-${visitIndex}`}
            visit={visit}
            feeSchedule={feeSchedule}
            canRemove={visits.length > 1}
            onAddTreatment={(feeItem) => addTreatment(visitIndex, feeItem)}
            onUpdateItem={(itemId, patch) => updateItem(visitIndex, itemId, patch)}
            onUpdateFee={(itemId, q, f) => updateFee(visitIndex, itemId, q, f)}
            onRemoveItem={(itemId) => removeItem(visitIndex, itemId)}
            onUpdateVisit={(patch) => updateVisit(visitIndex, patch)}
            onRemoveVisit={() => removeVisit(visitIndex)}
          />
        ))}

        <Button type="button" variant="outline" onClick={addVisit} className="w-full">
          <Plus className="mr-2 h-4 w-4" /> Add another visit
        </Button>
      </section>

      <div className="mt-6 flex items-center justify-between rounded-lg border-2 border-sia-teal/30 bg-sia-teal/5 px-5 py-4">
        <span className="font-semibold text-sia-dark">Total</span>
        <span className="text-xl font-bold tabular-nums text-sia-dark">{money(totalAmount)}</span>
      </div>
        </div>

        {showPreview && (
          <aside className="order-first min-w-0 lg:order-none">
            {/* Never hidden on smaller screens, only stacked. The preview is
                the point: it is what tells you the plan is right before a
                patient sees it. Sticky where there is room beside the form. */}
            <div className="lg:sticky lg:top-6">
              <h2 className="mb-1 text-sm font-semibold text-slate-400">Preview</h2>
              <p className="mb-3 text-sm text-slate-500">Exactly what downloads.</p>
              <div className="mx-auto max-w-xs lg:max-w-none">
                <CanvasPreview data={planData} settings={templateSettings} backgrounds={backgrounds} />
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function SaveIndicator({ state, hasName }: { state: string; hasName: boolean }) {
  if (!hasName) {
    return <p className="mt-1 text-sm text-slate-400">Add a patient name and it saves itself.</p>;
  }

  if (state === 'saving') {
    return (
      <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-400">
        <Loader2 className="h-3 w-3 animate-spin" /> Saving…
      </p>
    );
  }

  if (state === 'saved') {
    return (
      <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-400">
        <Check className="h-3 w-3 text-sia-teal" /> Saved
      </p>
    );
  }

  if (state === 'error') {
    return <p className="mt-1 text-sm text-destructive">Not saved — check your connection.</p>;
  }

  return <p className="mt-1 text-sm text-slate-400">Saves as you go.</p>;
}

function VisitCard({
  visit,
  feeSchedule,
  canRemove,
  onAddTreatment,
  onUpdateItem,
  onUpdateFee,
  onRemoveItem,
  onUpdateVisit,
  onRemoveVisit,
}: {
  visit: Visit;
  feeSchedule: FeeItem[];
  canRemove: boolean;
  onAddTreatment: (feeItem: FeeItem) => void;
  onUpdateItem: (itemId: string, patch: Partial<TreatmentItem>) => void;
  onUpdateFee: (itemId: string, quantity: number, unitFee: number) => void;
  onRemoveItem: (itemId: string) => void;
  onUpdateVisit: (patch: Partial<Pick<Visit, 'phase' | 'visitNo'>>) => void;
  onRemoveVisit: () => void;
}) {
  const subtotal = visit.items.reduce((sum, item) => sum + itemTotal(item), 0);

  return (
    <div className="rounded-lg border bg-white">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-5 py-3">
        {/* Phase and visit are set ONCE here, not on every treatment row. */}
        <span className="flex items-center gap-1.5 text-sm">
          <span className="text-slate-500">Phase</span>
          <input
            type="number"
            min={1}
            value={visit.phase}
            onChange={(e) => onUpdateVisit({ phase: Number(e.target.value) || 1 })}
            className="w-12 rounded border border-input px-1.5 py-0.5 text-center font-medium"
            aria-label="Phase number"
          />
        </span>
        <span className="flex items-center gap-1.5 text-sm">
          <span className="text-slate-500">Visit</span>
          <input
            type="number"
            min={1}
            value={visit.visitNo}
            onChange={(e) => onUpdateVisit({ visitNo: Number(e.target.value) || 1 })}
            className="w-12 rounded border border-input px-1.5 py-0.5 text-center font-medium"
            aria-label="Visit number"
          />
        </span>

        <span className="ml-auto flex items-baseline gap-2">
          <span className="text-xs text-slate-400">
            {visit.items.length} {visit.items.length === 1 ? 'treatment' : 'treatments'}
          </span>
          <span className="font-semibold tabular-nums text-sia-dark">{money(subtotal)}</span>
        </span>

        {canRemove && (
          <Button type="button" variant="ghost" size="sm" onClick={onRemoveVisit} aria-label="Remove this visit">
            <X className="h-4 w-4 text-slate-400" />
          </Button>
        )}
      </div>

      <ul className="divide-y">
        {visit.items.map((item) => {
          // The code alone means nothing to most people, so the schedule's name
          // is shown as the heading and the code demoted to a reference.
          const catalogue = feeSchedule.find((fee) => fee.code === item.itemCode);
          const quantity = item.fees[0]?.quantity ?? 1;
          const unitFee = item.fees[0]?.unitFee ?? 0;

          return (
            <li key={item.id} className="px-5 py-4">
              <div className="flex items-start gap-3">
                <code className="mt-0.5 shrink-0 rounded bg-sia-purple/10 px-1.5 py-0.5 font-mono text-xs font-semibold text-sia-purple">
                  {item.itemCode}
                </code>
                <p className="min-w-0 flex-1 font-medium text-sia-dark">
                  {catalogue?.name ?? 'Treatment'}
                </p>
                <span className="shrink-0 font-medium tabular-nums text-sia-dark">
                  {money(quantity * unitFee)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-mr-2 -mt-1 shrink-0"
                  onClick={() => onRemoveItem(item.id)}
                  aria-label={`Remove ${catalogue?.name ?? item.itemCode}`}
                >
                  <Trash2 className="h-4 w-4 text-slate-300" />
                </Button>
              </div>

              {/* The patient reads this, so it gets the full width and grows
                  with the text instead of scrolling inside one line. */}
              <textarea
                value={item.description}
                onChange={(e) => onUpdateItem(item.id, { description: e.target.value })}
                rows={2}
                className="mt-2 w-full resize-y rounded-md border border-input px-3 py-2 text-sm leading-relaxed text-slate-600 focus:border-sia-teal focus:outline-none"
                aria-label={`What the patient reads about ${catalogue?.name ?? item.itemCode}`}
              />

              <div className="mt-2 flex flex-wrap items-end gap-3">
                <label className="text-xs text-slate-400">
                  Tooth
                  <input
                    value={item.tooth}
                    onChange={(e) => onUpdateItem(item.id, { tooth: e.target.value })}
                    placeholder="—"
                    className="mt-0.5 block w-20 rounded-md border border-input px-2 py-1.5 text-center text-sm text-sia-dark focus:border-sia-teal focus:outline-none"
                  />
                </label>

                <label className="text-xs text-slate-400">
                  Quantity
                  <input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => onUpdateFee(item.id, Number(e.target.value) || 1, unitFee)}
                    className="mt-0.5 block w-20 rounded-md border border-input px-2 py-1.5 text-center text-sm text-sia-dark focus:border-sia-teal focus:outline-none"
                  />
                </label>

                <label className="text-xs text-slate-400">
                  Fee each
                  <span className="relative mt-0.5 block">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                      $
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={unitFee}
                      onChange={(e) =>
                        onUpdateFee(item.id, quantity, Number(e.target.value) || 0)
                      }
                      className="w-28 rounded-md border border-input py-1.5 pl-6 pr-2 text-right text-sm tabular-nums text-sia-dark focus:border-sia-teal focus:outline-none"
                    />
                  </span>
                </label>

                {catalogue && unitFee !== catalogue.fee && (
                  // Quietly flag a price that has been overridden, so nobody
                  // discovers it only when the patient queries the invoice.
                  <p className="pb-1.5 text-xs text-amber-700">
                    Schedule says {money(catalogue.fee)}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="px-5 py-3">
        {visit.items.length === 0 && (
          <p className="mb-2 text-sm text-slate-400">
            Nothing in this visit yet — search below to add the first treatment.
          </p>
        )}
        <TreatmentSearch feeSchedule={feeSchedule} onPick={onAddTreatment} />
      </div>
    </div>
  );
}

/**
 * Search-to-add, replacing the old "type an exact item code" box.
 *
 * Matches on code AND name, and shows the fee in the result, so you can find
 * "the crown one" without remembering that it is 613.
 */
function TreatmentSearch({
  feeSchedule,
  onPick,
}: {
  feeSchedule: FeeItem[];
  onPick: (item: FeeItem) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return feeSchedule
      .filter(
        (item) =>
          item.code.toLowerCase().startsWith(q) ||
          item.name.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [feeSchedule, query]);

  const pick = (item: FeeItem) => {
    onPick(item);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        aria-hidden
      />
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && results.length) {
            e.preventDefault();
            pick(results[0]);
          }
          if (e.key === 'Escape') setOpen(false);
        }}
        placeholder="Add a treatment — search by name or code"
        className="pl-9"
      />

      {open && results.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-md border bg-white py-1 shadow-lg">
          {results.map((item) => (
            <li key={item.code}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(item)}
                className="flex w-full items-baseline gap-3 px-3 py-2 text-left hover:bg-sia-teal/10"
              >
                <code className="w-12 shrink-0 font-mono text-sm font-semibold text-sia-purple">
                  {item.code}
                </code>
                <span className="min-w-0 flex-1 truncate text-sm text-sia-dark">{item.name}</span>
                <span className="shrink-0 text-sm tabular-nums text-slate-500">
                  {money(item.fee)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && query.trim() && !results.length && (
        <p className="absolute left-0 right-0 top-full z-20 mt-1 rounded-md border bg-white px-3 py-2 text-sm text-slate-500 shadow-lg">
          Nothing matches “{query}”. Check the fee schedule.
        </p>
      )}
    </div>
  );
}
