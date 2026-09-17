import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import type { Location, TreatmentItem } from '@/types';

/**
 * Saved treatment plans.
 *
 * This is the only module that writes patient data, which is deliberate: it is
 * one layer to audit. See "Patient data and privacy" in the project plan — under
 * the Privacy Act 1988 (Cth) and the Health Records Act 2001 (Vic) this is
 * health information about identifiable people.
 *
 * Three rules hold everywhere in here:
 *
 *   1. Reads are logged, not just writes. A privacy incident is usually someone
 *      looking, and a write-only log would never see it.
 *   2. Nothing is hard deleted. Deletion goes through soft_delete_treatment_plan,
 *      which starts a retention clock instead of erasing the row.
 *   3. No patient name ever reaches console.error or a URL. Function logs sit
 *      outside the database's access controls.
 */

export type PlanSummary = {
  id: string;
  patientName: string;
  planDate: string;
  clinicName: string;
  clinicSlug: Location;
  dentistName: string;
  totalAmount: number;
  status: 'draft' | 'issued';
  updatedAt: string;
  createdByName: string | null;
};

export type PlanDetail = {
  id: string;
  patientName: string;
  planDate: string;
  clinicSlug: Location;
  dentistName: string;
  dentistId: string | null;
  totalAmount: number;
  status: 'draft' | 'issued';
  items: TreatmentItem[];
};

export type SavePlanInput = {
  /** Omitted when creating; present when updating an existing plan. */
  id?: string;
  patientName: string;
  planDate: string;
  clinicSlug: Location;
  dentistId: string | null;
  dentistName: string;
  totalAmount: number;
  status: 'draft' | 'issued';
  items: TreatmentItem[];
};

export type PlanResult = { ok: boolean; error?: string; id?: string };

/** Everyone signed in can see every plan; there is no clinic scoping. */
export async function listPlans(): Promise<PlanSummary[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('treatment_plans')
    .select(
      'id, patient_name, plan_date, dentist_name, total_amount, status, updated_at, clinics(name, slug), created_by_profile:profiles!treatment_plans_created_by_fkey(full_name)'
    )
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(200);

  return (data ?? []).map((row) => ({
    id: row.id,
    patientName: row.patient_name,
    planDate: row.plan_date,
    clinicName: row.clinics?.name ?? '',
    clinicSlug: (row.clinics?.slug ?? 'essendon') as Location,
    dentistName: row.dentist_name,
    totalAmount: Number(row.total_amount),
    status: row.status,
    updatedAt: row.updated_at,
    createdByName: row.created_by_profile?.full_name ?? null,
  }));
}

/**
 * Loads one plan for editing, and records that it was opened.
 *
 * The read log is the point: "who looked at this patient's plan" is the
 * question that matters after an incident, and it is unanswerable from a log
 * that only records changes.
 */
export async function getPlan(id: string): Promise<PlanDetail | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('treatment_plans')
    .select(
      'id, patient_name, plan_date, dentist_id, dentist_name, total_amount, status, clinics(slug), treatment_plan_items(id, phase, visit_no, item_code, times, description, tooth, sort_order, treatment_plan_item_fees(id, quantity, unit_fee, sort_order))'
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!data) return null;

  await logActivity({
    action: 'treatment_plan.read',
    entityType: 'treatment_plan',
    entityId: id,
    summary: `${data.patient_name}'s plan was opened`,
  });

  const items: TreatmentItem[] = (data.treatment_plan_items ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) => ({
      id: item.id,
      phase: item.phase,
      visitNo: item.visit_no,
      itemCode: item.item_code,
      times: item.times,
      description: item.description,
      tooth: item.tooth,
      fees: (item.treatment_plan_item_fees ?? [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((fee) => ({
          id: fee.id,
          quantity: Number(fee.quantity),
          unitFee: Number(fee.unit_fee),
        })),
    }));

  return {
    id: data.id,
    patientName: data.patient_name,
    planDate: data.plan_date,
    clinicSlug: (data.clinics?.slug ?? 'essendon') as Location,
    dentistName: data.dentist_name,
    dentistId: data.dentist_id,
    totalAmount: Number(data.total_amount),
    status: data.status,
    items,
  };
}

/**
 * Creates or updates a plan.
 *
 * Children are replaced wholesale rather than diffed. A treatment plan is a
 * handful of rows edited as one document, so reconciling row-by-row would be
 * more code and more ways to be subtly wrong for no benefit.
 */
export async function savePlan(input: SavePlanInput): Promise<PlanResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'You need to be signed in to save a plan.' };

  const patientName = input.patientName.trim();
  if (!patientName) return { ok: false, error: 'Add the patient’s name before saving.' };

  const supabase = await createClient();

  const { data: clinic } = await supabase
    .from('clinics')
    .select('id')
    .eq('slug', input.clinicSlug)
    .maybeSingle();

  if (!clinic) return { ok: false, error: 'We could not work out which clinic this is for.' };

  const row = {
    patient_name: patientName,
    plan_date: input.planDate,
    clinic_id: clinic.id,
    dentist_id: input.dentistId,
    dentist_name: input.dentistName,
    total_amount: input.totalAmount,
    status: input.status,
    updated_by: user.id,
  };

  let planId = input.id;
  const isNew = !planId;

  if (planId) {
    const { error } = await supabase.from('treatment_plans').update(row).eq('id', planId);
    if (error) return { ok: false, error: 'We could not save that plan. Please try again.' };
  } else {
    const { data, error } = await supabase
      .from('treatment_plans')
      .insert({ ...row, created_by: user.id })
      .select('id')
      .single();

    if (error || !data) return { ok: false, error: 'We could not save that plan. Please try again.' };
    planId = data.id;
  }

  // Replace the items. The cascade takes their fee lines with them.
  await supabase.from('treatment_plan_items').delete().eq('plan_id', planId);

  const usable = input.items.filter((item) => item.itemCode || item.description);

  if (usable.length) {
    const { data: inserted, error: itemsError } = await supabase
      .from('treatment_plan_items')
      .insert(
        usable.map((item, index) => ({
          plan_id: planId!,
          phase: item.phase,
          visit_no: item.visitNo,
          item_code: item.itemCode,
          times: item.times,
          description: item.description,
          tooth: item.tooth,
          sort_order: index,
        }))
      )
      .select('id');

    if (itemsError || !inserted) {
      return { ok: false, error: 'The plan saved but its treatments did not. Please try again.' };
    }

    const fees = usable.flatMap((item, index) =>
      (item.fees ?? []).map((fee, feeIndex) => ({
        item_id: inserted[index].id,
        quantity: fee.quantity,
        unit_fee: fee.unitFee,
        sort_order: feeIndex,
      }))
    );

    if (fees.length) await supabase.from('treatment_plan_item_fees').insert(fees);
  }

  await logActivity({
    action: isNew ? 'treatment_plan.create' : 'treatment_plan.update',
    entityType: 'treatment_plan',
    entityId: planId,
    summary: isNew
      ? `A treatment plan was created for ${patientName}`
      : `${patientName}'s treatment plan was updated`,
  });

  return { ok: true, id: planId };
}

/**
 * Removes a plan from everyday view and starts its retention clock.
 *
 * Goes through the database function rather than a delete: there is no DELETE
 * policy on treatment_plans at all, precisely so nothing can bypass retention.
 */
export async function softDeletePlan(id: string): Promise<PlanResult> {
  const supabase = await createClient();

  const { data: target } = await supabase
    .from('treatment_plans')
    .select('patient_name')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!target) return { ok: false, error: 'That plan has already been removed.' };

  const { error } = await supabase.rpc('soft_delete_treatment_plan', { p_plan_id: id });
  if (error) return { ok: false, error: 'We could not remove that plan. Please try again.' };

  await logActivity({
    action: 'treatment_plan.delete',
    entityType: 'treatment_plan',
    entityId: id,
    summary: `${target.patient_name}'s plan was removed from the list`,
  });

  return { ok: true, id };
}
