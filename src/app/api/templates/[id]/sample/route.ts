import { NextResponse } from 'next/server';

import { getCurrentUser, isAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getTemplateSettings } from '@/lib/data/reference';
import { generateTreatmentPlanPdf } from '@/lib/pdf/generate';
import { samplePlan } from '@/lib/pdf/sample-plan';
import type { Location } from '@/types';

/**
 * A sample plan rendered on one specific template — usually a draft.
 *
 * This is the check that would have caught the incident where an uploaded plan
 * template had its own table printed on it: it is the REAL renderer, on the
 * REAL file, before anyone else's plans use it. The canvas preview is a
 * convenience; this is the proof.
 *
 * Opened in a new tab (inline, not a download) so it can be looked at and
 * closed without leaving a file behind.
 */
export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'You need to be signed in.' }, { status: 401 });
  if (!isAdmin(user.role)) {
    return NextResponse.json({ error: 'Only an admin can check templates.' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await createClient();

  const { data: template } = await supabase
    .from('templates')
    .select('kind, storage_path, clinics(slug)')
    .eq('id', id)
    .maybeSingle();

  if (!template) return NextResponse.json({ error: 'That template no longer exists.' }, { status: 404 });

  // A team page is checked on a plan for its own clinic; the plan template on
  // any clinic, since it is shared.
  const location = (template.clinics?.slug ?? 'burwood') as Location;

  try {
    const bytes = await generateTreatmentPlanPdf({
      data: samplePlan(location),
      settings: await getTemplateSettings(),
      templateOverrides:
        template.kind === 'plan'
          ? { planPath: template.storage_path }
          : { teamPath: template.storage_path },
    });

    return new NextResponse(bytes as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="sample-plan.pdf"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    // Template id only — this route never touches patient data, but keep the
    // habit of logging identifiers rather than payloads.
    console.error('sample render failed for template', id, error instanceof Error ? error.message : '');
    return NextResponse.json({ error: 'Could not render a sample on that file.' }, { status: 500 });
  }
}
