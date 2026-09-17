import type { TemplateSettings, TreatmentPlanData } from '@/types';
import { cropToCircleDataUrl } from '@/lib/image/circle-crop';

/**
 * Browser side of PDF generation.
 *
 * The document itself is built on the server (src/lib/pdf/generate.ts). All
 * this does is prepare the payload, post it, and hand the bytes to the
 * download helper — which is unchanged from the original client-side version,
 * so the download behaves exactly as the team is used to.
 */

/** Settings the server resolves for itself; the client no longer sends paths. */
type RenderableSettings = Omit<TemplateSettings, 'coverPdf' | 'treatmentPdf' | 'teamPdfs'>;

export async function renderTreatmentPlanPdf(
  data: TreatmentPlanData,
  settings: TemplateSettings
): Promise<Uint8Array> {
  // The server has no <canvas>, so the circular crop happens here.
  let doctorPhoto = data.doctorPhoto;
  if (doctorPhoto) {
    doctorPhoto = await cropToCircleDataUrl(doctorPhoto);
  }

  const renderableSettings: RenderableSettings = {
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

  const response = await fetch('/api/plans/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { ...data, doctorPhoto }, settings: renderableSettings }),
  });

  if (!response.ok) {
    const message = await response
      .json()
      .then((body: { error?: string }) => body.error)
      .catch(() => undefined);

    throw new Error(message ?? 'Could not generate the PDF.');
  }

  return new Uint8Array(await response.arrayBuffer());
}

/** Triggers a browser download. Unchanged from the original implementation. */
export function downloadPdf(pdfBytes: Uint8Array, filename: string): void {
  // Copy into a fresh ArrayBuffer to sidestep SharedArrayBuffer typing issues.
  const buffer = new ArrayBuffer(pdfBytes.length);
  new Uint8Array(buffer).set(pdfBytes);

  const blob = new Blob([buffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
