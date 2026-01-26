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
// Example lines:
// "1 1 118 1 Bleaching, External - per tooth 550.00 550.00"
// "2 2 532 1 Adhesive restoration - two surfaces - posterior tooth - direct 35 255.00 255.00"
// "3 119 1 Bleaching, Home Application - per arch 197.50 197.50" (missing visit no)
function parseTreatmentItems(lines: string[]): TreatmentItem[] {
  const items: TreatmentItem[] = [];
  let lastPhase = 1;
  let lastVisitNo = 1;
  // let pendingDescription = '';
  let pendingItem: TreatmentItem | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
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
        line.includes('INVOICE') || line.includes('RECEIPT') ||
        line.includes('This treatment plan') || line.includes('next appointment') ||
        line.includes('Outstanding Status') || line.includes('Total Deposit') ||
        line.includes('Current') || line.includes('-- ')) {
      continue;
    }
    
    // Skip address lines
    if (line.match(/\b(Hwy|Highway|Rd|Road|St|Street|Ave|Avenue|Ct|Court|Pl|Place)\b/i) ||
        line.match(/\b(VIC|NSW|QLD|SA|WA|TAS|NT|ACT)\s*,?\s*\d{4}\b/i) ||
        line.match(/^\d{3,4}\s+(VIC|NSW|QLD|SA|WA|TAS|NT|ACT)\b/i)) {
      continue;
    }
    
    // Check if this is a treatment row by looking for the pattern:
    // [Phase] [VisitNo] ItemCode Times Description [Tooth] Fee Amount
    // Item codes are 3-digit numbers (011-999), typically in ranges like 1XX, 2XX, 3XX, etc.
    
    // Pattern 1: Full line with Phase and VisitNo
    // "1 1 118 1 Bleaching, External - per tooth 550.00 550.00"
    const fullPattern = /^(\d)\s+(\d+)\s+(\d{3})\s+(\d+)\s+(.+?)\s+(\d+\.\d{2})\s+(\d+\.\d{2})$/;
    
    // Pattern 2: Line with Phase but no VisitNo (or Phase is same as VisitNo)
    // "3 119 1 Bleaching, Home Application - per arch 197.50 197.50"
    const shortPattern = /^(\d)\s+(\d{3})\s+(\d+)\s+(.+?)\s+(\d+\.\d{2})\s+(\d+\.\d{2})$/;
    
    // Pattern 3: Just item code line (continuation or no phase/visit)
    // "119 1 Bleaching, Home Application - per arch 197.50 197.50"
    const minimalPattern = /^(\d{3})\s+(\d+)\s+(.+?)\s+(\d+\.\d{2})\s+(\d+\.\d{2})$/;
    
    let match = line.match(fullPattern);
    if (match) {
      // Full pattern: Phase VisitNo ItemCode Times Description Fee Amount
      const [, phase, visitNo, itemCode, times, descPart, fee] = match;
      lastPhase = parseInt(phase, 10);
      lastVisitNo = parseInt(visitNo, 10);
      
      // Extract tooth number from description if present (2 digits before fee, typically 11-48 or 51-85)
      const { description, tooth } = extractToothFromDescription(descPart);
      
      if (pendingItem) {
        items.push(pendingItem);
      }
      
      pendingItem = {
        id: crypto.randomUUID(),
        phase: lastPhase,
        visitNo: lastVisitNo,
        itemCode,
        times: parseInt(times, 10),
        description,
        tooth,
        fees: [{ id: crypto.randomUUID(), quantity: 1, unitFee: parseFloat(fee) }],
      };
      continue;
    }
    
    match = line.match(shortPattern);
    if (match) {
      // Short pattern: Phase ItemCode Times Description Fee Amount (VisitNo might be implicit)
      const [, phase, itemCode, times, descPart, fee] = match;
      lastPhase = parseInt(phase, 10);
      // Keep last visit number or increment
      
      const { description, tooth } = extractToothFromDescription(descPart);
      
      if (pendingItem) {
        items.push(pendingItem);
      }
      
      pendingItem = {
        id: crypto.randomUUID(),
        phase: lastPhase,
        visitNo: lastVisitNo,
        itemCode,
        times: parseInt(times, 10),
        description,
        tooth,
        fees: [{ id: crypto.randomUUID(), quantity: 1, unitFee: parseFloat(fee) }],
      };
      continue;
    }
    
    match = line.match(minimalPattern);
    if (match) {
      // Minimal pattern: ItemCode Times Description Fee Amount
      const [, itemCode, times, descPart, fee] = match;
      
      const { description, tooth } = extractToothFromDescription(descPart);
      
      if (pendingItem) {
        items.push(pendingItem);
      }
      
      pendingItem = {
        id: crypto.randomUUID(),
        phase: lastPhase,
        visitNo: lastVisitNo,
        itemCode,
        times: parseInt(times, 10),
        description,
        tooth,
        fees: [{ id: crypto.randomUUID(), quantity: 1, unitFee: parseFloat(fee) }],
      };
      continue;
    }
    
    // Check if this line is a continuation of a multi-line description
    // (text only, no item code pattern at start)
    if (pendingItem && line.match(/^[a-zA-Z]/) && !line.match(/^\d/)) {
      // This might be a continuation line for the description
      // Only append if it looks like description text (not an address or other data)
      if (!line.match(/\b(Phone|Email|VIC|NSW|QLD|SA|WA|TAS|NT|ACT|min|Total|Signature)\b/i)) {
        pendingItem.description += ' ' + line.replace(/\s+/g, ' ').trim();
      }
    }
  }
  
  // Don't forget the last item
  if (pendingItem) {
    items.push(pendingItem);
  }
  
  return items;
}

// Helper function to extract tooth number from description
// Tooth numbers are typically 2-digit: 11-48 (permanent teeth) or 51-85 (primary teeth)
function extractToothFromDescription(descPart: string): { description: string; tooth: string } {
  // Look for tooth number pattern at the end of description (before where fee would be)
  // Pattern: description text followed by 2-digit tooth number
  const toothMatch = descPart.match(/^(.+?)\s+(\d{2})$/);
  
  if (toothMatch) {
    const [, desc, potentialTooth] = toothMatch;
    const toothNum = parseInt(potentialTooth, 10);
    
    // Valid tooth numbers: 11-18, 21-28, 31-38, 41-48 (permanent) or 51-55, 61-65, 71-75, 81-85 (primary)
    if ((toothNum >= 11 && toothNum <= 48) || (toothNum >= 51 && toothNum <= 85)) {
      // Verify it's a valid tooth position
      const ones = toothNum % 10;
      const tens = Math.floor(toothNum / 10);
      
      if (tens >= 1 && tens <= 4 && ones >= 1 && ones <= 8) {
        return { description: desc.trim(), tooth: potentialTooth };
      }
      if (tens >= 5 && tens <= 8 && ones >= 1 && ones <= 5) {
        return { description: desc.trim(), tooth: potentialTooth };
      }
    }
  }
  
  return { description: descPart.trim(), tooth: '' };
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

