# Dental Treatment Plan Generator

## Project Overview

A web-based tool for generating professional dental treatment plan PDFs. The application allows dental clinics to:
- Input patient and doctor information
- Add treatment items with auto-calculated fees
- Generate branded PDFs using custom templates
- Download the final treatment plan

## Tech Stack

- **Framework:** Vite + React 18
- **Language:** TypeScript
- **UI Components:** shadcn/ui
- **Styling:** Tailwind CSS
- **PDF Generation:** @react-pdf/renderer
- **Forms:** react-hook-form + zod (validation)
- **Hosting:** Vercel
- **Package Manager:** Yarn

## Architecture

### No Backend Required
This is a purely client-side application. All data processing happens in the browser:
- Templates stored as images
- Fee schedules stored in LocalStorage
- PDF generated client-side

### Folder Structure

```
src/
├── components/
│   ├── ui/                     # shadcn/ui components
│   ├── pdf/                    # PDF template components
│   │   └── TreatmentPlanPDF.tsx
│   ├── forms/                  # Form components
│   │   ├── PatientInfoForm.tsx
│   │   └── TreatmentItemsTable.tsx
│   └── layout/                 # Layout components (future)
├── hooks/
│   ├── useFeeCalculator.ts
│   └── useLocalStorage.ts
├── lib/
│   └── utils.ts                # shadcn utilities
├── data/
│   └── default-fee-schedule.ts
├── types/
│   └── index.ts                # TypeScript interfaces
├── App.tsx
└── main.tsx
```

## Core Features

### 1. Template Management (Settings) - PENDING ASSETS
- Upload Page 1 (Cover) background image
- Upload Page 2 (Treatment Table) header/footer background
- Configure text positions (X, Y coordinates) for:
  - Patient Name
  - Doctor Name
  - Date
- Save template settings to LocalStorage

### 2. Fee Schedule Management
- View item codes with descriptions and fees
- Import from CSV (coming soon)
- Stored in LocalStorage

### 3. Treatment Plan Generator (Main Feature) ✅

#### Input Phase
- Patient Details Form:
  - Patient Name
  - Doctor Name
  - Date
  - Location (Essendon / Burwood)

#### Treatment Items Table
- Dynamic rows (add/remove)
- Columns:
  - Item Code (autocomplete from fee schedule)
  - Description (auto-fills, editable)
  - Tooth Number (manual input)
  - Fee (auto-fills, editable)
- Real-time total calculation

#### Preview Phase
- Live PDF preview in browser
- Shows exactly what will be printed

#### Download
- Download as PDF
- Filename: `TreatmentPlan_[PatientName]_[Date].pdf`

## Data Structures

```typescript
// Patient Info
interface PatientInfo {
  name: string;
  date: string;
  notes?: string;
}

// Fee Schedule Item
interface FeeItem {
  code: string;
  description: string;
  fee: number;
}

// Treatment Line Item
interface TreatmentItem {
  id: string;
  itemCode: string;
  description: string;
  tooth: string;
  fee: number;
}

// Location
type Location = 'essendon' | 'burwood';

// Complete Treatment Plan
interface TreatmentPlan {
  patient: PatientInfo;
  doctorName: string;
  location: Location;
  items: TreatmentItem[];
  totalAmount: number;
  createdAt: string;
}

// Template Settings (for future)
interface TemplateSettings {
  coverBackground?: string;      // Base64 or URL
  tableBackground?: string;      // Base64 or URL
  patientNamePosition: { x: number; y: number };
  doctorNamePosition: { x: number; y: number };
  datePosition: { x: number; y: number };
  tableStartY: number;
  rowHeight: number;
  maxRowsPerPage: number;
}
```

## PDF Generation Strategy

### Page 1 (Cover Page)
- Background: User-uploaded image (from Canva export) OR default styled page
- Overlays:
  - Patient Name at configured position
  - Doctor Name at configured position

### Page 2+ (Treatment Table)
- Background: User-uploaded header/footer image OR default styled page
- Code-generated elements:
  - Table headers (Item, Description, Tooth, Fee)
  - Table rows with borders
  - Row content from treatment items
  - Total amount at bottom
- Automatic pagination if items exceed page limit (8 items per page)

## Assets Needed from Client

- [ ] Page 1 (Cover) - Image without patient/doctor text
- [ ] Page 2 (Table Page) - Header + Footer only, blank middle
- [ ] Font files (.ttf or .otf) if using custom fonts
- [ ] Fee Schedule (Excel/CSV with codes, descriptions, fees)
- [ ] 1-2 Sample completed PDFs for reference

## Development Phases

### Phase 1: Foundation ✅
- [x] Project setup (Vite + React + TS)
- [x] shadcn/ui integration
- [x] Basic layout and navigation

### Phase 2: Core Forms ✅
- [x] Patient info form
- [x] Treatment items table with add/remove
- [x] Fee auto-calculation

### Phase 3: PDF Generation ✅
- [x] Cover page with text overlay
- [x] Treatment table page generation
- [x] Multi-page support for long tables
- [x] PDF preview component
- [x] Download functionality

### Phase 4: Settings (Pending Assets)
- [ ] Template upload and position config
- [ ] Fee schedule CSV import/export
- [ ] Custom font support

### Phase 5: Polish
- [ ] Responsive design improvements
- [ ] Error handling
- [ ] Loading states
- [ ] Deploy to Vercel

## Running the Project

```bash
cd dental-treatment-plan
yarn dev
```

## Notes

- All data is stored locally (no backend)
- PDF generation happens entirely in the browser
- Templates are stored as Base64 in LocalStorage (size limit ~5MB)
- For larger templates, consider using IndexedDB
