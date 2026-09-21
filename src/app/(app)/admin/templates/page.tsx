import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import {
  getClinics,
  getTemplateBackgrounds,
  getTemplateSettings,
  templatePreviewUrl,
} from '@/lib/data/reference';
import { TemplateSettingsEditor } from '@/components/admin/TemplateSettingsEditor';
import {
  TemplateManager,
  type TemplateSlot,
  type TemplateVersion,
} from '@/components/admin/TemplateManager';
import type { Location } from '@/types';

export const metadata = { title: 'Templates | SIA Dental' };

export default async function TemplatesPage() {
  await requireAdmin();

  const supabase = await createClient();
  const [clinics, templateSettings, liveBackgrounds, { data: templates }] = await Promise.all([
    getClinics(),
    getTemplateSettings(),
    getTemplateBackgrounds(),
    supabase
      .from('templates')
      .select('id, kind, is_active, published_at, created_at, preview_paths, clinics(slug)')
      .order('created_at', { ascending: false }),
  ]);

  const rowsFor = (kind: 'plan' | 'team', clinicSlug: Location | null) =>
    (templates ?? [])
      .filter((t) => t.kind === kind && ((t.clinics?.slug ?? null) as Location | null) === clinicSlug)
      .map(
        (t): TemplateVersion => ({
          id: t.id,
          createdAt: t.created_at,
          isActive: t.is_active,
          publishedAt: t.published_at,
          previewUrls: t.preview_paths.map(templatePreviewUrl),
        })
      );

  // Published versions are history; an unpublished one is the pending draft.
  const slotFor = (
    kind: 'plan' | 'team',
    clinicSlug: Location | null,
    label: string,
    description: string
  ): TemplateSlot => {
    const rows = rowsFor(kind, clinicSlug);
    return {
      kind,
      clinicSlug,
      label,
      description,
      versions: rows.filter((r) => r.publishedAt),
      draft: rows.find((r) => !r.publishedAt) ?? null,
    };
  };

  const slots: TemplateSlot[] = [
    slotFor(
      'plan',
      null,
      'Plan pages',
      'The cover and the blank treatment pages. Patient details and the table are drawn on top of this.'
    ),
    ...clinics.map((clinic) =>
      slotFor(
        'team',
        clinic.slug,
        `${clinic.name} team page`,
        // "a Essendon" reads wrong; pick the article from the clinic's first letter.
        `The page at the back of a${/^[AEIOU]/i.test(clinic.name) ? 'n' : ''} ${clinic.name} plan, with the team's photos.`
      )
    ),
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-sia-dark">Templates</h1>
        <p className="mt-2 text-slate-500">
          The designed pages a treatment plan is built on. A new upload waits for you to check it,
          and only goes live when you publish it.
        </p>
      </header>

      <TemplateManager slots={slots} settings={templateSettings} liveBackgrounds={liveBackgrounds} />

      <div className="mt-6 space-y-2 text-sm text-slate-500">
        <p>
          <strong className="font-medium text-sia-dark">For the plan pages, upload artwork only.</strong>{' '}
          The app writes the heading, the patient&apos;s name and the treatment table itself — if the
          Canva design already has those printed on it, they will appear twice. Team pages are used
          exactly as they are.
        </p>
        <p>
          Nothing is thrown away. Replacing a page keeps the old one, and &ldquo;use the
          original&rdquo; always goes back to the design that came with the app.
        </p>
      </div>

      <section className="mt-12">
        <h2 className="text-xl font-bold tracking-tight text-sia-dark">Where things sit</h2>
        <p className="mt-1 text-slate-500">
          The patient name, the dentist, their photo, and the treatment table — nudge any of them
          until they line up with your artwork.
        </p>

        <div className="mt-5">
          <TemplateSettingsEditor initial={templateSettings} backgrounds={liveBackgrounds} />
        </div>
      </section>
    </div>
  );
}
