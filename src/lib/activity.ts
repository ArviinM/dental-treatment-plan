import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

/**
 * Writes a line to the history Ericka reads.
 *
 * Deliberately action-level and written by hand at each call site, rather than
 * derived from database triggers. The trade is honest: a trigger cannot be
 * forgotten, but it also cannot say "Ericka replaced the Burwood team page".
 * Readability won, because the point of this log is that a non-technical person
 * can scan it.
 *
 * The consequence is that ANY write which skips these helpers leaves no trace.
 * So all writes go through the mutation modules under `src/lib` and the admin
 * actions — one layer to audit.
 *
 * Entries about a plan name the patient, which makes this table health
 * information. The insert trigger stamps `purge_after` on those rows so they
 * fall under the same retention clock as the plan itself.
 */

export type EntityType =
  | 'account'
  | 'fee_item'
  | 'staff_member'
  | 'template'
  | 'template_settings'
  | 'treatment_plan';

type LogInput = {
  action: string;
  entityType: EntityType;
  entityId?: string | null;
  /** One sentence, past tense, readable by someone non-technical. */
  summary: string;
  metadata?: Record<string, unknown>;
};

export async function logActivity({
  action,
  entityType,
  entityId,
  summary,
  metadata,
}: LogInput): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const supabase = await createClient();

  const { error } = await supabase.from('activity_log').insert({
    actor_id: user.id,
    actor_name: user.fullName,
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    summary,
    metadata: (metadata ?? {}) as never,
  });

  if (error) {
    // Never fail the user's actual work because the history write failed — they
    // changed a fee, and telling them it broke would be both wrong and alarming.
    // Log the code only: the summary may name a patient, and function logs sit
    // outside the database's access controls.
    console.error('activity_log insert failed', { action, entityType, code: error.code });
  }
}

/** Formats money the way the rest of the app does, for log summaries. */
export function formatFee(amount: number): string {
  return `$${amount.toLocaleString('en-AU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
