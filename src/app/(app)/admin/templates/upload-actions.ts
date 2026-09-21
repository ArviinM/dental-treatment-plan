'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { invalidateTemplateLookup } from '@/lib/pdf/assets';
import { validateTemplatePdf } from '@/lib/pdf/validate-template';

/**
 * Replacing the designed PDFs — the blank plan template, and the team page for
 * each clinic.
 *
 * Two production incidents shaped this file.
 *
 * FIRST: uploads failed outright. The PDF was sent through a server action,
 * which rejects bodies over 1 MB, and a Canva export is 2-10 MB. So the file
 * never passes through this server: the browser uploads straight to storage
 * against a signed URL, and the server only authorises and records.
 *
 * SECOND: an upload went live that broke every plan. The Canva master had its
 * own table and heading printed on it, so the app's were drawn on top of them.
 * It was live for everyone the instant it landed, and the preview showed the
 * old artwork so nothing looked wrong. So uploads now land as DRAFTS:
 *
 *   prepare  -> the browser uploads the PDF and preview images
 *   finalize -> the file is opened and checked, and stored as a draft
 *   ...the admin looks at a real sample plan on it...
 *   publish  -> only now does it affect anyone's plans
 *
 * And there is always a way back: publish keeps the previous version, restore
 * puts it back, and "use the original design" drops back to the file that ships
 * with the app — the one thing guaranteed to render.
 */

export type UploadResult = { ok: boolean; error?: string };

type SignedUpload = { path: string; token: string };

export type PreparedUpload =
  | { ok: true; pdf: SignedUpload; previews: SignedUpload[] }
  | { ok: false; error: string };

export type FinalizedUpload = { ok: true; draftId: string } | { ok: false; error: string };

type Kind = 'plan' | 'team';
type Supabase = Awaited<ReturnType<typeof createClient>>;

const PDF_BUCKET = 'plan-templates';
const PREVIEW_BUCKET = 'template-previews';
const MAX_BYTES = 25 * 1024 * 1024;

/** Cover, treatment, continuation for a plan; the one team page for a team. */
const PREVIEW_COUNT: Record<Kind, number> = { plan: 3, team: 1 };

function isKind(value: string): value is Kind {
  return value === 'plan' || value === 'team';
}

function folderFor(kind: Kind, clinicSlug: string | null): string {
  return `${kind}/${clinicSlug ?? 'shared'}/`;
}

/** team/burwood/2026-...Z.pdf -> team/burwood/2026-...Z/ — where its previews live. */
function previewFolderFor(pdfPath: string): string {
  return `${pdfPath.replace(/\.pdf$/, '')}/`;
}

function isInside(path: string, folder: string): boolean {
  return path.startsWith(folder) && !path.includes('..');
}

async function resolveClinic(
  supabase: Supabase,
  kind: Kind,
  clinicSlug: string | null
): Promise<{ id: string | null; name: string } | { error: string }> {
  if (kind === 'plan') return { id: null, name: '' };
  if (!clinicSlug) return { error: 'Choose which clinic this team page is for.' };

  const { data: clinic } = await supabase
    .from('clinics')
    .select('id, name')
    .eq('slug', clinicSlug)
    .maybeSingle();

  return clinic ? { id: clinic.id, name: clinic.name } : { error: 'We could not find that clinic.' };
}

function slotLabel(kind: Kind, clinicName: string): string {
  return kind === 'team' ? `the ${clinicName} team page` : 'the plan template';
}

/** Removes a template's files from both buckets. Best effort: never throws. */
async function removeFiles(supabase: Supabase, pdfPath: string, previewPaths: string[]) {
  await supabase.storage.from(PDF_BUCKET).remove([pdfPath]);
  if (previewPaths.length) await supabase.storage.from(PREVIEW_BUCKET).remove(previewPaths);
}

function afterChange() {
  // The renderer memoises which template is current for a minute; without this
  // a warm function would keep serving the version just replaced.
  invalidateTemplateLookup();
  revalidatePath('/admin/templates');
  revalidatePath('/legacy');
  revalidatePath('/plans', 'layout');
}

// -----------------------------------------------------------------------------
// Upload: prepare, then finalize as a draft
// -----------------------------------------------------------------------------

/** Nothing is uploaded yet — this only decides whether it may be. */
export async function prepareTemplateUpload(input: {
  kind: string;
  clinicSlug: string | null;
  fileName: string;
  fileType: string;
  fileSize: number;
}): Promise<PreparedUpload> {
  await requireAdmin();

  if (!isKind(input.kind)) return { ok: false, error: 'We did not recognise that template type.' };

  // Checked here as well as in the browser: a client can lie about both.
  const looksLikePdf =
    input.fileType === 'application/pdf' || input.fileName.toLowerCase().endsWith('.pdf');
  if (!looksLikePdf) return { ok: false, error: 'That needs to be a PDF file.' };

  if (input.fileSize > MAX_BYTES) {
    return {
      ok: false,
      error: `That PDF is ${(input.fileSize / 1048576).toFixed(1)} MB — the limit is 25 MB. Try exporting it from Canva at a lower quality.`,
    };
  }

  const supabase = await createClient();
  const clinic = await resolveClinic(supabase, input.kind, input.clinicSlug);
  if ('error' in clinic) return { ok: false, error: clinic.error };

  // A fresh path every time, so nothing is ever served from a stale cache.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const pdfPath = `${folderFor(input.kind, input.clinicSlug)}${stamp}.pdf`;
  const previewFolder = previewFolderFor(pdfPath);

  // Issued with the ADMIN's own client, not the service role, so the buckets'
  // upload policies still decide. Each URL is good for its one path only.
  const [pdf, ...previews] = await Promise.all([
    supabase.storage.from(PDF_BUCKET).createSignedUploadUrl(pdfPath),
    ...Array.from({ length: PREVIEW_COUNT[input.kind] }, (_, i) =>
      supabase.storage.from(PREVIEW_BUCKET).createSignedUploadUrl(`${previewFolder}${i}.png`)
    ),
  ]);

  if (pdf.error || !pdf.data || previews.some((p) => p.error || !p.data)) {
    return { ok: false, error: 'We could not start that upload. Please try again.' };
  }

  return {
    ok: true,
    pdf: { path: pdf.data.path, token: pdf.data.token },
    previews: previews.map((p) => ({ path: p.data!.path, token: p.data!.token })),
  };
}

/** The files are in storage. Check them, and keep them as a draft. */
export async function finalizeTemplateUpload(input: {
  kind: string;
  clinicSlug: string | null;
  path: string;
  previewPaths: string[];
}): Promise<FinalizedUpload> {
  const admin = await requireAdmin();

  if (!isKind(input.kind)) return { ok: false, error: 'We did not recognise that template type.' };
  const kind = input.kind;

  // Paths come back from the browser, so they cannot be trusted to point where
  // prepare said they would. Without this a caller could promote any object in
  // the bucket to be the live template for a different clinic.
  const previewFolder = previewFolderFor(input.path);
  const pathsOk =
    isInside(input.path, folderFor(kind, input.clinicSlug)) &&
    input.path.endsWith('.pdf') &&
    input.previewPaths.length === PREVIEW_COUNT[kind] &&
    input.previewPaths.every((p) => isInside(p, previewFolder));

  if (!pathsOk) {
    return { ok: false, error: 'That upload did not match what was expected. Please try again.' };
  }

  const supabase = await createClient();
  const clinic = await resolveClinic(supabase, kind, input.clinicSlug);
  if ('error' in clinic) return { ok: false, error: clinic.error };

  const discard = async (error: string): Promise<FinalizedUpload> => {
    await removeFiles(supabase, input.path, input.previewPaths);
    return { ok: false, error };
  };

  const { data: blob, error: downloadError } = await supabase.storage
    .from(PDF_BUCKET)
    .download(input.path);

  if (downloadError || !blob) return discard('The upload did not arrive. Please try again.');

  // Open it for real. The checks live in lib/pdf/validate-template so they can
  // be tested against real files.
  const check = await validateTemplatePdf(new Uint8Array(await blob.arrayBuffer()), kind);
  if (!check.ok) return discard(check.error);

  // One pending draft per slot. Uploading again replaces the previous draft
  // rather than stacking them up — a draft never went live, so it is not history.
  const draftsQuery = supabase
    .from('templates')
    .select('id, storage_path, preview_paths')
    .eq('kind', kind)
    .is('published_at', null);
  const { data: oldDrafts } = await (clinic.id
    ? draftsQuery.eq('clinic_id', clinic.id)
    : draftsQuery.is('clinic_id', null));

  for (const draft of oldDrafts ?? []) {
    await removeFiles(supabase, draft.storage_path, draft.preview_paths);
    await supabase.from('templates').delete().eq('id', draft.id);
  }

  const { data: row, error } = await supabase
    .from('templates')
    .insert({
      kind,
      clinic_id: clinic.id,
      storage_path: input.path,
      preview_paths: input.previewPaths,
      page_count: check.pageCount,
      // A draft: NOT live, and not yet published.
      is_active: false,
      published_at: null,
      uploaded_by: admin.id,
    })
    .select('id')
    .single();

  if (error || !row) return discard('The file uploaded but we could not save it. Please try again.');

  await logActivity({
    action: 'template.draft',
    entityType: 'template',
    entityId: row.id,
    summary: `A new version of ${slotLabel(kind, clinic.name)} was uploaded and is waiting to be checked`,
    metadata: { kind, clinicSlug: input.clinicSlug, pageCount: check.pageCount },
  });

  revalidatePath('/admin/templates');
  return { ok: true, draftId: row.id };
}

// -----------------------------------------------------------------------------
// Draft decisions
// -----------------------------------------------------------------------------

async function loadTemplate(supabase: Supabase, id: string) {
  const { data } = await supabase
    .from('templates')
    .select('id, kind, clinic_id, storage_path, preview_paths, is_active, published_at, clinics(name)')
    .eq('id', id)
    .maybeSingle();
  return data;
}

/** Stands down whatever is live in a slot. */
async function deactivateSlot(supabase: Supabase, kind: Kind, clinicId: string | null) {
  const query = supabase.from('templates').update({ is_active: false }).eq('kind', kind).eq('is_active', true);
  await (clinicId ? query.eq('clinic_id', clinicId) : query.is('clinic_id', null));
}

/** Makes a checked draft the live template. The previous one is kept. */
export async function publishTemplate(id: string): Promise<UploadResult> {
  await requireAdmin();
  const supabase = await createClient();

  const target = await loadTemplate(supabase, id);
  if (!target) return { ok: false, error: 'That draft no longer exists.' };
  if (target.published_at) return { ok: false, error: 'That version has already been published.' };

  const kind = target.kind as Kind;

  // Stand the old one down first: a partial unique index allows only one active
  // template per slot, so activating before deactivating would be rejected.
  await deactivateSlot(supabase, kind, target.clinic_id);

  const { error } = await supabase
    .from('templates')
    .update({ is_active: true, published_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { ok: false, error: 'We could not publish that. Please try again.' };

  await logActivity({
    action: 'template.publish',
    entityType: 'template',
    entityId: id,
    summary: `A new version of ${slotLabel(kind, target.clinics?.name ?? '')} was published`,
  });

  afterChange();
  return { ok: true };
}

/** Throws a draft away. It never went live, so it leaves nothing behind. */
export async function discardTemplateDraft(id: string): Promise<UploadResult> {
  await requireAdmin();
  const supabase = await createClient();

  const target = await loadTemplate(supabase, id);
  if (!target) return { ok: true };
  if (target.published_at) {
    return { ok: false, error: 'That version has been published, so it cannot be discarded.' };
  }

  await removeFiles(supabase, target.storage_path, target.preview_paths);
  const { error } = await supabase.from('templates').delete().eq('id', id);
  if (error) return { ok: false, error: 'We could not discard that draft. Please try again.' };

  await logActivity({
    action: 'template.discard',
    entityType: 'template',
    summary: `A draft of ${slotLabel(target.kind as Kind, target.clinics?.name ?? '')} was discarded`,
  });

  revalidatePath('/admin/templates');
  return { ok: true };
}

/**
 * Goes back to the design that ships with the app.
 *
 * The uploaded versions are all kept — this only stops using them. It is the
 * reliable way back from anything, because the bundled file is the one template
 * guaranteed to render.
 */
export async function revertToOriginalTemplate(input: {
  kind: string;
  clinicSlug: string | null;
}): Promise<UploadResult> {
  await requireAdmin();
  if (!isKind(input.kind)) return { ok: false, error: 'We did not recognise that template type.' };

  const supabase = await createClient();
  const clinic = await resolveClinic(supabase, input.kind, input.clinicSlug);
  if ('error' in clinic) return { ok: false, error: clinic.error };

  await deactivateSlot(supabase, input.kind, clinic.id);

  await logActivity({
    action: 'template.use_original',
    entityType: 'template',
    summary: `${slotLabel(input.kind, clinic.name).replace(/^the /, 'The ')} was switched back to the original design`,
  });

  afterChange();
  return { ok: true };
}

/** Puts a previously published version back. The current one is kept. */
export async function restoreTemplate(id: string): Promise<UploadResult> {
  await requireAdmin();
  const supabase = await createClient();

  const target = await loadTemplate(supabase, id);
  if (!target) return { ok: false, error: 'That version no longer exists.' };
  if (!target.published_at) {
    return { ok: false, error: 'That is a draft — check it and publish it instead.' };
  }

  const kind = target.kind as Kind;
  await deactivateSlot(supabase, kind, target.clinic_id);

  const { error } = await supabase.from('templates').update({ is_active: true }).eq('id', id);
  if (error) return { ok: false, error: 'We could not put that version back.' };

  await logActivity({
    action: 'template.restore',
    entityType: 'template',
    entityId: id,
    summary: `An earlier version of ${slotLabel(kind, target.clinics?.name ?? '')} was put back`,
  });

  afterChange();
  return { ok: true };
}
