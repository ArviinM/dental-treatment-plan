'use server';

import { revalidatePath } from 'next/cache';

import { requireUser } from '@/lib/auth';
import { savePlan, softDeletePlan, type PlanResult, type SavePlanInput } from '@/lib/plans/mutations';

/**
 * Thin wrappers around src/lib/plans/mutations.ts.
 *
 * The logic lives in the mutation module rather than here so it can be driven
 * directly by a test: a server action needs `cookies()`, which makes it awkward
 * to call outside a request.
 */

export async function savePlanAction(input: SavePlanInput): Promise<PlanResult> {
  await requireUser();

  const result = await savePlan(input);
  if (result.ok) {
    revalidatePath('/plans');
    if (result.id) revalidatePath(`/plans/${result.id}`);
  }

  return result;
}

export async function deletePlanAction(id: string): Promise<PlanResult> {
  await requireUser();

  const result = await softDeletePlan(id);
  if (result.ok) revalidatePath('/plans');

  return result;
}
