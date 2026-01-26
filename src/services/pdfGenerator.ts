import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { TreatmentPlanData, TemplateSettings, Team } from '@/types';
import { LOCATION_TO_TEAM, PDF_PAGE_WIDTH, DEFAULT_TEMPLATE_PATHS } from '@/types';

// SIA Dental Brand Colors
const COLORS = {
  black: rgb(0, 0, 0),
  darkGray: rgb(0.12, 0.16, 0.22),      // #1F2937
  gray: rgb(0.4, 0.4, 0.4),
  white: rgb(1, 1, 1),
  siaTeal: rgb(0.17, 0.75, 0.70),       // #2BBFB3
  siaPurple: rgb(0.65, 0.20, 0.55),     // #A5338D - for patient names
  headerBg: rgb(0.12, 0.16, 0.22),      // Dark gray for table header
};

interface GeneratePdfOptions {
  data: TreatmentPlanData;
  settings: TemplateSettings;
}

// Fetch PDF from URL
async function fetchPdf(url: string): Promise<ArrayBuffer> {
  console.log(`Fetching PDF from: ${url}`);
  
  try {
    const response = await fetch(url);
    console.log(`Response status for ${url}: ${response.status}, content-type: ${response.headers.get('content-type')}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${url} (status: ${response.status})`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    console.log(`Received ${arrayBuffer.byteLength} bytes from ${url}`);
    
    // Validate that this is actually a PDF by checking for the PDF magic bytes (%PDF-)
    const bytes = new Uint8Array(arrayBuffer);
    const header = String.fromCharCode(...bytes.slice(0, 5));
    console.log(`PDF header for ${url}: "${header}"`);
    
    if (header !== '%PDF-') {
      // Log more of the content to help debug
      const firstChars = String.fromCharCode(...bytes.slice(0, 100));
      console.error(`Invalid PDF at ${url}. First 100 chars: ${firstChars}`);
      throw new Error(`Invalid PDF file at ${url}. The file does not appear to be a valid PDF. Header was: "${header}"`);
    }
    
    return arrayBuffer;
  } catch (error) {
    console.error(`Error fetching PDF from ${url}:`, error);
    throw error;
  }
}

// Fetch font file
async function fetchFont(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch font: ${url}`);
  }
  return response.arrayBuffer();
}

// Format currency with dollar sign
function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Fetch image from URL or use base64 and crop to circle
async function fetchAndCropImage(imageSource: string): Promise<{ bytes: Uint8Array, isPng: boolean }> {
  let imageBytes: Uint8Array;
  let isPng: boolean;

  if (imageSource.startsWith('data:')) {
    isPng = imageSource.includes('image/png');
    const base64Data = imageSource.split(',')[1];
    imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
  } else {
    const response = await fetch(imageSource);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${imageSource}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    imageBytes = new Uint8Array(arrayBuffer);
    isPng = imageSource.toLowerCase().endsWith('.png');
  }

  // Crop to circle using Canvas API
  return new Promise((resolve, reject) => {
    // Use any cast to bypass SharedArrayBuffer vs ArrayBuffer type issues in some environments
    const blob = new Blob([imageBytes.buffer as any], { type: isPng ? 'image/png' : 'image/jpeg' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      const size = Math.min(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      // Create circular clip
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      
      // Draw image centered and cropped
      ctx.drawImage(
        img,
        (img.width - size) / 2,
        (img.height - size) / 2,
        size,
        size,
        0,
        0,
        size,
        size
      );
      
      canvas.toBlob((resultBlob) => {
        if (!resultBlob) {
          reject(new Error('Failed to create blob from canvas'));
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve({
            bytes: new Uint8Array(reader.result as ArrayBuffer),
            isPng: true // Canvas toBlob defaults to PNG or we force it to PNG for transparency
          });
        };
        reader.readAsArrayBuffer(resultBlob);
      }, 'image/png');
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for cropping'));
    };
    
    img.src = url;
  });
}

export async function generateTreatmentPlanPdf({
  data,
  settings,
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
      fetchFont('/fonts/Nunito-Regular.ttf'),
      fetchFont('/fonts/Nunito-Bold.ttf'),
    ]);
    nunitoRegular = await pdfDoc.embedFont(regularFontBytes);
    nunitoBold = await pdfDoc.embedFont(boldFontBytes);
  } catch (error) {
    console.warn('Failed to load Nunito font, falling back to Helvetica:', error);
    // Fallback to standard fonts
    nunitoRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    nunitoBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  }

  // Load the template PDF (contains cover and treatment pages)
  // Use default paths as fallback if settings are incomplete
  const coverPdfPath = settings.coverPdf || DEFAULT_TEMPLATE_PATHS.coverPdf;
  let templatePdf;
  try {
    console.log('Loading template PDF from:', coverPdfPath);
    const templatePdfBytes = await fetchPdf(coverPdfPath);
    templatePdf = await PDFDocument.load(templatePdfBytes);
  } catch (error) {
    console.error('Failed to load template PDF:', coverPdfPath, error);
    throw new Error(`Failed to load template PDF from ${coverPdfPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  // Get team based on location
  const team: Team = LOCATION_TO_TEAM[data.location];
  
  // Load team PDF - use default paths as fallback if settings are incomplete
  const teamPdfs = settings.teamPdfs || DEFAULT_TEMPLATE_PATHS.teamPdfs;
  const teamPdfPath = teamPdfs[team] || DEFAULT_TEMPLATE_PATHS.teamPdfs[team];
  let teamPdf;
  try {
    console.log('Loading team PDF from:', teamPdfPath);
    const teamPdfBytes = await fetchPdf(teamPdfPath);
    teamPdf = await PDFDocument.load(teamPdfBytes);
  } catch (error) {
    console.error('Failed to load team PDF:', teamPdfPath, error);
    throw new Error(`Failed to load team PDF from ${teamPdfPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // ============ PAGE 1: COVER PAGE ============
  // Copy cover page from template (page 0)
  const [coverPage] = await pdfDoc.copyPages(templatePdf, [0]);
  pdfDoc.addPage(coverPage);
  
  // Draw intro text above patient name box
  const introSize = 32;
  const introLine1 = 'A personalised';
  const introLine2 = 'treatment plan for:';
  const introLine1Width = nunitoRegular.widthOfTextAtSize(introLine1, introSize);
  const introLine2Width = nunitoRegular.widthOfTextAtSize(introLine2, introSize);
  
  coverPage.drawText(introLine1, {
    x: (PDF_PAGE_WIDTH - introLine1Width) / 2,
    y: 580, // Position above the name box
    size: introSize,
    font: nunitoRegular,
    color: COLORS.darkGray,
  });
  
  coverPage.drawText(introLine2, {
    x: (PDF_PAGE_WIDTH - introLine2Width) / 2,
    y: 540, // Below first line
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
      const { bytes: photoBytes } = await fetchAndCropImage(data.doctorPhoto);
      
      // Embed as PNG (since fetchAndCropImage returns PNG with transparency)
      const embeddedImage = await pdfDoc.embedPng(photoBytes);
      
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
    const templatePageIndex = pageIndex === 0 ? 1 : 2;
    const availablePages = templatePdf.getPageCount();
    const sourcePageIndex = Math.min(templatePageIndex, availablePages - 1);
    
    const [treatmentPage] = await pdfDoc.copyPages(templatePdf, [sourcePageIndex]);
    pdfDoc.addPage(treatmentPage);
    
    // Table dimensions
    const tableX = settings.tableMarginX;
    const tableWidth = PDF_PAGE_WIDTH - (settings.tableMarginX * 2);
    let currentY = settings.tableStartY;
    
    // Column widths (proportional) - Phase | Visit | Item | Times | Description | Tooth | Fee | Amount
    const colWidths = {
      phase: tableWidth * 0.06,
      visit: tableWidth * 0.06,
      item: tableWidth * 0.08,
      times: tableWidth * 0.06,
      description: tableWidth * 0.38,
      tooth: tableWidth * 0.08,
      fee: tableWidth * 0.12,
      amount: tableWidth * 0.16,
    };
    
    // Draw table header - more compact
    const headerHeight = 28;
    treatmentPage.drawRectangle({
      x: tableX,
      y: currentY - headerHeight,
      width: tableWidth,
      height: headerHeight,
      color: COLORS.headerBg,
    });
    
    // Header text
    const headerY = currentY - 17;
    const headerSize = 9;
    
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
    const rowHeight = 50; // Smaller row height
    const subtotalRowHeight = 22; // Even smaller for subtotal rows
    const rowSize = 9;
    const lineHeight = 11;
    const borderColor = rgb(0.85, 0.85, 0.85);
    
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
        color: rgb(0.95, 0.96, 0.96),
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
      const totalHeight = 30;
      const totalY = currentY - totalHeight;
      
      // Total background
      treatmentPage.drawRectangle({
        x: tableX,
        y: totalY,
        width: tableWidth,
        height: totalHeight,
        color: rgb(0.9, 0.9, 0.9),
      });
      
      // Total label
      const totalLabelSize = 10;
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

// Helper to trigger download
export function downloadPdf(pdfBytes: Uint8Array, filename: string): void {
  // Create a new ArrayBuffer copy to avoid SharedArrayBuffer issues
  const buffer = new ArrayBuffer(pdfBytes.length);
  const view = new Uint8Array(buffer);
  view.set(pdfBytes);
  
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

