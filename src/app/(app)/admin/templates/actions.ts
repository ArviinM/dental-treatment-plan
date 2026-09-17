'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import type { TemplateSettings } from '@/types';

export type TemplateActionResult = { ok: boolean; error?: string };

/**
 * Saves the shared text positions and table metrics.
 *
 * This is the one capability that narrowed in the rebuild. These settings used
 * to live in each person's localStorage, so a tweak affected only them; shared
 * in the database, one person's adjustment would change everyone's PDFs. So it
 * is admin-only, and RLS enforces that regardless of what the UI allows.
 *
 * Only the positioning fields are stored. Where the template FILES live is the
 * templates table's business, and the renderer resolves those itself.
 */
export async function saveTemplateSettings(
  settings: TemplateSettings
): Promise<TemplateActionResult> {
  const admin = await requireAdmin();

  const stored = {
    patientNamePosition: settings.patientNamePosition,
    patientNameFontSize: settings.patientNameFontSize,
    doctorNamePosition: settings.doctorNamePosition,
    doctorNameFontSize: settings.doctorNameFontSize,
    doctorPhotoPosition: settings.doctorPhotoPosition,
    tableStartY: settings.tableStartY,
    tableMarginX: settings.tableMarginX,
    rowHeight: settings.rowHeight,
    maxRowsPerPage: settings.maxRowsPerPage,
  };

  const supabase = await createClient();
  const { error } = await supabase
    .from('template_settings')
    .upsert(
      { id: true, settings: stored as never, updated_by: admin.id, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    );

  if (error) return { ok: false, error: 'We could not save those settings. Please try again.' };

  // Safe to log per call because the caller debounces: one entry per edit, not
  // one per keystroke.
  await logActivity({
    action: 'template_settings.update',
    entityType: 'template_settings',
    summary: 'The plan layout settings were changed',
    metadata: stored,
  });

  revalidatePath('/legacy');
  revalidatePath('/admin/templates');
  return { ok: true };
}
