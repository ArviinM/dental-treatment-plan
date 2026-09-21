'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { requireUser, isAdmin } from '@/lib/auth';
import { formatFee, logActivity } from '@/lib/activity';

/**
 * Fee schedule edits. Admin-only.
 *
 * This started editable by the whole team, because the old app let anyone edit
 * prices and the rebuild tried not to take abilities away. Ericka asked for the
 * opposite: only she and the practice owner should change prices, which are the
 * one thing on a plan a patient is asked to agree to. Staff can still read every
 * fee — they need to, to build a plan.
 *
 * Row level security is the real boundary (see the fees_admin_only migration).
 * The check here exists so a staff member who somehow reaches an edit gets a
 * sentence rather than a database error, and is not redirected away mid-task —
 * which is what requireAdmin() would do from inside a server action.
 *
 * Every change is still recorded in the history, with the old value.
 */

export type FeeActionResult = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const ADMIN_ONLY: FeeActionResult = {
  ok: false,
  error: 'Only an admin can change the fee schedule.',
};

async function canEditFees(): Promise<boolean> {
  const user = await requireUser();
  return isAdmin(user.role);
}

type FeeInput = {
  code: string;
  name: string;
  description: string;
  fee: number;
};

function validate(values: FeeInput): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  if (!values.code.trim()) fieldErrors.code = 'Enter an item code.';
  if (!values.name.trim()) fieldErrors.name = 'Enter a short name.';
  if (!Number.isFinite(values.fee) || values.fee < 0) {
    fieldErrors.fee = 'Enter a fee of 0 or more.';
  }

  return fieldErrors;
}

export async function createFeeItem(values: FeeInput): Promise<FeeActionResult> {
  if (!(await canEditFees())) return ADMIN_ONLY;

  const fieldErrors = validate(values);
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };

  const supabase = await createClient();
  const code = values.code.trim();

  const { data, error } = await supabase
    .from('fee_items')
    .insert({
      code,
      name: values.name.trim(),
      description: values.description.trim(),
      fee: values.fee,
    })
    .select('id')
    .single();

  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      return { ok: false, fieldErrors: { code: `Item ${code} is already in the list.` } };
    }

    return { ok: false, error: 'We could not add that item. Please try again.' };
  }

  await logActivity({
    action: 'fee_item.create',
    entityType: 'fee_item',
    entityId: data.id,
    summary: `Item ${code} (${values.name.trim()}) was added at ${formatFee(values.fee)}`,
  });

  revalidatePath('/fees');
  revalidatePath('/legacy');
  return { ok: true };
}

export async function updateFeeItem(id: string, values: FeeInput): Promise<FeeActionResult> {
  if (!(await canEditFees())) return ADMIN_ONLY;

  const fieldErrors = validate(values);
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };

  const supabase = await createClient();

  // Read the old row first so the history line can say what actually changed.
  // "Maria changed item 011" is far less useful than "from $84.00 to $88.00".
  const { data: before } = await supabase
    .from('fee_items')
    .select('code, name, fee')
    .eq('id', id)
    .maybeSingle();

  if (!before) return { ok: false, error: 'That item no longer exists.' };

  const { error } = await supabase
    .from('fee_items')
    .update({
      code: values.code.trim(),
      name: values.name.trim(),
      description: values.description.trim(),
      fee: values.fee,
    })
    .eq('id', id);

  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      return { ok: false, fieldErrors: { code: 'Another item already uses that code.' } };
    }

    return { ok: false, error: 'We could not save that change. Please try again.' };
  }

  const oldFee = Number(before.fee);
  const summary =
    oldFee === values.fee
      ? `Item ${before.code} (${values.name.trim()}) was edited`
      : `Item ${before.code} changed from ${formatFee(oldFee)} to ${formatFee(values.fee)}`;

  await logActivity({
    action: 'fee_item.update',
    entityType: 'fee_item',
    entityId: id,
    summary,
    metadata: { from: oldFee, to: values.fee },
  });

  revalidatePath('/fees');
  revalidatePath('/legacy');
  return { ok: true };
}

export async function deleteFeeItem(id: string): Promise<FeeActionResult> {
  if (!(await canEditFees())) return ADMIN_ONLY;

  const supabase = await createClient();
  const { data: before } = await supabase
    .from('fee_items')
    .select('code, name')
    .eq('id', id)
    .maybeSingle();

  if (!before) return { ok: false, error: 'That item no longer exists.' };

  const { error } = await supabase.from('fee_items').delete().eq('id', id);
  if (error) return { ok: false, error: 'We could not remove that item. Please try again.' };

  await logActivity({
    action: 'fee_item.delete',
    entityType: 'fee_item',
    summary: `Item ${before.code} (${before.name}) was removed`,
  });

  revalidatePath('/fees');
  revalidatePath('/legacy');
  return { ok: true };
}

export type ImportRow = { code: string; name: string; description: string; fee: number };

/**
 * Bulk import from CSV.
 *
 * Upserts on `code`: an existing item is updated, a new one is added, and
 * nothing is ever deleted. A spreadsheet that happens to be missing a row must
 * not silently remove that treatment from the schedule.
 */
export async function importFeeItems(rows: ImportRow[]): Promise<FeeActionResult & { added?: number; updated?: number }> {
  if (!(await canEditFees())) return ADMIN_ONLY;

  if (!rows.length) return { ok: false, error: 'That file had no rows we could read.' };
  if (rows.length > 2000) return { ok: false, error: 'That file is too large — 2000 rows maximum.' };

  const supabase = await createClient();

  const { data: existing } = await supabase.from('fee_items').select('code');
  const existingCodes = new Set((existing ?? []).map((r) => r.code));

  const cleaned = rows
    .map((row) => ({
      code: String(row.code ?? '').trim(),
      name: String(row.name ?? '').trim(),
      description: String(row.description ?? '').trim(),
      fee: Number(row.fee),
    }))
    .filter((row) => row.code && row.name && Number.isFinite(row.fee) && row.fee >= 0);

  if (!cleaned.length) {
    return { ok: false, error: 'No usable rows. Check the file has code, name and fee columns.' };
  }

  const { error } = await supabase
    .from('fee_items')
    .upsert(cleaned, { onConflict: 'code', ignoreDuplicates: false });

  if (error) return { ok: false, error: 'We could not import that file. Please try again.' };

  const added = cleaned.filter((row) => !existingCodes.has(row.code)).length;
  const updated = cleaned.length - added;

  await logActivity({
    action: 'fee_item.import',
    entityType: 'fee_item',
    summary: `The fee schedule was imported: ${added} added, ${updated} updated`,
    metadata: { added, updated },
  });

  revalidatePath('/fees');
  revalidatePath('/legacy');
  return { ok: true, added, updated };
}
