import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TreatmentPlanData, TemplateSettings, Team } from '@/types';
import { LOCATION_TO_TEAM, DEFAULT_TEMPLATE_PATHS, PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT } from '@/types';

interface CanvasPreviewProps {
  data: TreatmentPlanData;
  settings: TemplateSettings;
}

// Page aspect ratio (height / width) - Custom size: 810 x 1440 points
const PAGE_RATIO = PDF_PAGE_HEIGHT / PDF_PAGE_WIDTH;

export function CanvasPreview({ data, settings }: CanvasPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [images, setImages] = useState<Record<string, HTMLImageElement>>({});
  const [doctorPhotoImg, setDoctorPhotoImg] = useState<HTMLImageElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Calculate total pages
  const validItems = data.items.filter(item => item.itemCode || item.description);
  const itemPages = Math.max(1, Math.ceil(validItems.length / settings.maxRowsPerPage));
  const totalPages = 1 + itemPages + 1; // Cover + Treatment pages + Team page

  // Load template images
  useEffect(() => {
    const imagesToLoad = [
      { key: 'cover', src: DEFAULT_TEMPLATE_PATHS.coverImage },
      { key: 'treatment', src: DEFAULT_TEMPLATE_PATHS.treatmentImage },
      { key: 'continuation', src: DEFAULT_TEMPLATE_PATHS.continuationImage },
      { key: 'team-essendon', src: DEFAULT_TEMPLATE_PATHS.teamImages.essendon },
      { key: 'team-burwood', src: DEFAULT_TEMPLATE_PATHS.teamImages.burwood },
      { key: 'team-mulgrave', src: DEFAULT_TEMPLATE_PATHS.teamImages.mulgrave },
    ];

    let loadedCount = 0;
    const loadedImages: Record<string, HTMLImageElement> = {};

    imagesToLoad.forEach(({ key, src }) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        loadedImages[key] = img;
        loadedCount++;
        if (loadedCount === imagesToLoad.length) {
          setImages(loadedImages);
          setIsLoading(false);
        }
      };
      img.onerror = () => {
        console.error(`Failed to load image: ${src}`);
        loadedCount++;
        if (loadedCount === imagesToLoad.length) {
          setImages(loadedImages);
          setIsLoading(false);
        }
      };
      img.src = src;
    });
  }, []);

  // Load doctor photo when it changes
  useEffect(() => {
    if (data.doctorPhoto) {
      const img = new Image();
      img.onload = () => setDoctorPhotoImg(img);
      img.onerror = () => setDoctorPhotoImg(null);
      img.src = data.doctorPhoto;
    } else {
      setDoctorPhotoImg(null);
    }
  }, [data.doctorPhoto]);

  // Draw canvas
  useEffect(() => {
    if (isLoading || !canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size based on container
    const containerWidth = containerRef.current.clientWidth;
    const canvasWidth = containerWidth;
    const canvasHeight = canvasWidth * PAGE_RATIO;
    
    canvas.width = canvasWidth * 2; // 2x for retina
    canvas.height = canvasHeight * 2;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    ctx.scale(2, 2);

    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Determine which page to draw
    const team: Team = LOCATION_TO_TEAM[data.location];
    
    if (currentPage === 0) {
      // Cover page
      drawCoverPage(ctx, canvasWidth, canvasHeight, images.cover, data, settings, doctorPhotoImg);
    } else if (currentPage < 1 + itemPages) {
      // Treatment page
      const pageIndex = currentPage - 1;
      const isFirstTreatmentPage = pageIndex === 0;
      const bgImage = isFirstTreatmentPage ? images.treatment : images.continuation;
      const startIndex = pageIndex * settings.maxRowsPerPage;
      const pageItems = validItems.slice(startIndex, startIndex + settings.maxRowsPerPage);
      const isLastTreatmentPage = currentPage === itemPages;
      
      drawTreatmentPage(ctx, canvasWidth, canvasHeight, bgImage, pageItems, data.totalAmount, settings, isLastTreatmentPage);
    } else {
      // Team page
      const teamImage = images[`team-${team}`];
      drawTeamPage(ctx, canvasWidth, canvasHeight, teamImage);
    }
  }, [currentPage, data, settings, images, isLoading, validItems.length, doctorPhotoImg]);

  // Navigation
  const goToPrevPage = () => setCurrentPage(p => Math.max(0, p - 1));
  const goToNextPage = () => setCurrentPage(p => Math.min(totalPages - 1, p + 1));

  // Page labels
  const getPageLabel = () => {
    if (currentPage === 0) return 'Cover';
    if (currentPage < 1 + itemPages) return `Treatment ${currentPage}/${itemPages}`;
    return 'Team';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 bg-muted rounded-lg">
        <p className="text-muted-foreground">Loading preview...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Canvas */}
      <div ref={containerRef} className="w-full bg-gray-100 rounded-lg overflow-hidden shadow-inner">
        <canvas ref={canvasRef} className="w-full" />
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={goToPrevPage}
          disabled={currentPage === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>
        
        <span className="text-sm text-muted-foreground">
          Page {currentPage + 1} of {totalPages} ({getPageLabel()})
        </span>
        
        <Button
          variant="outline"
          size="sm"
          onClick={goToNextPage}
          disabled={currentPage === totalPages - 1}
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// Draw cover page
function drawCoverPage(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  bgImage: HTMLImageElement | undefined,
  data: TreatmentPlanData,
  settings: TemplateSettings,
  doctorPhotoImg: HTMLImageElement | null
) {
  // Draw background
  if (bgImage) {
    ctx.drawImage(bgImage, 0, 0, width, height);
  }

  // Scale factor (canvas to PDF points) - using actual page height
  const scale = height / PDF_PAGE_HEIGHT;

  // Draw intro text above patient name box
  ctx.fillStyle = '#1F2937'; // Dark gray
  ctx.font = `${32 * scale}px Nunito, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Intro text position (above the white box)
  const introY = height - (580 * scale); // Position above the name box
  ctx.fillText('A personalised', width / 2, introY);
  ctx.fillText('treatment plan for:', width / 2, introY + (40 * scale));

  // Draw patient name (purple, centered in the white box area) - using font size from settings
  ctx.fillStyle = '#A5338D'; // SIA Purple
  ctx.font = `bold ${settings.patientNameFontSize * scale}px Nunito, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Patient name position (convert from PDF coords - bottom-left origin to canvas - top-left origin)
  const patientNameY = height - (settings.patientNamePosition.y * scale);
  ctx.fillText(data.patientName || 'Patient Name', width / 2, patientNameY);

  // Draw doctor photo if available (circular, using settings for position)
  const photoSize = settings.doctorPhotoPosition.size * scale;
  const photoX = settings.doctorPhotoPosition.x * scale;
  const photoY = height - ((settings.doctorPhotoPosition.y + settings.doctorPhotoPosition.size) * scale); // Convert from bottom-left origin
  
  if (doctorPhotoImg) {
    ctx.save();
    // Create circular clipping path
    ctx.beginPath();
    ctx.arc(photoX + photoSize / 2, photoY + photoSize / 2, photoSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    // Draw the image
    ctx.drawImage(doctorPhotoImg, photoX, photoY, photoSize, photoSize);
    ctx.restore();
    
    // Draw circular border
    ctx.strokeStyle = '#2BBFB3'; // SIA Teal
    ctx.lineWidth = 3 * scale;
    ctx.beginPath();
    ctx.arc(photoX + photoSize / 2, photoY + photoSize / 2, photoSize / 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Draw doctor name (black, left aligned) - using font size from settings
  ctx.fillStyle = '#000000'; // Black
  ctx.font = `800 ${settings.doctorNameFontSize * scale}px Nunito, sans-serif`; // Extra bold
  ctx.textAlign = 'left';
  const doctorNameX = settings.doctorNamePosition.x * scale;
  const doctorNameY = height - (settings.doctorNamePosition.y * scale);
  ctx.fillText(data.doctorName || 'Doctor Name', doctorNameX, doctorNameY);
}

// Draw treatment page
function drawTreatmentPage(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  bgImage: HTMLImageElement | undefined,
  items: TreatmentPlanData['items'],
  totalAmount: number,
  settings: TemplateSettings,
  showTotal: boolean
) {
  // Draw background
  if (bgImage) {
    ctx.drawImage(bgImage, 0, 0, width, height);
  }

  const scale = height / PDF_PAGE_HEIGHT;
  
  // Table dimensions
  const tableX = settings.tableMarginX * scale;
  const tableWidth = width - (tableX * 2);
  let currentY = height - (settings.tableStartY * scale);

  // Column widths - Phase | Visit | Item | Times | Description | Tooth | Fee | Amount
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
  const headerHeight = 28 * scale;
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(tableX, currentY, tableWidth, headerHeight);

  // Header text (centered in each column)
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${9 * scale}px Nunito, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  const headerY = currentY + headerHeight / 2;
  let headerX = tableX;
  
  ctx.fillText('Phase', headerX + colWidths.phase / 2, headerY);
  headerX += colWidths.phase;
  ctx.fillText('Visit', headerX + colWidths.visit / 2, headerY);
  headerX += colWidths.visit;
  ctx.fillText('Item', headerX + colWidths.item / 2, headerY);
  headerX += colWidths.item;
  ctx.fillText('Times', headerX + colWidths.times / 2, headerY);
  headerX += colWidths.times;
  ctx.fillText('Description', headerX + colWidths.description / 2, headerY);
  headerX += colWidths.description;
  ctx.fillText('Tooth', headerX + colWidths.tooth / 2, headerY);
  headerX += colWidths.tooth;
  ctx.fillText('Fee', headerX + colWidths.fee / 2, headerY);
  headerX += colWidths.fee;
  ctx.fillText('Amount', headerX + colWidths.amount / 2, headerY);

  currentY += headerHeight;

  // Draw rows - more compact
  const rowHeight = 50 * scale; // Smaller row height
  const subtotalRowHeight = 22 * scale; // Even smaller for subtotal rows
  const rowSize = 9 * scale;
  const lineHeight = 11 * scale;

  // Group items by phase and visit to calculate subtotals
  let lastPhase = -1;
  let lastVisit = -1;
  let visitSubtotal = 0;

  items.forEach((item, index) => {
    const currentPhase = item.phase || 1;
    const currentVisit = item.visitNo || 1;
    
    // Check if we need to draw a subtotal row for the previous visit
    if (lastPhase !== -1 && (currentPhase !== lastPhase || currentVisit !== lastVisit)) {
      // Draw subtotal row for previous visit
      drawSubtotalRow(ctx, tableX, currentY, tableWidth, subtotalRowHeight, lastPhase, lastVisit, visitSubtotal, scale);
      currentY += subtotalRowHeight;
      visitSubtotal = 0;
    }
    
    lastPhase = currentPhase;
    lastVisit = currentVisit;
    
    // Calculate item total and add to visit subtotal
    const itemTotal = (item.fees || []).reduce((sum, f) => sum + f.quantity * f.unitFee, 0);
    visitSubtotal += itemTotal;

    // Draw cell borders
    ctx.strokeStyle = '#d9d9d9';
    ctx.lineWidth = 1;
    
    // Left border
    ctx.beginPath();
    ctx.moveTo(tableX, currentY);
    ctx.lineTo(tableX, currentY + rowHeight);
    ctx.stroke();
    
    // Column separators
    let colX = tableX + colWidths.phase;
    ctx.beginPath();
    ctx.moveTo(colX, currentY);
    ctx.lineTo(colX, currentY + rowHeight);
    ctx.stroke();
    
    colX += colWidths.visit;
    ctx.beginPath();
    ctx.moveTo(colX, currentY);
    ctx.lineTo(colX, currentY + rowHeight);
    ctx.stroke();
    
    colX += colWidths.item;
    ctx.beginPath();
    ctx.moveTo(colX, currentY);
    ctx.lineTo(colX, currentY + rowHeight);
    ctx.stroke();
    
    colX += colWidths.times;
    ctx.beginPath();
    ctx.moveTo(colX, currentY);
    ctx.lineTo(colX, currentY + rowHeight);
    ctx.stroke();
    
    colX += colWidths.description;
    ctx.beginPath();
    ctx.moveTo(colX, currentY);
    ctx.lineTo(colX, currentY + rowHeight);
    ctx.stroke();
    
    colX += colWidths.tooth;
    ctx.beginPath();
    ctx.moveTo(colX, currentY);
    ctx.lineTo(colX, currentY + rowHeight);
    ctx.stroke();
    
    colX += colWidths.fee;
    ctx.beginPath();
    ctx.moveTo(colX, currentY);
    ctx.lineTo(colX, currentY + rowHeight);
    ctx.stroke();
    
    // Right border
    ctx.beginPath();
    ctx.moveTo(tableX + tableWidth, currentY);
    ctx.lineTo(tableX + tableWidth, currentY + rowHeight);
    ctx.stroke();
    
    // Bottom row border
    ctx.beginPath();
    ctx.moveTo(tableX, currentY + rowHeight);
    ctx.lineTo(tableX + tableWidth, currentY + rowHeight);
    ctx.stroke();

    ctx.font = `${rowSize}px Nunito, sans-serif`;
    ctx.fillStyle = '#1f2937';

    // Phase (centered)
    ctx.textAlign = 'center';
    ctx.fillText(String(item.phase || 1), tableX + colWidths.phase / 2, currentY + rowHeight / 2);

    // Visit (centered)
    let cellX = tableX + colWidths.phase;
    ctx.fillText(String(item.visitNo || 1), cellX + colWidths.visit / 2, currentY + rowHeight / 2);

    // Item code (centered)
    cellX += colWidths.visit;
    ctx.fillText(item.itemCode, cellX + colWidths.item / 2, currentY + rowHeight / 2);

    // Times (centered)
    cellX += colWidths.item;
    ctx.fillText(String(item.times || 1), cellX + colWidths.times / 2, currentY + rowHeight / 2);

    // Description (multi-line, left-aligned)
    cellX += colWidths.times;
    ctx.textAlign = 'left';
    const descX = cellX + 4 * scale;
    const maxDescWidth = colWidths.description - 8 * scale;
    const words = item.description.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    words.forEach(word => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(testLine).width <= maxDescWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    });
    if (currentLine) lines.push(currentLine);
    
    // Center text vertically
    const totalTextHeight = lines.length * lineHeight;
    let textY = currentY + (rowHeight - totalTextHeight) / 2 + lineHeight * 0.7;
    
    lines.forEach(line => {
      ctx.fillText(line, descX, textY);
      textY += lineHeight;
    });

    // Tooth (centered)
    cellX += colWidths.description;
    ctx.textAlign = 'center';
    ctx.fillText(item.tooth || '', cellX + colWidths.tooth / 2, currentY + rowHeight / 2);

    // Fee (centered) - show unit fee from first fee entry
    cellX += colWidths.tooth;
    const unitFee = item.fees?.[0]?.unitFee || 0;
    ctx.fillText(`${unitFee.toFixed(2)}`, cellX + colWidths.fee / 2, currentY + rowHeight / 2);

    // Amount (right-aligned) - total for this item
    ctx.textAlign = 'right';
    ctx.font = `bold ${rowSize}px Nunito, sans-serif`;
    ctx.fillText(`${itemTotal.toFixed(2)}`, tableX + tableWidth - 6 * scale, currentY + rowHeight / 2);

    currentY += rowHeight;
    
    // If this is the last item, draw the final subtotal
    if (index === items.length - 1) {
      drawSubtotalRow(ctx, tableX, currentY, tableWidth, subtotalRowHeight, currentPhase, currentVisit, visitSubtotal, scale);
      currentY += subtotalRowHeight;
    }
  });

  // Draw total
  if (showTotal) {
    const totalHeight = 30 * scale;
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(tableX, currentY, tableWidth, totalHeight);

    ctx.fillStyle = '#1f2937';
    ctx.font = `bold ${10 * scale}px Nunito, sans-serif`;
    ctx.textAlign = 'right';
    
    const totalY = currentY + totalHeight / 2;
    ctx.fillText('TOTAL AMOUNT:', tableX + tableWidth - 100 * scale, totalY);
    ctx.fillText(`$${totalAmount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, tableX + tableWidth - 6 * scale, totalY);
  }
}

// Helper function to draw subtotal row
function drawSubtotalRow(
  ctx: CanvasRenderingContext2D,
  tableX: number,
  currentY: number,
  tableWidth: number,
  rowHeight: number,
  phase: number,
  visit: number,
  subtotal: number,
  scale: number
) {
  // Light gray background for subtotal row
  ctx.fillStyle = '#f3f4f6';
  ctx.fillRect(tableX, currentY, tableWidth, rowHeight);
  
  // Border
  ctx.strokeStyle = '#d9d9d9';
  ctx.lineWidth = 1;
  ctx.strokeRect(tableX, currentY, tableWidth, rowHeight);
  
  // Subtotal text
  ctx.fillStyle = '#1f2937';
  ctx.font = `bold ${8 * scale}px Nunito, sans-serif`;
  ctx.textAlign = 'right';
  
  const labelText = `Amount for Phase ${phase}  - Visit ${visit}`;
  ctx.fillText(labelText, tableX + tableWidth - 80 * scale, currentY + rowHeight / 2);
  ctx.fillText(`${subtotal.toFixed(2)}`, tableX + tableWidth - 6 * scale, currentY + rowHeight / 2);
}

// Draw team page
function drawTeamPage(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  bgImage: HTMLImageElement | undefined
) {
  if (bgImage) {
    ctx.drawImage(bgImage, 0, 0, width, height);
  }
}

