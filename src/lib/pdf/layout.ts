/**
 * The one place the treatment plan's page layout is defined.
 *
 * Two renderers draw this document and they must agree: the server PDF
 * generator (src/lib/pdf/generate.ts, via pdf-lib) and the live canvas preview
 * (src/components/preview/CanvasPreview.tsx, via Canvas 2D). Before this module
 * existed the numbers were copy-pasted between them, which meant the preview
 * could quietly disagree with the PDF it was previewing.
 *
 * Drawing code stays separate — the two APIs are genuinely different, and
 * unifying them would be a rewrite of frozen code. Only the measurements are
 * shared. If you change a number here, both renderers pick it up.
 *
 * Units are PDF points, in a 810 x 1440 page. The canvas scales them by
 * `height / PDF_PAGE_HEIGHT`; pdf-lib uses them as-is. Note the origin differs:
 * PDF measures Y from the BOTTOM, canvas from the TOP. Positions coming out of
 * TemplateSettings are always PDF-space, so the canvas converts them with
 * `height - y * scale`.
 */

/** Colours, as hex. `toPdfRgb` converts for pdf-lib; canvas uses them directly. */
export const PALETTE = {
  black: '#000000',
  white: '#ffffff',
  darkGray: '#1f2937',
  gray: '#666666',
  siaTeal: '#2bbfb3',
  siaPurple: '#a5338d',
  /** Table header band. */
  headerBg: '#1f2937',
  /** Hairline between rows. */
  rowBorder: '#d9d9d9',
  /** Visit subtotal row background. */
  subtotalBg: '#f2f5f5',
  /** Grand total row background. */
  totalBg: '#e5e5e5',
} as const;

export type PaletteColor = keyof typeof PALETTE;

/** Converts a `#rrggbb` string into the 0–1 triple pdf-lib's `rgb()` expects. */
export function toPdfRgb(hex: string): { r: number; g: number; b: number } {
  const value = hex.replace('#', '');
  return {
    r: parseInt(value.slice(0, 2), 16) / 255,
    g: parseInt(value.slice(2, 4), 16) / 255,
    b: parseInt(value.slice(4, 6), 16) / 255,
  };
}

/**
 * Treatment table columns, in draw order.
 *
 * `width` is a fraction of the table's total width, so the columns stay
 * proportional whatever the margins are. They sum to 1.
 */
export const TABLE_COLUMNS = [
  { key: 'phase', label: 'Phase', width: 0.06 },
  { key: 'visit', label: 'Visit', width: 0.06 },
  { key: 'item', label: 'Item', width: 0.08 },
  { key: 'times', label: 'Times', width: 0.06 },
  { key: 'description', label: 'Description', width: 0.38 },
  { key: 'tooth', label: 'Tooth', width: 0.08 },
  { key: 'fee', label: 'Fee', width: 0.12 },
  { key: 'amount', label: 'Amount', width: 0.16 },
] as const;

export type TableColumnKey = (typeof TABLE_COLUMNS)[number]['key'];

/** Resolves the fractional column widths against a concrete table width. */
export function resolveColumnWidths(tableWidth: number): Record<TableColumnKey, number> {
  return Object.fromEntries(
    TABLE_COLUMNS.map((column) => [column.key, tableWidth * column.width])
  ) as Record<TableColumnKey, number>;
}

/** Vertical metrics, in PDF points. */
export const METRICS = {
  headerHeight: 28,
  rowHeight: 50,
  subtotalRowHeight: 22,
  totalHeight: 30,
} as const;

/** Type sizes, in PDF points. */
export const FONT_SIZES = {
  tableHeader: 9,
  row: 9,
  subtotal: 9,
  total: 10,
  /** "A personalised / treatment plan for:" on the cover. */
  intro: 32,
} as const;

/** Leading for wrapped description text. */
export const LINE_HEIGHT = 11;

/** The cover page's lead-in, drawn centred above the patient's name. */
export const COVER_INTRO = {
  lines: ['A personalised', 'treatment plan for:'] as const,
  /** Y of the first line, PDF-space. The second sits one `gap` lower. */
  firstLineY: 580,
  gap: 40,
} as const;

/**
 * Page size. Not A4 or Letter — 11.25 x 20.00 inches, matching the Canva
 * artwork the templates were exported from. Do not "correct" it.
 */
export const PDF_PAGE_WIDTH = 810;
export const PDF_PAGE_HEIGHT = 1440;

/** Which page of TreatmentPlanBlank.pdf serves which role. */
export const TEMPLATE_PAGE = {
  cover: 0,
  firstTreatment: 1,
  continuation: 2,
} as const;
