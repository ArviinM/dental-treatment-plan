'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { invalidateTemplateLookup } from '@/lib/pdf/assets';

/**
 * Replacing the designed PDFs — the blank plan template, and the team page for
 * each clinic.
 *
 * Old rows are kept with is_active = false rather than overwritten. A bad
 * upload at 4pm on a Friday should be one click to undo, not a scramble to find
 * the original file.
 */

export type UploadResult = { ok: boolean; error?: string };

const MAX_BYTES = 25 * 1024 * 1024;

export async function uploadTemplate(formData: FormData): Promise<UploadResult> {
  const admin = await requireAdmin();

  const kind = String(formData.get('kind') ?? '');
  const clinicSlug = String(formData.get('clinicSlug') ?? '') || null;
  const file = formData.get('file');

  if (kind !== 'plan' && kind !== 'team') {
    return { ok: false, error: 'We did not recognise that template type.' };
  }

  if (!(file instanceof File)) return { ok: false, error: 'Choose a PDF to upload.' };
  if (file.type !== 'application/pdf') return { ok: false, error: 'That needs to be a PDF file.' };
  if (file.size > MAX_BYTES) {
    return { ok: false, error: 'That PDF is larger than 25 MB. Please compress it first.' };
  }

  const supabase = await createClient();

  let clinicId: string | null = null;
  let clinicName = '';

  if (kind === 'team') {
    if (!clinicSlug) return { ok: false, error: 'Choose which clinic this team page is for.' };

    const { data: clinic } = await supabase
      .from('clinics')
      .select('id, name')
      .eq('slug', clinicSlug)
      .maybeSingle();

    if (!clinic) return { ok: false, error: 'We could not find that clinic.' };
    clinicId = clinic.id;
    clinicName = clinic.name;
  }

  // New path each time so nothing is served from a stale cache.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const storagePath = `${kind}/${clinicSlug ?? 'shared'}/${stamp}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from('plan-templates')
    .upload(storagePath, file, { contentType: 'application/pdf', upsert: false });

  if (uploadError) return { ok: false, error: 'We could not upload that file. Please try again.' };

  // Stand the old one down first: a partial unique index allows only one active
  // template per slot, so inserting before deactivating would be rejected.
  const deactivate = supabase.from('templates').update({ is_active: false }).eq('kind', kind);
  await (clinicId ? deactivate.eq('clinic_id', clinicId) : deactivate.is('clinic_id', null));

  const { error } = await supabase.from('templates').insert({
    kind,
    clinic_id: clinicId,
    storage_path: storagePath,
    is_active: true,
    uploaded_by: admin.id,
  });

  if (error) return { ok: false, error: 'The file uploaded but we could not record it.' };

  await logActivity({
    action: 'template.upload',
    entityType: 'template',
    summary:
      kind === 'team'
        ? `The ${clinicName} team page was replaced`
        : 'The blank plan template was replaced',
    metadata: { kind, clinicSlug },
  });

  // The renderer memoises which template is current for a minute; without this
  // a warm function would keep serving the version just replaced.
  invalidateTemplateLookup();

  revalidatePath('/admin/templates');
  revalidatePath('/legacy');
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

  // The renderer memoises which template is current for a minute; without this
  // a warm function would keep serving the version just replaced.
  invalidateTemplateLookup();

  revalidatePath('/admin/templates');
  revalidatePath('/legacy');
  return { ok: true };
}
