import { readFile } from 'node:fs/promises';

import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import { validateTemplatePdf } from '@/lib/pdf/validate-template';

/**
 * The checks that decide whether an uploaded template is accepted, run on the
 * real files rather than on synthetic ones.
 *
 * These are the exact functions finalizeTemplateUpload calls in production. The
 * action itself needs a signed-in admin; this does not, so the logic that
 * decides whether Ericka's upload goes through is tested on her own PDFs.
 */

const load = (path: string) => readFile(path).then((b) => new Uint8Array(b));

/** A blank PDF of a given size, for the uploads people get wrong. */
async function blankPdf(pages: number, width: number, height: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([width, height]);
  return doc.save();
}

describe('validateTemplatePdf — the files Ericka actually uploads', () => {
  it.each([
    'burwood-team.pdf',
    'burwood-mulgrave-team.pdf',
    'essendon-team.pdf',
    'mulgrave-team.pdf',
  ])('accepts the original Canva export %s as a team page', async (file) => {
    const result = await validateTemplatePdf(await load(`public/templates/originals/${file}`), 'team');
    expect(result, JSON.stringify(result)).toMatchObject({ ok: true });
  });

  it('accepts the original blank plan as the plan template', async () => {
    const result = await validateTemplatePdf(
      await load('public/templates/originals/TreatmentPlanBlank.pdf'),
      'plan'
    );
    expect(result, JSON.stringify(result)).toMatchObject({ ok: true });
    if (result.ok) expect(result.pageCount).toBeGreaterThanOrEqual(2);
  });

  it('accepts the compressed plan that ships with the app', async () => {
    const result = await validateTemplatePdf(await load('public/templates/TreatmentPlanBlank.pdf'), 'plan');
    expect(result).toMatchObject({ ok: true });
  });
});

describe('validateTemplatePdf — the mistakes worth catching', () => {
  it('refuses something that is not a PDF, with a sentence that says so', async () => {
    const png = await load('public/brand/logo-favicon.png');
    const result = await validateTemplatePdf(png, 'team');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/could not be opened as a PDF/);
  });

  it('refuses a team page uploaded into the plan slot', async () => {
    // The most plausible slip: clicking Replace on the wrong row.
    const team = await load('public/templates/originals/mulgrave-team.pdf');
    const result = await validateTemplatePdf(team, 'plan');

    expect(result.ok).toBe(false);
  });

  it('refuses a one-page plan template', async () => {
    const result = await validateTemplatePdf(await blankPdf(1, 810, 1440), 'plan');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/at least 2 pages/);
  });

  it('refuses a plan template exported at A4 instead of the design size', async () => {
    // A4 is 595 x 842 pt. Every text position is an absolute coordinate on an
    // 810 x 1440 page, so this would misplace the patient's name on every plan.
    const result = await validateTemplatePdf(await blankPdf(3, 595, 842), 'plan');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/810 × 1440/);
  });

  it('tolerates the fraction-of-a-point drift Canva exports can have', async () => {
    const result = await validateTemplatePdf(await blankPdf(3, 810.4, 1439.6), 'plan');
    expect(result).toMatchObject({ ok: true, pageCount: 3 });
  });

  it('does not police the size of a team page', async () => {
    // Team pages are appended whole; nothing is drawn on top of them.
    const result = await validateTemplatePdf(await blankPdf(1, 595, 842), 'team');
    expect(result).toMatchObject({ ok: true, pageCount: 1 });
  });
});
