// Patient Info
export interface PatientInfo {
  name: string;
  date: string;
  notes?: string;
}

// Fee Schedule Item
export interface FeeItem {
  code: string;
  name: string;
  description: string;
  fee: number;
}

// Treatment Line Item
export interface FeeEntry {
  id: string;
  quantity: number;
  unitFee: number;
}

export interface TreatmentItem {
  id: string;
  itemCode: string;
  description: string;
  tooth: string;
  fees: FeeEntry[];
}

// Location
export type Location = 'essendon' | 'burwood' | 'mulgrave';

// Team identifier
export type Team = 'essendon' | 'burwood' | 'mulgrave';

// Map location to team
export const LOCATION_TO_TEAM: Record<Location, Team> = {
  essendon: 'essendon',
  burwood: 'burwood',
  mulgrave: 'mulgrave',
};

// Template Settings (using PDF files)
export interface TemplateSettings {
  // PDF template paths
  coverPdf: string;              // Path to cover page PDF
  treatmentPdf: string;          // Path to treatment page PDF (blank)
  teamPdfs: {
    essendon: string;            // Path to Essendon team PDF
    burwood: string;             // Path to Burwood team PDF
    mulgrave: string;            // Path to Mulgrave team PDF
  };
  
  // Text positioning on cover page (in PDF points, origin bottom-left)
  patientNamePosition: { x: number; y: number };
  patientNameFontSize: number;   // Font size for patient name
  doctorNamePosition: { x: number; y: number };
  doctorNameFontSize: number;    // Font size for doctor name
  doctorPhotoPosition: { x: number; y: number; size: number }; // Photo position and size
  
  // Table positioning on treatment page
  tableStartY: number;           // Y position where table starts
  tableMarginX: number;          // Left/right margin for table
  rowHeight: number;             // Height per row
  maxRowsPerPage: number;        // Max rows before new page
}

// Location Details
export interface LocationDetails {
  name: string;
  website: string;
  phone: string;
  address: string;
}

export const LOCATIONS: Record<Location, LocationDetails> = {
  essendon: {
    name: 'Essendon',
    website: 'siadental.com.au',
    phone: '(03) 9289 3999',
    address: '1136-1140 Mt Alexander Rd, Essendon, VIC 3040',
  },
  burwood: {
    name: 'Burwood',
    website: 'siadentalburwood.com.au',
    phone: '(03) 8538 6199',
    address: '138-140 Burwood Hwy, Burwood, VIC 3125',
  },
  mulgrave: {
    name: 'Mulgrave',
    website: 'siadentalmulgrave.com.au',
    phone: '(03) 9289 3999',
    address: 'Level 1, 372 Wellington Rd, Mulgrave, VIC 3170',
  },
};

// Default template paths (from public folder)
export const DEFAULT_TEMPLATE_PATHS = {
  coverPdf: '/templates/TreatmentPlanBlank.pdf',
  treatmentPdf: '/templates/TreatmentPlanBlank.pdf', // Page 2 of same PDF
  teamPdfs: {
    essendon: '/templates/essendon-team.pdf',
    burwood: '/templates/burwood-team.pdf',
    mulgrave: '/templates/mulgrave-team.pdf',
  },
  // Preview images (for canvas)
  coverImage: '/templates/TreatmentPlanBlank-1.png',
  treatmentImage: '/templates/TreatmentPlanBlank-2.png',
  continuationImage: '/templates/TreatmentPlanBlank-3.png',
  teamImages: {
    essendon: '/templates/essendon-team.png',
    burwood: '/templates/burwood-team.png',
    mulgrave: '/templates/mulgrave-team.png',
  },
};

// PDF Page dimensions
// Original template: 1215 × 2160 px = 11.25 × 20.00 in = 810 × 1440 points
export const PDF_PAGE_WIDTH = 810;   // 11.25 inches * 72 points/inch
export const PDF_PAGE_HEIGHT = 1440; // 20.00 inches * 72 points/inch

// Default template settings
// Note: PDF coordinates have origin at bottom-left, Y increases upward
export const DEFAULT_TEMPLATE_SETTINGS: TemplateSettings = {
  coverPdf: DEFAULT_TEMPLATE_PATHS.coverPdf,
  treatmentPdf: DEFAULT_TEMPLATE_PATHS.treatmentPdf,
  teamPdfs: DEFAULT_TEMPLATE_PATHS.teamPdfs,
  // Patient name box - centered horizontally, positioned in the white box area
  patientNamePosition: { x: 405, y: 405 },
  patientNameFontSize: 58,
  // Doctor name - positioned near bottom left, next to doctor photo
  doctorNamePosition: { x: 181, y: 170 },
  doctorNameFontSize: 34,
  // Doctor photo - circular photo position (bottom-left corner area)
  doctorPhotoPosition: { x: 51, y: 139, size: 109 },
  // Table settings
  tableStartY: 820,      // Start table below the header image
  tableMarginX: 60,      // Left margin
  rowHeight: 120,        // Height per treatment row (larger for multi-line text)
  maxRowsPerPage: 5,     // Max rows before overflow
};

// Treatment Plan data for generation
export interface TreatmentPlanData {
  patientName: string;
  doctorName: string;
  doctorPhoto?: string; // Base64 image of doctor
  date: string;
  location: Location;
  items: TreatmentItem[];
  totalAmount: number;
}
