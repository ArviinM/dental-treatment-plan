import { readFile } from 'node:fs/promises';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { loadPlanTemplate, loadTeamTemplate, clearAssetCache } from '@/lib/pdf/assets';
import { generateTreatmentPlanPdf } from '@/lib/pdf/generate';
import { samplePlan } from '@/lib/pdf/sample-plan';
import { DEFAULT_TEMPLATE_SETTINGS } from '@/types';

import { adminClient, TEST_TAG, uid } from '../helpers/supabase';

/**
 * A plan must ALWAYS be producible, whatever state the uploaded templates are in.
 *
 * Written after a production incident. The rule this pins down: an uploaded
 * template that is missing, unreachable or will not open falls back to the
 * design that ships with the app. It may make a plan look old-fashioned; it may
 * never stop one being made while a patient is waiting for it.
 *
 * These run against the real storage bucket with real bad files — a mocked
 * download would only prove the mock.
 */

const BUCKET = 'plan-templates';

describe('template fallbacks', () => {
  const folder = `${TEST_TAG}-${uid()}`;
  const garbagePath = `${folder}/not-really-a.pdf`;
  const truncatedPath = `${folder}/truncated.pdf`;
  const goodPath = `${folder}/good.pdf`;
  const missingPath = `${folder}/does-not-exist.pdf`;

  beforeAll(async () => {
    const admin = adminClient();
    const original = await readFile('public/templates/TreatmentPlanBlank.pdf');

    await Promise.all([
      // Bytes that are plainly not a PDF.
      admin.storage.from(BUCKET).upload(garbagePath, Buffer.from('this is not a pdf'), {
        contentType: 'application/pdf',
      }),
      // The realistic failure: a real PDF cut off mid-download or mid-export.
      admin.storage.from(BUCKET).upload(truncatedPath, original.subarray(0, 4096), {
        contentType: 'application/pdf',
      }),
      admin.storage.from(BUCKET).upload(goodPath, original, { contentType: 'application/pdf' }),
    ]);
  });

  afterAll(async () => {
    await adminClient().storage.from(BUCKET).remove([garbagePath, truncatedPath, goodPath]);
    clearAssetCache();
  });

  it('uses an uploaded template when it is fine', async () => {
    const { source, doc } = await loadPlanTemplate(goodPath);
    expect(source).toBe('uploaded');
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });

  it.each([
    ['is not a PDF at all', () => garbagePath],
    ['is a PDF cut off part-way', () => truncatedPath],
    ['is missing from storage', () => missingPath],
  ])('falls back to the original when the uploaded plan template %s', async (_, path) => {
    const { source, doc } = await loadPlanTemplate(path());
    expect(source).toBe('bundled');
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });

  it('falls back to the original team page when the uploaded one is unusable', async () => {
    const { source, doc } = await loadTeamTemplate('burwood', garbagePath);
    expect(source).toBe('bundled');
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('still produces a complete plan when BOTH templates are unusable', async () => {
    // The end-to-end promise: the worst case is an old-fashioned plan, not no plan.
    const bytes = await generateTreatmentPlanPdf({
      data: samplePlan('burwood'),
      settings: DEFAULT_TEMPLATE_SETTINGS,
      templateOverrides: { planPath: garbagePath, teamPath: truncatedPath },
    });

    expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(10_000);
  });
});
