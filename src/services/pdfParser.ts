import * as pdfjsLib from 'pdfjs-dist';
import type { Location, TreatmentItem } from '@/types';
import { getDentistByName } from '@/data/dentists';

// Configure PDF.js worker using the local worker from node_modules
// This uses Vite's ?url import to get the correct path
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface ParsedTreatmentPlan {
  patientName: string;
  doctorName: string;
  doctorPhoto?: string;
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
    // Also handles "Plan by:**1 - Default, Dr Provider" with asterisks
    const planByMatch = line.match(/Plan\s*by[:\s]*(.+)/i);
    if (planByMatch) {
      let doctorPart = planByMatch[1].trim();
      
      // Remove leading asterisks
      doctorPart = doctorPart.replace(/^\*+/, '');
      
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
  // First pass: Look for lines containing "Mr/Mrs/Ms/Miss" title patterns
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Check if line contains a title (Mr/Mrs/Ms/Miss)
    if (/\b(Mr|Mrs|Ms|Miss)\b/i.test(trimmed)) {
      // Extract full name: Title + FirstName + LastName(s)
      const titleMatch = trimmed.match(/\b(Mr|Mrs|Ms|Miss)\.?\s+([A-Za-z]+(?:\s+[A-Za-z]+)*)/i);
      if (titleMatch) {
        const fullName = titleMatch[0].trim();
        // Make sure this isn't the doctor's name
        const isDoctor = lines.some(l => 
          l.toLowerCase().includes('plan by') && 
          l.toLowerCase().includes(fullName.toLowerCase())
        );
        if (!isDoctor) {
          return fullName;
        }
      }
    }
  }
  
  // Second pass: Look for "Patient:" or "Name:" label patterns
  for (const line of lines) {
    const patientMatch = line.match(/(?:Patient|Name)[:\s]+(.+)/i);
    if (patientMatch) {
      return patientMatch[1].trim();
    }
  }
  
  // Third pass: Look for capitalized name patterns (FirstName LastName)
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip common non-name lines
    if (/\b(SIA|Dental|Phone|Email|NOTE|TREATMENT|PLAN|INVOICE|RECEIPT|Date|Quote|Card|Phase|Visit|Amount|Signature|Fee|Remaining|Estimated|Tooth|Item|Description|Hwy|Highway|VIC|NSW|QLD|Burwood|Essendon|Mulgrave)\b/i.test(trimmed)) {
      continue;
    }
    
    // Check if line looks like a name (2-4 words, all starting with capital)
    const words = trimmed.split(/\s+/);
    if (words.length >= 2 && words.length <= 4) {
      const allCapitalized = words.every(w => /^[A-Z][a-z]+$/.test(w));
      if (allCapitalized) {
        const isDoctor = lines.some(l => 
          l.toLowerCase().includes('plan by') && 
          l.toLowerCase().includes(trimmed.toLowerCase())
        );
        if (!isDoctor) {
          return trimmed;
        }
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
  
  // First, find all fee amounts in the document to exclude them from item codes
  const feeAmounts = new Set<string>();
  for (const line of lines) {
    // Match numbers followed by .00 or .XX (fee format)
    const feeMatches = line.match(/(\d{2,3})\.(?:\d{2})/g);
    if (feeMatches) {
      feeMatches.forEach(fee => {
        const intPart = fee.split('.')[0];
        feeAmounts.add(intPart);
      });
    }
  }
  
  for (const line of lines) {
    // Skip header lines and non-data lines
    if (line.includes('Phase') || line.includes('Visit No') || 
        line.includes('Description') || line.includes('NOTE:') || 
        line.includes('TREATMENT PLAN') || line.includes('Date Created') || 
        line.includes('Date Printed') || line.includes('Plan by') || 
        line.includes('Card No') || line.includes('SIA Dental') || 
        line.includes('Phone:') || line.includes('Email:') ||
        line.includes('Patient Signature') || line.includes('Time left') ||
        line.includes('Initial Estimated') || line.includes('Remaining') ||
        line.includes('Amount for Phase') || line.includes('Quote') ||
        line.includes('INVOICE') || line.includes('RECEIPT')) {
      continue;
    }
    
    // Skip address lines (contain street types or postcodes)
    if (line.match(/\b(Hwy|Highway|Rd|Road|St|Street|Ave|Avenue|Dr|Drive|Ct|Court|Pl|Place)\b/i) ||
        line.match(/\b(VIC|NSW|QLD|SA|WA|TAS|NT|ACT)\s*,?\s*\d{4}\b/i) ||
        line.match(/\d{3,4}\s*[-–]\s*\d{3,4}/)) {  // Skip "138-440" style addresses
      continue;
    }
    
    // Look for treatment row pattern: starts with phase number (1-9), then has item code
    // Example: "1 532 1 Adhesive restoration..."
    // The line should contain descriptive text (letters) to be a treatment row
    if (!line.match(/[a-zA-Z]{3,}/)) {
      continue; // Skip lines without meaningful text
    }
    
    // Look for 3-digit item codes in the line
    // Use a more specific pattern: word boundary, 3 digits, word boundary
    // But NOT followed by a decimal point (which would make it a fee)
    const itemCodeMatches = line.match(/\b(\d{3})(?!\.\d)/g);
    
    if (itemCodeMatches) {
      for (const potentialCode of itemCodeMatches) {
        // Skip if this looks like a year
        if (potentialCode.startsWith('20') || potentialCode.startsWith('19')) continue;
        
        // Skip if we've already processed this code
        if (seenItemCodes.has(potentialCode)) continue;
        
        // Skip if this is actually a fee amount (appears as XXX.00 elsewhere)
        if (feeAmounts.has(potentialCode)) continue;
        
        // Check if this is a valid dental item code range
        const codeNum = parseInt(potentialCode, 10);
        if (codeNum < 11) continue;
        
        // Skip numbers that are clearly not item codes (common fee amounts)
        // Most dental item codes are in ranges: 011-099, 111-199, 211-299, etc.
        // Fee amounts like 255, 680 are less likely to be item codes
        
        const itemCode = potentialCode;
        
        // Extract fee - look for decimal numbers
        const feeMatch = line.match(/(\d+\.\d{2})/);
        const fee = feeMatch ? parseFloat(feeMatch[1]) : 0;
        
        // Extract tooth number - typically 11-48 for permanent teeth, 51-85 for primary
        const toothMatches = line.match(/\b([1-4][1-8]|[5-8][1-5])\b/g) || [];
        // Filter out the item code itself and numbers that might be phase/times
        const tooth = toothMatches.find(t => t !== itemCode && parseInt(t) >= 11) || '';
        
        // Extract description - text between numbers
        let description = line
          .replace(/\b\d+\.?\d*\b/g, ' ')  // Remove all numbers
          .replace(/\s+/g, ' ')             // Normalize whitespace
          .trim();
        
        // Clean up description
        description = description
          .replace(/^[-–]\s*/, '')
          .replace(/\s*[-–]\s*$/, '')
          .trim();
        
        // Only add if we have meaningful content
        if (itemCode && description.length > 3) {
          seenItemCodes.add(itemCode);
          items.push({
            id: crypto.randomUUID(),
            itemCode,
            tooth,
            description,
            fees: [{ id: crypto.randomUUID(), quantity: 1, unitFee: fee }],
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
    
    
    // Parse each field
    const location = parseLocation(lines);
    const doctorName = parseDoctorName(lines);
    const patientName = parsePatientName(lines);
    const date = parseDate(lines);
    const items = parseTreatmentItems(lines);
    
    // Auto-detect dentist photo and refine location if possible
    let doctorPhoto: string | undefined;
    let finalLocation = location;

    if (doctorName) {
      const dentist = getDentistByName(doctorName);
      if (dentist) {
        doctorPhoto = dentist.photoUrl;
        // If location wasn't detected but dentist belongs to only one location, use it
        if (!finalLocation && dentist.locations.length === 1) {
          finalLocation = dentist.locations[0];
        }
      }
    }
    
    // Validate extracted data
    if (!finalLocation) {
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
        doctorPhoto,
        location: finalLocation,
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

