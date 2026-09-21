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
 * Staff photos: prepare, upload direct from the browser, then finalize.
 *
 * The file used to travel through a server action, which rejects request bodies
 * over 1 MB — and a photo straight off a phone is routinely 2-5 MB. That is the
 * same failure that broke template uploads in production, so photos go straight
 * from the browser to storage too, and the server only authorises and records.
 *
 * Two files are stored: the original, and a circular PNG the browser has already
 * cropped. The crop happens in the browser because the server has no canvas, and
 * doing it once here beats redoing it on every PDF download.
 */

const PHOTO_BUCKET = 'staff-photos';
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export type PreparedPhotoUpload =
  | {
      ok: true;
      original: { path: string; token: string };
      circle: { path: string; token: string };
    }
  | { ok: false; error: string };

export async function prepareStaffPhotoUpload(input: {
  id: string;
  fileType: string;
  fileSize: number;
}): Promise<PreparedPhotoUpload> {
  await requireAdmin();

  const ext = PHOTO_TYPES[input.fileType];
  if (!ext) return { ok: false, error: 'That needs to be a JPG, PNG or WebP photo.' };

  if (input.fileSize > PHOTO_MAX_BYTES) {
    return {
      ok: false,
      error: `That photo is ${(input.fileSize / 1048576).toFixed(1)} MB — the limit is 5 MB. A screenshot of it, or a smaller export, will do.`,
    };
  }

  const supabase = await createClient();
  const { data: target } = await supabase
    .from('staff_members')
    .select('slug')
    .eq('id', input.id)
    .maybeSingle();

  if (!target) return { ok: false, error: 'They are no longer in the directory.' };

  // A fresh random segment each time, so a replaced photo gets a new URL and
  // nobody is served a stale image out of a CDN or browser cache.
  const stamp = crypto.randomUUID().slice(0, 8);
  const bucket = supabase.storage.from(PHOTO_BUCKET);

  // Issued with the admin's own client so the bucket's upload policy decides.
  const [original, circle] = await Promise.all([
    bucket.createSignedUploadUrl(`${target.slug}/${stamp}-original.${ext}`),
    bucket.createSignedUploadUrl(`${target.slug}/${stamp}-circle.png`),
  ]);

  if (original.error || !original.data || circle.error || !circle.data) {
    return { ok: false, error: 'We could not start that upload. Please try again.' };
  }

  return {
    ok: true,
    original: { path: original.data.path, token: original.data.token },
    circle: { path: circle.data.path, token: circle.data.token },
  };
}

export async function finalizeStaffPhotoUpload(input: {
  id: string;
  originalPath: string;
  circlePath: string;
}): Promise<StaffActionResult> {
  await requireAdmin();

  const supabase = await createClient();
  const { data: target } = await supabase
    .from('staff_members')
    .select('slug, full_name')
    .eq('id', input.id)
    .maybeSingle();

  if (!target) return { ok: false, error: 'They are no longer in the directory.' };

  // The paths come back from the browser. Both must sit in THIS person's folder,
  // or a caller could attach someone else's photo to them.
  const folder = `${target.slug}/`;
  const inFolder = (path: string) => path.startsWith(folder) && !path.includes('..');

  if (!inFolder(input.originalPath) || !inFolder(input.circlePath)) {
    return { ok: false, error: 'That upload did not match what was expected. Please try again.' };
  }

  const { error } = await supabase
    .from('staff_members')
    .update({ photo_path: input.originalPath, photo_circle_path: input.circlePath })
    .eq('id', input.id);

  if (error) return { ok: false, error: 'The photo uploaded but we could not save it.' };

  await logActivity({
    action: 'staff_member.photo',
    entityType: 'staff_member',
    entityId: input.id,
    summary: `${target.full_name}'s photo was updated`,
  });

  revalidatePath('/admin/staff');
  revalidatePath('/legacy');
  revalidatePath('/plans', 'layout');
  return { ok: true, id: input.id };
}
