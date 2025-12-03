import * as pdfjsLib from 'pdfjs-dist';
import type { Location, TreatmentItem } from '@/types';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export interface ParsedTreatmentPlan {
  patientName: string;
  doctorName: string;
  location: Location | null;
  date: string;
  items: TreatmentItem[];
}

interface ParseError {
  field: string;
  message: string;
}

export interface ParseResult {
  success: boolean;
  data?: ParsedTreatmentPlan;
  errors: ParseError[];
  warnings: string[];
}

// Extract text content from PDF
async function extractTextFromPdf(file: File): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  const textLines: string[] = [];
  
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Group text items by their y-position to reconstruct lines
    const items = textContent.items as { str: string; transform: number[] }[];
    
    // Sort by Y position (descending) then X position (ascending)
    const sortedItems = items
      .filter(item => item.str.trim())
      .sort((a, b) => {
        const yDiff = b.transform[5] - a.transform[5];
        if (Math.abs(yDiff) > 5) return yDiff;
        return a.transform[4] - b.transform[4];
      });
    
    // Group items into lines based on Y position
    let currentY = -1;
    let currentLine = '';
    
    for (const item of sortedItems) {
      const y = Math.round(item.transform[5]);
      
      if (currentY === -1 || Math.abs(y - currentY) > 5) {
        if (currentLine.trim()) {
          textLines.push(currentLine.trim());
        }
        currentLine = item.str;
        currentY = y;
      } else {
        currentLine += ' ' + item.str;
      }
    }
    
    if (currentLine.trim()) {
      textLines.push(currentLine.trim());
    }
  }
  
  return textLines;
}

// Parse location from header
function parseLocation(lines: string[]): Location | null {
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes('sia dental')) {
      if (lowerLine.includes('essendon')) return 'essendon';
      if (lowerLine.includes('burwood')) return 'burwood';
      if (lowerLine.includes('mulgrave')) return 'mulgrave';
    }
  }
  return null;
}

// Parse doctor name from "Plan by:" line
function parseDoctorName(lines: string[]): string {
  for (const line of lines) {
    // Match patterns like "Plan by: 1 - Default, Dr Provider" or "Plan by: Dr Smith"
    const planByMatch = line.match(/Plan\s*by[:\s]*(.+)/i);
    if (planByMatch) {
      let doctorPart = planByMatch[1].trim();
      
      // Remove leading number and dash (e.g., "1 - Default, Dr Provider" -> "Default, Dr Provider")
      doctorPart = doctorPart.replace(/^\d+\s*[-–]\s*/, '');
      
      // Remove "Default," prefix if present
      doctorPart = doctorPart.replace(/^Default\s*,\s*/i, '');
      
      return doctorPart.trim();
    }
  }
  return '';
}

// Parse patient name - look for common patterns
function parsePatientName(lines: string[]): string {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Look for "Patient:" or "Name:" patterns
    const patientMatch = line.match(/(?:Patient|Name)[:\s]+(.+)/i);
    if (patientMatch) {
      return patientMatch[1].trim();
    }
    
    // Look for "Mr/Mrs/Ms/Dr" followed by name
    const titleMatch = line.match(/^(Mr|Mrs|Ms|Miss|Dr)\.?\s+(.+)/i);
    if (titleMatch) {
      return line.trim();
    }
  }
  return '';
}

// Parse date from document
function parseDate(lines: string[]): string {
  for (const line of lines) {
    // Match "Date Created: DD/MM/YYYY" pattern
    const dateMatch = line.match(/Date\s*Created[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i);
    if (dateMatch) {
      // Convert DD/MM/YYYY to YYYY-MM-DD for input[type="date"]
      const [day, month, year] = dateMatch[1].split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }
  
  // Return today's date if not found
  return new Date().toISOString().split('T')[0];
}

// Parse treatment items from table
function parseTreatmentItems(lines: string[]): TreatmentItem[] {
  const items: TreatmentItem[] = [];
  
  // Common dental item code patterns (3 digit codes)
  const itemCodePattern = /^(\d{3})\s+/;
  
  // Look for lines that start with item codes
  for (const line of lines) {
    const match = line.match(itemCodePattern);
    if (match) {
      const itemCode = match[1];
      const restOfLine = line.substring(match[0].length).trim();
      
      // Try to parse: [tooth] [description] [qty] [fee]
      // Example: "18 Extraction - Simple $180.00"
      // Or: "Examination - Comprehensive $80.00"
      
      let tooth = '';
      let description = '';
      let fee = 0;
      
      // Extract fee from end of line
      const feeMatch = restOfLine.match(/\$?([\d,]+\.?\d*)\s*$/);
      if (feeMatch) {
        fee = parseFloat(feeMatch[1].replace(',', ''));
      }
      
      // Remove fee from line to get tooth and description
      let remaining = restOfLine.replace(/\$?[\d,]+\.?\d*\s*$/, '').trim();
      
      // Check if line starts with tooth number (1-2 digits)
      const toothMatch = remaining.match(/^(\d{1,2})\s+/);
      if (toothMatch) {
        tooth = toothMatch[1];
        description = remaining.substring(toothMatch[0].length).trim();
      } else {
        description = remaining;
      }
      
      // Remove quantity if present at end of description (e.g., "x1" or "1")
      description = description.replace(/\s*x?\d+\s*$/, '').trim();
      
      if (itemCode && (description || fee > 0)) {
        items.push({
          id: crypto.randomUUID(),
          itemCode,
          tooth,
          description,
          fee,
        });
      }
    }
  }
  
  return items;
}

// Main parse function
export async function parseTreatmentPlanPdf(file: File): Promise<ParseResult> {
  const errors: ParseError[] = [];
  const warnings: string[] = [];
  
  try {
    // Validate file type
    if (!file.type.includes('pdf')) {
      return {
        success: false,
        errors: [{ field: 'file', message: 'Please upload a valid PDF file' }],
        warnings: [],
      };
    }
    
    // Extract text from PDF
    const lines = await extractTextFromPdf(file);
    
    if (lines.length === 0) {
      return {
        success: false,
        errors: [{ field: 'file', message: 'Could not extract text from PDF. The file may be image-based or corrupted.' }],
        warnings: [],
      };
    }
    
    // Debug: log extracted lines
    console.log('Extracted lines:', lines);
    
    // Parse each field
    const location = parseLocation(lines);
    const doctorName = parseDoctorName(lines);
    const patientName = parsePatientName(lines);
    const date = parseDate(lines);
    const items = parseTreatmentItems(lines);
    
    // Validate extracted data
    if (!location) {
      warnings.push('Could not detect clinic location. Please select manually.');
    }
    
    if (!doctorName) {
      warnings.push('Could not detect doctor name. Please enter manually.');
    }
    
    if (!patientName) {
      warnings.push('Could not detect patient name. Please enter manually.');
    }
    
    if (items.length === 0) {
      warnings.push('No treatment items found. You may need to add them manually.');
    }
    
    return {
      success: true,
      data: {
        patientName,
        doctorName,
        location,
        date,
        items,
      },
      errors,
      warnings,
    };
  } catch (error) {
    console.error('PDF parsing error:', error);
    return {
      success: false,
      errors: [{ 
        field: 'file', 
        message: error instanceof Error ? error.message : 'Failed to parse PDF file' 
      }],
      warnings: [],
    };
  }
}

