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
 * THE FILE NEVER PASSES THROUGH THIS SERVER. It used to, and that broke in
 * production: server actions reject request bodies over 1 MB, and a fresh Canva
 * export of a team page is 2–5 MB. Raising the limit is not a fix either, because
 * Vercel caps function request bodies at 4.5 MB regardless.
 *
 * So an upload is three steps:
 *
 *   1. prepareTemplateUpload  — checks the caller is an admin, and issues a
 *                               signed URL for exactly one path
 *   2. the browser uploads    — straight to Supabase Storage, any size up to the
 *                               bucket's 25 MB limit
 *   3. finalizeTemplateUpload — opens the file, checks it is actually usable,
 *                               and only then makes it the active template
 *
 * Old rows are kept with is_active = false rather than overwritten, so a bad
 * upload is one click to undo.
 */

export type UploadResult = { ok: boolean; error?: string };

export type PreparedUpload =
  | { ok: true; path: string; token: string }
  | { ok: false; error: string };

type Kind = 'plan' | 'team';

const BUCKET = 'plan-templates';
const MAX_BYTES = 25 * 1024 * 1024;

function folderFor(kind: Kind, clinicSlug: string | null): string {
  return `${kind}/${clinicSlug ?? 'shared'}/`;
}

async function resolveClinic(
  supabase: Awaited<ReturnType<typeof createClient>>,
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

/** Step 1. Nothing is uploaded yet — this only decides whether it may be. */
export async function prepareTemplateUpload(input: {
  kind: string;
  clinicSlug: string | null;
  fileName: string;
  fileType: string;
  fileSize: number;
}): Promise<PreparedUpload> {
  await requireAdmin();

  if (input.kind !== 'plan' && input.kind !== 'team') {
    return { ok: false, error: 'We did not recognise that template type.' };
  }

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
  const path = `${folderFor(input.kind, input.clinicSlug)}${stamp}.pdf`;

  // Issued with the ADMIN's own client, not the service role, so the bucket's
  // upload policy is still what decides. The URL is good for this one path only.
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);

  if (error || !data) {
    return { ok: false, error: 'We could not start that upload. Please try again.' };
  }

  return { ok: true, path: data.path, token: data.token };
}

/** Step 3. The file is in storage; decide whether it becomes the live template. */
export async function finalizeTemplateUpload(input: {
  kind: string;
  clinicSlug: string | null;
  path: string;
}): Promise<UploadResult> {
  const admin = await requireAdmin();

  if (input.kind !== 'plan' && input.kind !== 'team') {
    return { ok: false, error: 'We did not recognise that template type.' };
  }

  // The path comes back from the browser, so it cannot be trusted to point
  // where step 1 said it would. Without this, a caller could promote any object
  // in the bucket to be the live template for a different clinic.
  const folder = folderFor(input.kind, input.clinicSlug);
  if (!input.path.startsWith(folder) || input.path.includes('..')) {
    return { ok: false, error: 'That upload did not match what was expected. Please try again.' };
  }

  const supabase = await createClient();
  const clinic = await resolveClinic(supabase, input.kind, input.clinicSlug);
  if ('error' in clinic) return { ok: false, error: clinic.error };

  // Throw away the uploaded object when it turns out to be unusable, so a
  // rejected upload does not linger in the bucket.
  const discard = async (error: string): Promise<UploadResult> => {
    await supabase.storage.from(BUCKET).remove([input.path]);
    return { ok: false, error };
  };

  const { data: blob, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(input.path);

  if (downloadError || !blob) {
    return { ok: false, error: 'The upload did not arrive. Please try again.' };
  }

  // Open it for real, and refuse it if it is not usable. The checks live in
  // lib/pdf/validate-template so they can be tested against real files.
  const check = await validateTemplatePdf(
    new Uint8Array(await blob.arrayBuffer()),
    input.kind
  );
  if (!check.ok) return discard(check.error);
  const pageCount = check.pageCount;

  // Stand the old one down first: a partial unique index allows only one active
  // template per slot, so inserting before deactivating would be rejected.
  const deactivate = supabase.from('templates').update({ is_active: false }).eq('kind', input.kind);
  await (clinic.id ? deactivate.eq('clinic_id', clinic.id) : deactivate.is('clinic_id', null));

  const { error } = await supabase.from('templates').insert({
    kind: input.kind,
    clinic_id: clinic.id,
    storage_path: input.path,
    page_count: pageCount,
    is_active: true,
    uploaded_by: admin.id,
  });

  if (error) return discard('The file uploaded but we could not save it. Please try again.');

  await logActivity({
    action: 'template.upload',
    entityType: 'template',
    summary:
      input.kind === 'team'
        ? `The ${clinic.name} team page was replaced`
        : 'The blank plan template was replaced',
    metadata: { kind: input.kind, clinicSlug: input.clinicSlug, pageCount },
  });

  // The renderer memoises which template is current for a minute; without this
  // a warm function would keep serving the version just replaced.
  invalidateTemplateLookup();

  revalidatePath('/admin/templates');
  revalidatePath('/legacy');
  revalidatePath('/plans', 'layout');
  return { ok: true };
}

/** Puts a previous version back. The current one is stood down in its place. */
export async function restoreTemplate(id: string): Promise<UploadResult> {
  await requireAdmin();

  const supabase = await createClient();
  const { data: target } = await supabase
    .from('templates')
    .select('id, kind, clinic_id, clinics(name)')
    .eq('id', id)
    .maybeSingle();

  if (!target) return { ok: false, error: 'That version no longer exists.' };

  const deactivate = supabase.from('templates').update({ is_active: false }).eq('kind', target.kind);
  await (target.clinic_id
    ? deactivate.eq('clinic_id', target.clinic_id)
    : deactivate.is('clinic_id', null));

  const { error } = await supabase.from('templates').update({ is_active: true }).eq('id', id);
  if (error) return { ok: false, error: 'We could not restore that version.' };

  await logActivity({
    action: 'template.restore',
    entityType: 'template',
    entityId: id,
    summary:
      target.kind === 'team'
        ? `An earlier ${target.clinics?.name ?? ''} team page was restored`.replace('  ', ' ')
        : 'An earlier blank plan template was restored',
  });

  invalidateTemplateLookup();

  revalidatePath('/admin/templates');
  revalidatePath('/legacy');
  revalidatePath('/plans', 'layout');
  return { ok: true };
}
