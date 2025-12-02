// Patient Info
export interface PatientInfo {
  name: string;
  date: string;
  notes?: string;
}

// Fee Schedule Item
export interface FeeItem {
  code: string;
  description: string;
  fee: number;
}

// Treatment Line Item
export interface TreatmentItem {
  id: string;
  itemCode: string;
  description: string;
  tooth: string;
  fee: number;
}

// Location
export type Location = 'essendon' | 'burwood';

// Complete Treatment Plan
export interface TreatmentPlan {
  patient: PatientInfo;
  doctorName: string;
  location: Location;
  items: TreatmentItem[];
  totalAmount: number;
  createdAt: string;
}

// Template Settings
export interface TemplateSettings {
  coverBackground?: string;      // Base64 or URL
  tableBackground?: string;      // Base64 or URL
  patientNamePosition: { x: number; y: number };
  doctorNamePosition: { x: number; y: number };
  datePosition: { x: number; y: number };
  tableStartY: number;
  rowHeight: number;
  maxRowsPerPage: number;
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
    address: '1138-1140 Mt Alexander Rd, Essendon, VIC 3040',
  },
  burwood: {
    name: 'Burwood',
    website: 'siadentalburwood.com.au',
    phone: '(03) 8538 6199',
    address: '138-140 Burwood Hwy, Burwood, VIC 3125',
  },
};

