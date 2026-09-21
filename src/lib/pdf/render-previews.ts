import { getPdfJs } from '@/lib/pdf/pdfjs-client';

/**
 * Renders the pages of an uploaded template that the live preview paints, as
 * PNGs. Runs in the browser, at upload time.
 *
 * The canvas preview used to paint the bundled original artwork whatever had
 * been uploaded, so it could show a perfectly good plan while the real PDF was
 * garbled — which is exactly what happened when the plan template was replaced
 * with a design that had its own table printed on it. Previews are now made
 * from the real file, and stored beside it.
 *
 * The server cannot do this without native rasterising libraries; the browser
 * already has a canvas and PDF.js.
 */

export type TemplateKind = 'plan' | 'team';

/** Same width as the bundled preview PNGs, so the canvas scales them alike. */
const PREVIEW_WIDTH_PX = 1080;

/**
 * Which pages become previews, in the order the canvas expects them:
 * plan -> cover, treatment, continuation; team -> the team page.
 *
 * A two-page plan template reuses page two for the continuation, mirroring what
 * the renderer does, so the preview never shows a page the PDF will not.
 */
export function previewPageNumbers(kind: TemplateKind, pageCount: number): number[] {
  if (kind === 'team') return [1];
  return [1, 2, Math.min(3, pageCount)];
}

export async function renderTemplatePreviews(
  file: Blob,
  kind: TemplateKind
): Promise<{ pageCount: number; images: Blob[] }> {
  const pdfjs = await getPdfJs();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;

  try {
    const images: Blob[] = [];

    for (const pageNumber of previewPageNumbers(kind, pdf.numPages)) {
      const page = await pdf.getPage(pageNumber);
      const unscaled = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: PREVIEW_WIDTH_PX / unscaled.width });

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);

      const context = canvas.getContext('2d');
      if (!context) throw new Error('No 2D canvas context available.');

      await page.render({ canvas, canvasContext: context, viewport }).promise;

      images.push(
        await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the preview.'))),
            'image/png'
          )
        )
      );
    }

    return { pageCount: pdf.numPages, images };
  } finally {
    await pdf.destroy();
  }
}
