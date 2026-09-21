import { describe, expect, it } from 'vitest';

import { previewPageNumbers } from '@/lib/pdf/render-previews';

/**
 * Which pages become preview images. They must be the same pages the PDF
 * renderer uses, or the preview shows something the download will not.
 */
describe('previewPageNumbers', () => {
  it('uses cover, treatment and continuation for a normal plan template', () => {
    expect(previewPageNumbers('plan', 3)).toEqual([1, 2, 3]);
  });

  it('ignores extra pages, as the renderer does', () => {
    // The real case: a six-page Canva master with the team pages at the back.
    expect(previewPageNumbers('plan', 6)).toEqual([1, 2, 3]);
  });

  it('reuses page two for the continuation of a two-page template', () => {
    // The renderer clamps to the last page, so the preview must too.
    expect(previewPageNumbers('plan', 2)).toEqual([1, 2, 2]);
  });

  it('uses only the first page of a team template', () => {
    expect(previewPageNumbers('team', 1)).toEqual([1]);
    expect(previewPageNumbers('team', 4)).toEqual([1]);
  });
});
