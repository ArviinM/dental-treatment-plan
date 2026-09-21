import 'server-only';

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { TreatmentPlanData, TemplateSettings, Team } from '@/types';
import { LOCATION_TO_TEAM } from '@/types';
import { loadFont, loadPlanTemplate, loadTeamTemplate } from '@/lib/pdf/assets';
import {
  COVER_INTRO,
  FONT_SIZES,
  LINE_HEIGHT,
  METRICS,
  PALETTE,
  PDF_PAGE_WIDTH,
  TEMPLATE_PAGE,
  resolveColumnWidths,
  toPdfRgb,
} from '@/lib/pdf/layout';

/**
 * Server-side treatment plan renderer.
 *
 * Ported from src/services/pdfGenerator.ts, which ran in the browser. The
 * drawing code is unchanged — only the edges moved:
 *
 *  - Fonts and templates are read from disk and cached (src/lib/pdf/assets.ts)
 *    rather than re-fetched over the network on every download.
 *  - Measurements come from src/lib/pdf/layout.ts, shared with the canvas
 *    preview, so the preview cannot drift away from the real document.
 *  - The dentist photo must arrive ALREADY CROPPED to a circle. The browser
 *    version cropped it here with a <canvas>, which does not exist on a server;
 *    the crop now happens in the browser before the request is sent
 *    (src/lib/image/circle-crop.ts).
 */

/** pdf-lib wants 0-1 channels; the palette is authored as hex. */
function color(hex: string) {
  const { r, g, b } = toPdfRgb(hex);
  return rgb(r, g, b);
}

const COLORS = {
  black: color(PALETTE.black),
  darkGray: color(PALETTE.darkGray),
  gray: color(PALETTE.gray),
  white: color(PALETTE.white),
  siaTeal: color(PALETTE.siaTeal),
  siaPurple: color(PALETTE.siaPurple),
  headerBg: color(PALETTE.headerBg),
};

interface GeneratePdfOptions {
  data: TreatmentPlanData;
  settings: TemplateSettings;
  /**
   * Render against specific stored files instead of the live templates. This is
   * how a DRAFT upload is checked: the admin sees a real plan on the new
   * artwork before it is published, and nobody else's plans are affected.
   */
  templateOverrides?: { planPath?: string; teamPath?: string };
}

/** Money, as it appears on the plan: `$1,234.00`. */
function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-AU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Decodes a `data:` URL into bytes. Anything else is rejected. */
function decodeDataUrl(source: string): Uint8Array {
  const comma = source.indexOf(',');
  if (!source.startsWith('data:') || comma === -1) {
    throw new Error('Dentist photo must be a data: URL cropped by the browser.');
  }
  return Uint8Array.from(Buffer.from(source.slice(comma + 1), 'base64'));
}

export async function generateTreatmentPlanPdf({
  data,
  settings,
  templateOverrides,
}: GeneratePdfOptions): Promise<Uint8Array> {
  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();
  
  // Register fontkit for custom fonts
  pdfDoc.registerFontkit(fontkit);
  
  // Load Nunito fonts
  let nunitoRegular;
  let nunitoBold;
  
  try {
    const [regularFontBytes, boldFontBytes] = await Promise.all([
      loadFont('regular'),
      loadFont('bold'),
    ]);
    nunitoRegular = await pdfDoc.embedFont(regularFontBytes);
    nunitoBold = await pdfDoc.embedFont(boldFontBytes);
  } catch (error) {
    console.warn('Failed to load Nunito font, falling back to Helvetica:', error);
    // Fallback to standard fonts
    nunitoRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    nunitoBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  }

  // Templates. Each falls back to the bundled original if the uploaded one is
  // missing, unreachable or will not open — a broken upload can make a plan
  // look old-fashioned, but it can never stop one being produced.
  const team: Team = LOCATION_TO_TEAM[data.location];
  const [{ doc: templatePdf }, { doc: teamPdf }] = await Promise.all([
    loadPlanTemplate(templateOverrides?.planPath),
    loadTeamTemplate(team, templateOverrides?.teamPath),
  ]);

  // ============ PAGE 1: COVER PAGE ============
  // Copy cover page from template (page 0)
  const [coverPage] = await pdfDoc.copyPages(templatePdf, [TEMPLATE_PAGE.cover]);
  pdfDoc.addPage(coverPage);
  
  // Draw intro text above patient name box
  const introSize = FONT_SIZES.intro;
  const [introLine1, introLine2] = COVER_INTRO.lines;
  const introLine1Width = nunitoRegular.widthOfTextAtSize(introLine1, introSize);
  const introLine2Width = nunitoRegular.widthOfTextAtSize(introLine2, introSize);
  
  coverPage.drawText(introLine1, {
    x: (PDF_PAGE_WIDTH - introLine1Width) / 2,
    y: COVER_INTRO.firstLineY,
    size: introSize,
    font: nunitoRegular,
    color: COLORS.darkGray,
  });
  
  coverPage.drawText(introLine2, {
    x: (PDF_PAGE_WIDTH - introLine2Width) / 2,
    y: COVER_INTRO.firstLineY - COVER_INTRO.gap,
    size: introSize,
    font: nunitoRegular,
    color: COLORS.darkGray,
  });
  
  // Draw patient name on cover (purple, centered) - using font size from settings
  const patientNameSize = settings.patientNameFontSize;
  const patientNameWidth = nunitoBold.widthOfTextAtSize(data.patientName, patientNameSize);
  coverPage.drawText(data.patientName, {
    x: (PDF_PAGE_WIDTH - patientNameWidth) / 2, // Center horizontally
    y: settings.patientNamePosition.y,
    size: patientNameSize,
    font: nunitoBold,
    color: COLORS.siaPurple, // Purple color for patient name
  });
  
  // Draw doctor photo if available (using settings for position)
  if (data.doctorPhoto) {
    try {
      // The browser cropped this to a transparent circular PNG before sending.
      const embeddedImage = await pdfDoc.embedPng(decodeDataUrl(data.doctorPhoto));
      
      // Photo dimensions and position from settings
      const photoSize = settings.doctorPhotoPosition.size;
      const photoX = settings.doctorPhotoPosition.x;
      const photoY = settings.doctorPhotoPosition.y;
      
      // Draw a white rectangle first to mask any photo in the template background
      // We make it slightly larger than the photo to ensure full coverage
      coverPage.drawRectangle({
        x: photoX - 5,
        y: photoY - 5,
        width: photoSize + 14,
        height: photoSize + 14,
        color: COLORS.white,
      });

      // Draw the circular photo
      coverPage.drawImage(embeddedImage, {
        x: photoX,
        y: photoY,
        width: photoSize,
        height: photoSize,
      });

      // Draw circular teal border (matching UI)
      const borderThickness = 3;
      coverPage.drawCircle({
        x: photoX + photoSize / 2,
        y: photoY + photoSize / 2,
        size: photoSize / 2,
        borderColor: COLORS.siaTeal,
        borderWidth: borderThickness,
      });
    } catch (error) {
      console.error('Failed to embed doctor photo:', error);
    }
  }
  
  // Draw doctor name on cover (black, left aligned) - using font size from settings
  const doctorNameSize = settings.doctorNameFontSize;
  coverPage.drawText(data.doctorName, {
    x: settings.doctorNamePosition.x,
    y: settings.doctorNamePosition.y,
    size: doctorNameSize,
    font: nunitoBold,
    color: COLORS.black, // Black for doctor name
  });

  // ============ PAGE 2+: TREATMENT TABLE ============
  // Filter valid items
  const validItems = data.items.filter(item => item.itemCode || item.description);
  
  // Split items into pages
  const itemsPerPage = settings.maxRowsPerPage;
  const itemPages: typeof validItems[] = [];
  
  for (let i = 0; i < validItems.length; i += itemsPerPage) {
    itemPages.push(validItems.slice(i, i + itemsPerPage));
  }
  
  // Ensure at least one treatment page
  if (itemPages.length === 0) {
    itemPages.push([]);
  }
  
  // Create treatment pages
  for (let pageIndex = 0; pageIndex < itemPages.length; pageIndex++) {
    const pageItems = itemPages[pageIndex];
    const isLastPage = pageIndex === itemPages.length - 1;
    
    // Copy treatment page template (page 1 for first, page 2 for continuation)
    const templatePageIndex =
      pageIndex === 0 ? TEMPLATE_PAGE.firstTreatment : TEMPLATE_PAGE.continuation;
    const availablePages = templatePdf.getPageCount();
    const sourcePageIndex = Math.min(templatePageIndex, availablePages - 1);
    
    const [treatmentPage] = await pdfDoc.copyPages(templatePdf, [sourcePageIndex]);
    pdfDoc.addPage(treatmentPage);
    
    // Table dimensions
    const tableX = settings.tableMarginX;
    const tableWidth = PDF_PAGE_WIDTH - (settings.tableMarginX * 2);
    let currentY = settings.tableStartY;
    
    const colWidths = resolveColumnWidths(tableWidth);
    
    // Draw table header - more compact
    const headerHeight = METRICS.headerHeight;
    treatmentPage.drawRectangle({
      x: tableX,
      y: currentY - headerHeight,
      width: tableWidth,
      height: headerHeight,
      color: COLORS.headerBg,
    });
    
    // Header text
    const headerY = currentY - 17;
    const headerSize = FONT_SIZES.tableHeader;
    
    let headerX = tableX;
    treatmentPage.drawText('Phase', {
      x: headerX + colWidths.phase / 2 - nunitoBold.widthOfTextAtSize('Phase', headerSize) / 2,
      y: headerY,
      size: headerSize,
      font: nunitoBold,
      color: COLORS.white,
    });
    
    headerX += colWidths.phase;
    treatmentPage.drawText('Visit', {
      x: headerX + colWidths.visit / 2 - nunitoBold.widthOfTextAtSize('Visit', headerSize) / 2,
      y: headerY,
      size: headerSize,
      font: nunitoBold,
      color: COLORS.white,
    });
    
    headerX += colWidths.visit;
    treatmentPage.drawText('Item', {
      x: headerX + colWidths.item / 2 - nunitoBold.widthOfTextAtSize('Item', headerSize) / 2,
      y: headerY,
      size: headerSize,
      font: nunitoBold,
      color: COLORS.white,
    });
    
    headerX += colWidths.item;
    treatmentPage.drawText('Times', {
      x: headerX + colWidths.times / 2 - nunitoBold.widthOfTextAtSize('Times', headerSize) / 2,
      y: headerY,
      size: headerSize,
      font: nunitoBold,
      color: COLORS.white,
    });
    
    headerX += colWidths.times;
    treatmentPage.drawText('Description', {
      x: headerX + colWidths.description / 2 - nunitoBold.widthOfTextAtSize('Description', headerSize) / 2,
      y: headerY,
      size: headerSize,
      font: nunitoBold,
      color: COLORS.white,
    });
    
    headerX += colWidths.description;
    treatmentPage.drawText('Tooth', {
      x: headerX + colWidths.tooth / 2 - nunitoBold.widthOfTextAtSize('Tooth', headerSize) / 2,
      y: headerY,
      size: headerSize,
      font: nunitoBold,
      color: COLORS.white,
    });
    
    headerX += colWidths.tooth;
    treatmentPage.drawText('Fee', {
      x: headerX + colWidths.fee / 2 - nunitoBold.widthOfTextAtSize('Fee', headerSize) / 2,
      y: headerY,
      size: headerSize,
      font: nunitoBold,
      color: COLORS.white,
    });
    
    headerX += colWidths.fee;
    treatmentPage.drawText('Amount', {
      x: headerX + colWidths.amount / 2 - nunitoBold.widthOfTextAtSize('Amount', headerSize) / 2,
      y: headerY,
      size: headerSize,
      font: nunitoBold,
      color: COLORS.white,
    });
    
    currentY -= headerHeight;
    
    // Draw rows - more compact
    const rowHeight = METRICS.rowHeight;
    const subtotalRowHeight = METRICS.subtotalRowHeight;
    const rowSize = FONT_SIZES.row;
    const lineHeight = LINE_HEIGHT;
    const borderColor = color(PALETTE.rowBorder);
    
    // Track phase/visit for subtotals
    let lastPhase = -1;
    let lastVisit = -1;
    let visitSubtotal = 0;
    
    // Helper function to draw subtotal row
    const drawSubtotalRow = (phase: number, visit: number, subtotal: number) => {
      const subRowY = currentY - subtotalRowHeight;
      
      // Light gray background
      treatmentPage.drawRectangle({
        x: tableX,
        y: subRowY,
        width: tableWidth,
        height: subtotalRowHeight,
        color: color(PALETTE.subtotalBg),
      });
      
      // Border
      treatmentPage.drawRectangle({
        x: tableX,
        y: subRowY,
        width: tableWidth,
        height: subtotalRowHeight,
        borderColor: borderColor,
        borderWidth: 1,
      });
      
      // Subtotal text
      const labelText = `Amount for Phase ${phase}  - Visit ${visit}`;
      const labelWidth = nunitoBold.widthOfTextAtSize(labelText, 8);
      treatmentPage.drawText(labelText, {
        x: tableX + tableWidth - labelWidth - 80,
        y: subRowY + 7,
        size: 8,
        font: nunitoBold,
        color: COLORS.darkGray,
      });
      
      const subtotalText = subtotal.toFixed(2);
      const subtotalWidth = nunitoBold.widthOfTextAtSize(subtotalText, 8);
      treatmentPage.drawText(subtotalText, {
        x: tableX + tableWidth - subtotalWidth - 6,
        y: subRowY + 7,
        size: 8,
        font: nunitoBold,
        color: COLORS.darkGray,
      });
      
      currentY -= subtotalRowHeight;
    };
    
    pageItems.forEach((item, index) => {
      const currentPhase = item.phase || 1;
      const currentVisit = item.visitNo || 1;
      
      // Check if we need to draw a subtotal row for the previous visit
      if (lastPhase !== -1 && (currentPhase !== lastPhase || currentVisit !== lastVisit)) {
        drawSubtotalRow(lastPhase, lastVisit, visitSubtotal);
        visitSubtotal = 0;
      }
      
      lastPhase = currentPhase;
      lastVisit = currentVisit;
      
      // Calculate item total and add to visit subtotal
      const itemTotal = (item.fees || []).reduce((sum, f) => sum + f.quantity * f.unitFee, 0);
      visitSubtotal += itemTotal;
      
      const rowY = currentY - rowHeight;
      
      // Draw cell borders (vertical lines)
      let colX = tableX;
      
      // Left border
      treatmentPage.drawLine({
        start: { x: tableX, y: currentY },
        end: { x: tableX, y: rowY },
        thickness: 1,
        color: borderColor,
      });
      
      // Column separators
      colX += colWidths.phase;
      treatmentPage.drawLine({
        start: { x: colX, y: currentY },
        end: { x: colX, y: rowY },
        thickness: 1,
        color: borderColor,
      });
      
      colX += colWidths.visit;
      treatmentPage.drawLine({
        start: { x: colX, y: currentY },
        end: { x: colX, y: rowY },
        thickness: 1,
        color: borderColor,
      });
      
      colX += colWidths.item;
      treatmentPage.drawLine({
        start: { x: colX, y: currentY },
        end: { x: colX, y: rowY },
        thickness: 1,
        color: borderColor,
      });
      
      colX += colWidths.times;
      treatmentPage.drawLine({
        start: { x: colX, y: currentY },
        end: { x: colX, y: rowY },
        thickness: 1,
        color: borderColor,
      });
      
      colX += colWidths.description;
      treatmentPage.drawLine({
        start: { x: colX, y: currentY },
        end: { x: colX, y: rowY },
        thickness: 1,
        color: borderColor,
      });
      
      colX += colWidths.tooth;
      treatmentPage.drawLine({
        start: { x: colX, y: currentY },
        end: { x: colX, y: rowY },
        thickness: 1,
        color: borderColor,
      });
      
      colX += colWidths.fee;
      treatmentPage.drawLine({
        start: { x: colX, y: currentY },
        end: { x: colX, y: rowY },
        thickness: 1,
        color: borderColor,
      });
      
      // Right border
      treatmentPage.drawLine({
        start: { x: tableX + tableWidth, y: currentY },
        end: { x: tableX + tableWidth, y: rowY },
        thickness: 1,
        color: borderColor,
      });
      
      // Bottom row border
      treatmentPage.drawLine({
        start: { x: tableX, y: rowY },
        end: { x: tableX + tableWidth, y: rowY },
        thickness: 1,
        color: borderColor,
      });
      
      // Phase (centered)
      const phaseText = String(item.phase || 1);
      const phaseWidth = nunitoRegular.widthOfTextAtSize(phaseText, rowSize);
      treatmentPage.drawText(phaseText, {
        x: tableX + colWidths.phase / 2 - phaseWidth / 2,
        y: rowY + rowHeight / 2 - 3,
        size: rowSize,
        font: nunitoRegular,
        color: COLORS.darkGray,
      });
      
      // Visit (centered)
      let cellX = tableX + colWidths.phase;
      const visitText = String(item.visitNo || 1);
      const visitWidth = nunitoRegular.widthOfTextAtSize(visitText, rowSize);
      treatmentPage.drawText(visitText, {
        x: cellX + colWidths.visit / 2 - visitWidth / 2,
        y: rowY + rowHeight / 2 - 3,
        size: rowSize,
        font: nunitoRegular,
        color: COLORS.darkGray,
      });
      
      // Item code (centered)
      cellX += colWidths.visit;
      const itemWidth = nunitoRegular.widthOfTextAtSize(item.itemCode, rowSize);
      treatmentPage.drawText(item.itemCode, {
        x: cellX + colWidths.item / 2 - itemWidth / 2,
        y: rowY + rowHeight / 2 - 3,
        size: rowSize,
        font: nunitoRegular,
        color: COLORS.darkGray,
      });
      
      // Times (centered)
      cellX += colWidths.item;
      const timesText = String(item.times || 1);
      const timesWidth = nunitoRegular.widthOfTextAtSize(timesText, rowSize);
      treatmentPage.drawText(timesText, {
        x: cellX + colWidths.times / 2 - timesWidth / 2,
        y: rowY + rowHeight / 2 - 3,
        size: rowSize,
        font: nunitoRegular,
        color: COLORS.darkGray,
      });
      
      // Description (multi-line text wrapping)
      cellX += colWidths.times;
      const descX = cellX + 4;
      const maxDescWidth = colWidths.description - 8;
      const words = item.description.split(' ');
      const lines: string[] = [];
      let currentLine = '';
      
      words.forEach(word => {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (nunitoRegular.widthOfTextAtSize(testLine, rowSize) <= maxDescWidth) {
          currentLine = testLine;
        } else {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        }
      });
      if (currentLine) lines.push(currentLine);
      
      // Calculate starting Y to center text vertically
      const totalTextHeight = lines.length * lineHeight;
      let textY = rowY + (rowHeight + totalTextHeight) / 2 - lineHeight + 2;
      
      lines.forEach(line => {
        treatmentPage.drawText(line, {
          x: descX,
          y: textY,
          size: rowSize,
          font: nunitoRegular,
          color: COLORS.darkGray,
        });
        textY -= lineHeight;
      });
      
      // Tooth (centered)
      cellX += colWidths.description;
      const toothWidth = nunitoRegular.widthOfTextAtSize(item.tooth || '', rowSize);
      treatmentPage.drawText(item.tooth || '', {
        x: cellX + colWidths.tooth / 2 - toothWidth / 2,
        y: rowY + rowHeight / 2 - 3,
        size: rowSize,
        font: nunitoRegular,
        color: COLORS.darkGray,
      });
      
      // Fee (centered) - unit fee from first fee entry
      cellX += colWidths.tooth;
      const unitFee = item.fees?.[0]?.unitFee || 0;
      const feeText = unitFee.toFixed(2);
      const feeTextWidth = nunitoRegular.widthOfTextAtSize(feeText, rowSize);
      treatmentPage.drawText(feeText, {
        x: cellX + colWidths.fee / 2 - feeTextWidth / 2,
        y: rowY + rowHeight / 2 - 3,
        size: rowSize,
        font: nunitoRegular,
        color: COLORS.darkGray,
      });
      
      // Amount (right-aligned) - total for this item
      const amountText = itemTotal.toFixed(2);
      const amountWidth = nunitoBold.widthOfTextAtSize(amountText, rowSize);
      treatmentPage.drawText(amountText, {
        x: tableX + tableWidth - amountWidth - 6,
        y: rowY + rowHeight / 2 - 3,
        size: rowSize,
        font: nunitoBold,
        color: COLORS.darkGray,
      });
      
      currentY -= rowHeight;
      
      // If this is the last item on this page, draw the final subtotal
      if (index === pageItems.length - 1) {
        drawSubtotalRow(currentPhase, currentVisit, visitSubtotal);
      }
    });
    
    // Draw total on last page
    if (isLastPage) {
      const totalHeight = METRICS.totalHeight;
      const totalY = currentY - totalHeight;
      
      // Total background
      treatmentPage.drawRectangle({
        x: tableX,
        y: totalY,
        width: tableWidth,
        height: totalHeight,
        color: color(PALETTE.totalBg),
      });
      
      // Total label
      const totalLabelSize = FONT_SIZES.total;
      treatmentPage.drawText('TOTAL AMOUNT:', {
        x: tableX + tableWidth - 160,
        y: totalY + 10,
        size: totalLabelSize,
        font: nunitoBold,
        color: COLORS.darkGray,
      });
      
      // Total amount
      const totalText = formatCurrency(data.totalAmount);
      const totalWidth = nunitoBold.widthOfTextAtSize(totalText, totalLabelSize);
      treatmentPage.drawText(totalText, {
        x: tableX + tableWidth - totalWidth - 6,
        y: totalY + 10,
        size: totalLabelSize,
        font: nunitoBold,
        color: COLORS.darkGray,
      });
    }
  }

  // ============ FINAL PAGE: TEAM PAGE ============
  // Copy all pages from team PDF
  const teamPageCount = teamPdf.getPageCount();
  const teamPageIndices = Array.from({ length: teamPageCount }, (_, i) => i);
  const teamPages = await pdfDoc.copyPages(teamPdf, teamPageIndices);
  teamPages.forEach(page => pdfDoc.addPage(page));

  // Serialize the PDF
  return pdfDoc.save();
}

