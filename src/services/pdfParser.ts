import * as pdfjsLib from 'pdfjs-dist';
import type { Location, TreatmentItem } from '@/types';

// Configure PDF.js worker using the local worker from node_modules
// This uses Vite's ?url import to get the correct path
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

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
    const line = lines[i].trim();
    
    // Look for "Patient:" or "Name:" patterns
    const patientMatch = line.match(/(?:Patient|Name)[:\s]+(.+)/i);
    if (patientMatch) {
      return patientMatch[1].trim();
    }
    
    // Look for lines that are ONLY "Mr/Mrs/Ms/Miss/Dr" followed by a name
    // This catches standalone patient name lines like "Mr Edison Nguyen"
    const titleMatch = line.match(/^(Mr|Mrs|Ms|Miss|Dr)\.?\s+([A-Za-z]+(?:\s+[A-Za-z]+)*)$/i);
    if (titleMatch) {
      // Make sure this isn't part of doctor info (Plan by: Dr...)
      if (!lines.some(l => l.includes('Plan by') && l.includes(line))) {
        return line.trim();
      }
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
// Table structure: Phase | Visit No | Time Min | Item | Times | Description | Tooth | Fee | Amount
function parseTreatmentItems(lines: string[]): TreatmentItem[] {
  const items: TreatmentItem[] = [];
  const seenItemCodes = new Set<string>();
  
  for (const line of lines) {
    // Skip header lines and non-data lines
    if (line.includes('Phase') || line.includes('Visit') || line.includes('Item') ||
        line.includes('Description') || line.includes('Tooth') || line.includes('Fee') ||
        line.includes('Amount') || line.includes('NOTE:') || line.includes('TREATMENT PLAN') ||
        line.includes('Date Created') || line.includes('Plan by') || line.includes('Card No') ||
        line.includes('SIA Dental') || line.includes('Phone:') || line.includes('Email:') ||
        line.includes('Patient Signature') || line.includes('Time left') ||
        line.includes('Initial Estimated') || line.includes('Remaining') ||
        line.includes('Amount for Phase')) {
      continue;
    }
    
    // Look for 3-digit item codes anywhere in the line
    // Pattern: captures item code followed by quantity and description
    // Example line: "1 532 1 Adhesive restoration - two surfaces - posterior tooth - direct 16 255.00 255.00"
    
    // Try to find a 3-digit dental item code (usually 0xx, 1xx, 2xx, 3xx, 4xx, 5xx, 6xx, 7xx, 8xx, 9xx)
    const itemCodeMatches = line.match(/\b(\d{3})\b/g);
    
    if (itemCodeMatches) {
      for (const potentialCode of itemCodeMatches) {
        // Skip if this looks like a year, fee amount, or we've already seen this code
        if (potentialCode.startsWith('20') || potentialCode.startsWith('19')) continue;
        if (seenItemCodes.has(potentialCode)) continue;
        
        // Check if this is a valid dental item code (typically 011-999)
        const codeNum = parseInt(potentialCode, 10);
        if (codeNum < 11 || codeNum > 999) continue;
        
        // Found a potential item code, now parse the rest of the line
        const itemCode = potentialCode;
        
        // Try to extract description, tooth, and fee from the line
        // The line format after item code is typically: Times Description Tooth Fee Amount
        
        // Find all numbers in the line (could be tooth numbers or fees)
        const numbers = line.match(/\b\d+\.?\d*\b/g) || [];
        
        // Look for decimal numbers (fees)
        const fees = numbers.filter(n => n.includes('.') && parseFloat(n) > 10);
        const fee = fees.length > 0 ? parseFloat(fees[0]) : 0;
        
        // Look for tooth numbers (1-48, typically)
        const toothNumbers = numbers.filter(n => {
          const num = parseInt(n, 10);
          return !n.includes('.') && num >= 11 && num <= 48 && n !== itemCode;
        });
        const tooth = toothNumbers.length > 0 ? toothNumbers[0] : '';
        
        // Extract description - everything that's not a number between the item code and tooth/fee
        // Remove all numbers and get the remaining text
        let description = line
          .replace(/\b\d+\.?\d*\b/g, ' ')  // Remove all numbers
          .replace(/\s+/g, ' ')             // Normalize whitespace
          .trim();
        
        // Clean up description - remove common artifacts
        description = description
          .replace(/^[-–]\s*/, '')          // Remove leading dash
          .replace(/\s*[-–]\s*$/, '')       // Remove trailing dash
          .trim();
        
        if (itemCode && (description || fee > 0)) {
          seenItemCodes.add(itemCode);
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

