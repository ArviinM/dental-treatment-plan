import { describe, expect, it } from 'vitest';

import {
  PALETTE,
  PDF_PAGE_HEIGHT,
  PDF_PAGE_WIDTH,
  TABLE_COLUMNS,
  resolveColumnWidths,
  toPdfRgb,
} from '@/lib/pdf/layout';

/**
 * The layout module is shared by the server PDF renderer and the browser canvas
 * preview. If it drifts, the preview lies about what will be printed — which is
 * exactly the bug this module was extracted to prevent.
 */
describe('pdf layout', () => {
  it('has column widths that sum to exactly the table width', () => {
    // If these did not sum to 1, the last column would overhang the table edge
    // in the PDF and quietly clip the Amount figure.
    const total = TABLE_COLUMNS.reduce((sum, column) => sum + column.width, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('resolves fractional widths against a concrete table width', () => {
    const widths = resolveColumnWidths(600);
    const sum = Object.values(widths).reduce((a, b) => a + b, 0);

    expect(sum).toBeCloseTo(600, 6);
    expect(widths.description).toBeGreaterThan(widths.phase);
  });

  it('gives a width for every declared column', () => {
    const widths = resolveColumnWidths(100);
    for (const column of TABLE_COLUMNS) {
      expect(widths[column.key], `missing width for ${column.key}`).toBeGreaterThan(0);
    }
  });

  it('converts hex to the 0-1 channels pdf-lib expects', () => {
    expect(toPdfRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    expect(toPdfRgb('#ffffff')).toEqual({ r: 1, g: 1, b: 1 });

    const teal = toPdfRgb(PALETTE.siaTeal);
    expect(teal.r).toBeCloseTo(0x2b / 255, 6);
    expect(teal.g).toBeCloseTo(0xbf / 255, 6);
    expect(teal.b).toBeCloseTo(0xb3 / 255, 6);
  });

  it('keeps every palette entry a full six-digit hex', () => {
    // The canvas assigns these straight to fillStyle, where a malformed value
    // is silently ignored and the previous colour is reused.
    for (const [name, value] of Object.entries(PALETTE)) {
      expect(value, `${name} is not #rrggbb`).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('keeps the unusual page size that matches the artwork', () => {
    // 11.25 x 20 inches. Not A4, not Letter, and not a mistake — it matches the
    // Canva templates the plan is drawn on top of.
    expect(PDF_PAGE_WIDTH).toBe(810);
    expect(PDF_PAGE_HEIGHT).toBe(1440);
  });
});
