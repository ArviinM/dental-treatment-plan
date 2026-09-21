import { PDFDocument } from 'pdf-lib';

import { PDF_PAGE_HEIGHT, PDF_PAGE_WIDTH } from '@/lib/pdf/layout';

/**
 * Decides whether an uploaded PDF can become a live template.
 *
 * Kept as a plain function, separate from the server action that calls it, so
 * it can be tested against real files. The action needs a signed-in admin to
 * run at all; this does not, which means the checks that actually decide
 * whether Ericka's upload is accepted are exercised directly, on her own PDFs.
 */

export type TemplateKind = 'plan' | 'team';

export type TemplateCheck =
  | { ok: true; pageCount: number }
  | { ok: false; error: string };

/**
 * How far a page may be from 810 x 1440 pt before it is rejected. Canva exports
 * can come out a fraction of a point off; a genuinely different page size is
 * hundreds of points off.
 */
const SIZE_TOLERANCE_PT = 2;

export async function validateTemplatePdf(
  bytes: Uint8Array,
  kind: TemplateKind
): Promise<TemplateCheck> {
  let pageCount: number;
  let firstPage: { width: number; height: number };

  try {
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    pageCount = pdf.getPageCount();
    firstPage = pdf.getPage(0).getSize();
  } catch {
    // Previously a file that failed to parse was accepted, then silently
    // ignored at render time in favour of the bundled template — which would
    // have looked to Ericka like her upload "did nothing".
    return {
      ok: false,
      error: 'That file could not be opened as a PDF. Try exporting it again from Canva.',
    };
  }

  if (pageCount < 1) {
    return { ok: false, error: 'That PDF has no pages.' };
  }

  if (kind === 'plan') {
    // The cover, then the first treatment page. A third, the continuation page,
    // is optional — the renderer reuses page two when it is absent.
    if (pageCount < 2) {
      return {
        ok: false,
        error: `The plan template needs at least 2 pages (the cover, then the treatment page). This one has ${pageCount}.`,
      };
    }

    // Every text position is an absolute coordinate on an 810 x 1440 page. A
    // template at another size would put the patient's name in the wrong place
    // on every plan, so it is refused rather than accepted and quietly wrong.
    const offWidth = Math.abs(firstPage.width - PDF_PAGE_WIDTH) > SIZE_TOLERANCE_PT;
    const offHeight = Math.abs(firstPage.height - PDF_PAGE_HEIGHT) > SIZE_TOLERANCE_PT;

    if (offWidth || offHeight) {
      return {
        ok: false,
        error: `The plan template must be 810 × 1440 pt (11.25 × 20 in), the same size as the Canva design. This one is ${Math.round(firstPage.width)} × ${Math.round(firstPage.height)} pt.`,
      };
    }
  }

  // Team pages are appended whole, after the plan, so their size is the
  // artwork's own business — nothing is positioned on top of them.
  return { ok: true, pageCount };
}
