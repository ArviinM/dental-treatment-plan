import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { getClinics, getTemplateSettings } from '@/lib/data/reference';
import { TemplateSettingsEditor } from '@/components/admin/TemplateSettingsEditor';
import { TemplateManager, type TemplateSlot } from '@/components/admin/TemplateManager';

export const metadata = { title: 'Templates | SIA Dental' };

export default async function TemplatesPage() {
  await requireAdmin();

  const supabase = await createClient();
  const [clinics, templateSettings, { data: templates }] = await Promise.all([
    getClinics(),
    getTemplateSettings(),
    supabase
      .from('templates')
      .select('id, kind, is_active, created_at, clinics(slug)')
      .order('created_at', { ascending: false }),
  ]);

  const versionsFor = (kind: 'plan' | 'team', clinicSlug: string | null) =>
    (templates ?? [])
      .filter((t) => t.kind === kind && (t.clinics?.slug ?? null) === clinicSlug)
      .map((t) => ({ id: t.id, createdAt: t.created_at, isActive: t.is_active }));

  const slots: TemplateSlot[] = [
    {
      kind: 'plan',
      clinicSlug: null,
      label: 'Plan pages',
      description:
        'The cover and the blank treatment pages. Patient details and the table are drawn on top of this.',
      versions: versionsFor('plan', null),
    },
    ...clinics.map((clinic) => ({
      kind: 'team' as const,
      clinicSlug: clinic.slug,
      label: `${clinic.name} team page`,
      description: `The page at the back of a ${clinic.name} plan, with the team's photos.`,
      versions: versionsFor('team', clinic.slug),
    })),
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-sia-dark">Templates</h1>
        <p className="mt-2 text-slate-500">
          The designed pages a treatment plan is built on. Replace one and the next plan uses it.
        </p>
      </header>

      <TemplateManager slots={slots} />

      <p className="mt-6 text-sm text-slate-500">
        Nothing is thrown away. Replacing a page keeps the old one, so if an upload turns out wrong
        you can put the previous version back.
      </p>

      <section className="mt-12">
        <h2 className="text-xl font-bold tracking-tight text-sia-dark">Where things sit</h2>
        <p className="mt-1 text-slate-500">
          The patient name, the dentist, their photo, and the treatment table — nudge any of them
          until they line up with your artwork.
        </p>

        <div className="mt-5">
          <TemplateSettingsEditor initial={templateSettings} />
        </div>
      </section>
    </div>
  );
}
