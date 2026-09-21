import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { env } from '@/lib/env';
import type { FeeItem, Location, TemplateSettings } from '@/types';
import { DEFAULT_TEMPLATE_SETTINGS, DEFAULT_TEMPLATE_PATHS } from '@/types';

/**
 * Reads the reference data the app used to hardcode.
 *
 * Everything here was a constant in src/data or src/types until Phase 3. The
 * shapes are unchanged on purpose: the plan builder is frozen, so it still
 * receives exactly the `FeeItem[]` and `TemplateSettings` it always did — the
 * values simply arrive from Postgres now instead of a bundled array.
 */

export type StaffMember = {
  id: string;
  slug: string;
  fullName: string;
  title: string | null;
  photoUrl: string | null;
  isDentist: boolean;
  isActive: boolean;
  locations: Location[];
};

export type Clinic = {
  id: string;
  slug: Location;
  name: string;
  website: string;
  phone: string;
  address: string;
};

/** Public storage URL for a staff photo. Built by hand rather than via
 *  getPublicUrl(), which would need a client instance just to concatenate. */
export function staffPhotoUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http') || path.startsWith('/')) return path;
  return `${env.supabaseUrl}/storage/v1/object/public/staff-photos/${path}`;
}

export async function getClinics(): Promise<Clinic[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('clinics')
    .select('id, slug, name, website, phone, address')
    .eq('is_active', true)
    .order('sort_order');

  return (data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug as Location,
    name: row.name,
    website: row.website,
    phone: row.phone,
    address: row.address,
  }));
}

/**
 * The dentist directory, with each person's clinics folded in.
 *
 * `includeInactive` is for the admin screen, which has to show a retired
 * dentist in order to bring them back. Everywhere else wants the live list.
 */
export async function getStaffMembers(
  { includeInactive = false } = {}
): Promise<StaffMember[]> {
  const supabase = await createClient();

  let query = supabase
    .from('staff_members')
    .select(
      'id, slug, full_name, title, photo_path, photo_circle_path, is_dentist, is_active, staff_member_clinics(clinics(slug))'
    )
    .order('sort_order');

  if (!includeInactive) query = query.eq('is_active', true);

  const { data } = await query;

  return (data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    fullName: row.full_name,
    title: row.title,
    // The circular derivative is what the PDF embeds and what the UI shows;
    // the original is kept only so a photo can be re-cropped later.
    photoUrl: staffPhotoUrl(row.photo_circle_path ?? row.photo_path),
    isDentist: row.is_dentist,
    isActive: row.is_active,
    locations: (row.staff_member_clinics ?? [])
      .map((link) => link.clinics?.slug as Location | undefined)
      .filter((slug): slug is Location => Boolean(slug)),
  }));
}

/** The shared fee schedule, in the exact shape the plan builder expects. */
export async function getFeeSchedule(): Promise<FeeItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('fee_items')
    .select('code, name, description, fee')
    .eq('is_active', true)
    .order('sort_order');

  return (data ?? []).map((row) => ({
    code: row.code,
    name: row.name,
    description: row.description,
    fee: Number(row.fee),
  }));
}

/**
 * Text positions and table metrics.
 *
 * Falls back to DEFAULT_TEMPLATE_SETTINGS if the singleton row is missing, so a
 * half-seeded database renders a correct PDF rather than throwing. The template
 * file paths are still the bundled ones — the renderer resolves those itself.
 */
export async function getTemplateSettings(): Promise<TemplateSettings> {
  const supabase = await createClient();
  const { data } = await supabase.from('template_settings').select('settings').maybeSingle();

  const stored = (data?.settings ?? {}) as Partial<TemplateSettings>;

  return {
    ...DEFAULT_TEMPLATE_SETTINGS,
    ...stored,
    coverPdf: DEFAULT_TEMPLATE_PATHS.coverPdf,
    treatmentPdf: DEFAULT_TEMPLATE_PATHS.treatmentPdf,
    teamPdfs: DEFAULT_TEMPLATE_PATHS.teamPdfs,
  };
}

/** Counts used by the setup checklist on the dashboard home. */
export async function getSetupCounts() {
  const supabase = await createClient();

  const [clinics, staff, fees, templates, accounts] = await Promise.all([
    supabase.from('clinics').select('id', { count: 'exact', head: true }),
    supabase.from('staff_members').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('fee_items').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('templates').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_active', true),
  ]);

  return {
    clinics: clinics.count ?? 0,
    staff: staff.count ?? 0,
    fees: fees.count ?? 0,
    templates: templates.count ?? 0,
    accounts: accounts.count ?? 0,
  };
}

// -----------------------------------------------------------------------------
// Template artwork for the live preview
// -----------------------------------------------------------------------------

/**
 * Preview images of whatever artwork is LIVE, for the canvas preview to paint.
 *
 * Every field is optional, and that is the fallback: anything missing means
 * "use the bundled original". So a slot with no upload, an upload made before
 * previews existed, or an image that fails to load all degrade to the original
 * artwork rather than to a blank page.
 */
export type TemplateBackgrounds = {
  cover?: string;
  treatment?: string;
  continuation?: string;
  team: Partial<Record<Location, string>>;
};

export function templatePreviewUrl(path: string): string {
  return `${env.supabaseUrl}/storage/v1/object/public/template-previews/${path}`;
}

/** Previews for one template row, laid out the way the canvas expects them. */
export function backgroundsFromPreviews(
  kind: 'plan' | 'team',
  clinicSlug: Location | null,
  previewPaths: string[]
): TemplateBackgrounds {
  const urls = previewPaths.map(templatePreviewUrl);

  if (kind === 'team') {
    return { team: clinicSlug && urls[0] ? { [clinicSlug]: urls[0] } : {} };
  }

  return { cover: urls[0], treatment: urls[1], continuation: urls[2], team: {} };
}

export async function getTemplateBackgrounds(): Promise<TemplateBackgrounds> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('templates')
    .select('kind, preview_paths, clinics(slug)')
    .eq('is_active', true);

  const backgrounds: TemplateBackgrounds = { team: {} };

  for (const row of data ?? []) {
    const slice = backgroundsFromPreviews(
      row.kind as 'plan' | 'team',
      (row.clinics?.slug ?? null) as Location | null,
      row.preview_paths
    );
    Object.assign(backgrounds, { ...slice, team: { ...backgrounds.team, ...slice.team } });
  }

  return backgrounds;
}
