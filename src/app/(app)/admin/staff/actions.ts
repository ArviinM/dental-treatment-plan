'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

/**
 * The dentist directory.
 *
 * Admin-only, and that takes nothing away: this list was hardcoded in
 * src/data/dentists.ts until now, so nobody could edit it at all. This is new
 * capability for Ericka rather than capability removed from her team.
 */

export type StaffActionResult = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  id?: string;
};

type StaffInput = {
  fullName: string;
  title: string;
  isDentist: boolean;
  /** Clinic slugs: essendon | burwood | mulgrave. Someone can work at several. */
  clinicSlugs: string[];
};

/** "Dr Siv Lengsavath" -> "dr-siv-lengsavath". Stable key, also used for photos. */
function slugify(fullName: string): string {
  return fullName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function validate(values: StaffInput): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  if (values.fullName.trim().length < 2) fieldErrors.fullName = 'Enter their full name.';
  if (!values.clinicSlugs.length) fieldErrors.clinicSlugs = 'Choose at least one clinic.';

  return fieldErrors;
}

/** Replaces the clinic links for one person. */
async function setClinics(
  supabase: Awaited<ReturnType<typeof createClient>>,
  staffMemberId: string,
  clinicSlugs: string[]
): Promise<void> {
  const { data: clinics } = await supabase
    .from('clinics')
    .select('id, slug')
    .in('slug', clinicSlugs);

  await supabase.from('staff_member_clinics').delete().eq('staff_member_id', staffMemberId);

  if (clinics?.length) {
    await supabase
      .from('staff_member_clinics')
      .insert(clinics.map((c) => ({ staff_member_id: staffMemberId, clinic_id: c.id })));
  }
}

export async function createStaffMember(values: StaffInput): Promise<StaffActionResult> {
  await requireAdmin();

  const fieldErrors = validate(values);
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };

  const supabase = await createClient();
  const fullName = values.fullName.trim();
  const slug = slugify(fullName);

  if (!slug) return { ok: false, fieldErrors: { fullName: 'Enter a name using letters.' } };

  const { data, error } = await supabase
    .from('staff_members')
    .insert({
      slug,
      full_name: fullName,
      title: values.title.trim() || null,
      is_dentist: values.isDentist,
    })
    .select('id')
    .single();

  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      return { ok: false, fieldErrors: { fullName: `${fullName} is already in the list.` } };
    }

    return { ok: false, error: 'We could not add them. Please try again.' };
  }

  await setClinics(supabase, data.id, values.clinicSlugs);

  await logActivity({
    action: 'staff_member.create',
    entityType: 'staff_member',
    entityId: data.id,
    summary: `${fullName} was added to the directory`,
    metadata: { clinics: values.clinicSlugs },
  });

  revalidatePath('/admin/staff');
  revalidatePath('/legacy');
  return { ok: true, id: data.id };
}

export async function updateStaffMember(
  id: string,
  values: StaffInput
): Promise<StaffActionResult> {
  await requireAdmin();

  const fieldErrors = validate(values);
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };

  const supabase = await createClient();
  const fullName = values.fullName.trim();

  const { error } = await supabase
    .from('staff_members')
    .update({
      full_name: fullName,
      title: values.title.trim() || null,
      is_dentist: values.isDentist,
    })
    .eq('id', id);

  if (error) return { ok: false, error: 'We could not save that change. Please try again.' };

  await setClinics(supabase, id, values.clinicSlugs);

  await logActivity({
    action: 'staff_member.update',
    entityType: 'staff_member',
    entityId: id,
    summary: `${fullName}'s details were updated`,
    metadata: { clinics: values.clinicSlugs },
  });

  revalidatePath('/admin/staff');
  revalidatePath('/legacy');
  return { ok: true, id };
}

/**
 * Retires or restores someone.
 *
 * Never a hard delete: plans already generated reference this row, and a
 * treatment plan handed to a patient last month must keep saying who it was
 * from. `is_active` hides them from the picker instead.
 */
export async function setStaffActive(id: string, isActive: boolean): Promise<StaffActionResult> {
  await requireAdmin();

  const supabase = await createClient();
  const { data: target } = await supabase
    .from('staff_members')
    .select('full_name')
    .eq('id', id)
    .maybeSingle();

  if (!target) return { ok: false, error: 'They are no longer in the directory.' };

  const { error } = await supabase
    .from('staff_members')
    .update({ is_active: isActive })
    .eq('id', id);

  if (error) return { ok: false, error: 'We could not change that. Please try again.' };

  await logActivity({
    action: isActive ? 'staff_member.restore' : 'staff_member.retire',
    entityType: 'staff_member',
    entityId: id,
    summary: `${target.full_name} was ${isActive ? 'brought back into' : 'removed from'} the directory`,
  });

  revalidatePath('/admin/staff');
  revalidatePath('/legacy');
  return { ok: true, id };
}

/**
 * Stores a staff photo.
 *
 * Two files arrive: the original, and a circular PNG the browser has already
 * cropped. The crop happens in the browser because the server has no canvas —
 * and doing it once at upload beats doing it on every PDF download, which is
 * what the old client-side renderer did.
 */
export async function uploadStaffPhoto(formData: FormData): Promise<StaffActionResult> {
  await requireAdmin();

  const id = String(formData.get('id') ?? '');
  const original = formData.get('original');
  const circle = formData.get('circle');

  if (!id) return { ok: false, error: 'Missing which person this photo is for.' };
  if (!(original instanceof File) || !(circle instanceof File)) {
    return { ok: false, error: 'That did not arrive as an image. Please try again.' };
  }

  // Re-checked here as well as on the bucket: a clear sentence beats a 413.
  if (original.size > 5 * 1024 * 1024) {
    return { ok: false, error: 'That photo is larger than 5 MB. Please use a smaller one.' };
  }

  const supabase = await createClient();
  const { data: target } = await supabase
    .from('staff_members')
    .select('slug, full_name')
    .eq('id', id)
    .maybeSingle();

  if (!target) return { ok: false, error: 'They are no longer in the directory.' };

  // A fresh random segment each time, so a replaced photo gets a new URL and
  // nobody is served a stale image out of a CDN or browser cache.
  const stamp = crypto.randomUUID().slice(0, 8);
  const originalExt = original.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const originalPath = `${target.slug}/${stamp}-original.${originalExt}`;
  const circlePath = `${target.slug}/${stamp}-circle.png`;

  const uploads = await Promise.all([
    supabase.storage
      .from('staff-photos')
      .upload(originalPath, original, { contentType: original.type, upsert: true }),
    supabase.storage
      .from('staff-photos')
      .upload(circlePath, circle, { contentType: 'image/png', upsert: true }),
  ]);

  if (uploads.some((u) => u.error)) {
    return { ok: false, error: 'We could not upload that photo. Please try again.' };
  }

  const { error } = await supabase
    .from('staff_members')
    .update({ photo_path: originalPath, photo_circle_path: circlePath })
    .eq('id', id);

  if (error) return { ok: false, error: 'The photo uploaded but we could not save it.' };

  await logActivity({
    action: 'staff_member.photo',
    entityType: 'staff_member',
    entityId: id,
    summary: `${target.full_name}'s photo was updated`,
  });

  revalidatePath('/admin/staff');
  revalidatePath('/legacy');
  return { ok: true, id };
}
