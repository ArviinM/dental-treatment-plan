import { NextResponse } from 'next/server';
import { z } from 'zod';

import { generateTreatmentPlanPdf } from '@/lib/pdf/generate';
import { getCurrentUser } from '@/lib/auth';

/**
 * Renders a treatment plan to PDF.
 *
 * A Route Handler rather than a Server Action, because actions are a poor fit
 * for returning binary. The browser turns the response into a blob and hands it
 * to the existing `downloadPdf` helper, so the download itself is unchanged.
 *
 * Node runtime, not edge: the renderer reads fonts and templates off disk.
 *
 * Checks the session itself rather than trusting src/proxy.ts to have done it.
 * The proxy's matcher is a regex, and one careless edit to it would leave this
 * endpoint — which takes a patient's name and treatments in its body — open to
 * anyone. A route handler returns 401 rather than redirecting, because the
 * caller is fetch(), not a browser following a location header.
 */
export const runtime = 'nodejs';

const feeEntrySchema = z.object({
  id: z.string(),
  quantity: z.number(),
  unitFee: z.number(),
});

const treatmentItemSchema = z.object({
  id: z.string(),
  phase: z.number(),
  visitNo: z.number(),
  itemCode: z.string(),
  times: z.number(),
  description: z.string(),
  tooth: z.string(),
  fees: z.array(feeEntrySchema),
});

const positionSchema = z.object({ x: z.number(), y: z.number() });

const requestSchema = z.object({
  data: z.object({
    patientName: z.string(),
    doctorName: z.string(),
    // Must already be a circular PNG data URL — see lib/image/circle-crop.ts.
    doctorPhoto: z.string().startsWith('data:').optional(),
    date: z.string(),
    location: z.enum(['essendon', 'burwood', 'mulgrave']),
    items: z.array(treatmentItemSchema),
    totalAmount: z.number(),
  }),
  settings: z.object({
    patientNamePosition: positionSchema,
    patientNameFontSize: z.number(),
    doctorNamePosition: positionSchema,
    doctorNameFontSize: z.number(),
    doctorPhotoPosition: positionSchema.extend({ size: z.number() }),
    tableStartY: z.number(),
    tableMarginX: z.number(),
    rowHeight: z.number(),
    maxRowsPerPage: z.number(),
  }),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'You need to be signed in.' }, { status: 401 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'That treatment plan is missing something we need to render it.' },
      { status: 422 }
    );
  }

  try {
    // Template paths are resolved server-side now, so the client no longer
    // sends them; the generator's settings type still expects the fields.
    const pdfBytes = await generateTreatmentPlanPdf({
      data: parsed.data.data,
      settings: {
        ...parsed.data.settings,
        coverPdf: '',
        treatmentPdf: '',
        teamPdfs: { essendon: '', burwood: '', mulgrave: '' },
      },
    });

    return new NextResponse(pdfBytes as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(pdfBytes.length),
        // The bytes depend entirely on the posted body, so there is nothing
        // useful to cache between requests.
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Treatment plan render failed:', error);
    return NextResponse.json({ error: 'Could not generate the PDF.' }, { status: 500 });
  }
}
