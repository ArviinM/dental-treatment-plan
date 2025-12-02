# 🦷 Dental Treatment Plan Generator

A modern web application for generating professional dental treatment plan PDFs. Built for SIA Dental clinics to streamline the creation of personalized treatment plans for patients.

![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat&logo=tailwindcss&logoColor=white)

## ✨ Features

- **Patient Information Form** - Capture patient name, doctor, date, and clinic location
- **Doctor Photo Upload** - Add a circular doctor profile photo to the cover page
- **Dynamic Treatment Table** - Add/remove treatment items with auto-fill from fee schedule
- **Multi-line Descriptions** - Support for detailed treatment descriptions
- **Auto-Calculate Fees** - Real-time total calculation as you add items
- **Item Code Autocomplete** - Type an item code and description/fee auto-fills
- **Live Canvas Preview** - See exactly what the PDF will look like before downloading
- **PDF Template Overlay** - Overlay dynamic content on existing PDF templates
- **Team Page Selection** - Automatically append team pages based on location
- **Configurable Positioning** - Adjust text positions, font sizes, and table settings
- **PDF Download** - Generate professional PDFs with one click
- **No Backend Required** - 100% client-side, data stays in your browser

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/ArviinM/dental-treatment-plan.git

# Navigate to project directory
cd dental-treatment-plan

# Install dependencies
yarn

# Start development server
yarn dev
```

The app will be available at `http://localhost:5173`

### Build for Production

```bash
yarn build
```

## 🛠️ Tech Stack

- **Framework:** [Vite](https://vitejs.dev/) + [React 18](https://react.dev/)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
- **UI Components:** [shadcn/ui](https://ui.shadcn.com/)
- **PDF Generation:** [pdf-lib](https://pdf-lib.js.org/) with custom font embedding
- **Live Preview:** HTML Canvas rendering
- **Font:** [Nunito](https://fonts.google.com/specimen/Nunito) (Google Fonts)
- **Hosting:** [Vercel](https://vercel.com/)

## 📁 Project Structure

```
src/
├── components/
│   ├── ui/                        # shadcn/ui components
│   ├── preview/                   # PDF preview components
│   │   └── CanvasPreview.tsx      # Live canvas-based preview
│   ├── settings/                  # Settings components
│   │   └── TemplateUploader.tsx   # Template configuration
│   └── forms/                     # Form components
│       ├── PatientInfoForm.tsx    # Patient & doctor info
│       └── TreatmentItemsTable.tsx # Treatment items editor
├── services/
│   └── pdfGenerator.ts            # PDF generation with pdf-lib
├── hooks/
│   ├── useFeeCalculator.ts        # Total calculation logic
│   └── useLocalStorage.ts         # Persist data to localStorage
├── data/
│   └── default-fee-schedule.ts    # Default item codes & fees
├── types/
│   └── index.ts                   # TypeScript interfaces
├── lib/
│   └── utils.ts                   # Utility functions
├── App.tsx
└── main.tsx

public/
├── brand/                         # Logo and branding assets
├── fonts/                         # Nunito font files (TTF)
└── templates/                     # PDF and PNG templates
    ├── TreatmentPlanBlank.pdf     # Cover & treatment page template
    ├── TreatmentPlanBlank-*.png   # Preview images
    ├── essendon-team.pdf          # Essendon team page
    └── burwood-mulgrave-team.pdf  # Burwood/Mulgrave team page
```

## 📋 Usage

1. **Enter Patient Details** - Fill in patient name, select doctor, date, and location
2. **Upload Doctor Photo** - Optionally add a doctor profile photo
3. **Add Treatment Items** - Type an item code (e.g., "011") to auto-fill description and fee
4. **Edit Descriptions** - Use multi-line text for detailed treatment descriptions
5. **Preview** - View the live preview panel to see exactly how the PDF will look
6. **Download** - Click "Download PDF" to save the treatment plan

## ⚙️ Settings

Access the **Settings** tab to customize:

### Text Positioning
- **Patient Name** - X, Y position and font size
- **Doctor Name** - X, Y position and font size
- **Doctor Photo** - X, Y position and size (diameter)

### Table Settings
- **Table Start Y** - Vertical position of the table
- **Table Margin X** - Left/right margins
- **Row Height** - Height per treatment row
- **Max Rows Per Page** - Rows before pagination

## 🎨 Customization

### Fee Schedule

The default fee schedule is located in `src/data/default-fee-schedule.ts`. You can modify item codes, descriptions, and fees to match your clinic's pricing.

### Locations

Clinic locations are defined in `src/types/index.ts` under the `LOCATIONS` constant:
- Essendon
- Burwood
- Mulgrave

### Templates

PDF templates are stored in `public/templates/`. To update:
1. Replace the PDF files with your custom designs
2. Generate PNG previews for the canvas preview
3. Ensure page dimensions match (11.25 × 20.00 inches / 810 × 1440 points)

### Branding

Brand assets are in `public/brand/`:
- `logo-favicon.png` - Browser tab icon
- `logo-rectangle.png` - Header logo

## 🎨 Brand Colors

- **SIA Teal:** `#2BBFB3`
- **SIA Purple:** `#A5338D`
- **Dark Gray:** `#1F2937`

## 📝 Table Layout

The treatment table follows this structure:

| Item | Tooth | Description | Qty | Fee |
|------|-------|-------------|-----|-----|
| 011  | 23    | Multi-line description... | 1 | $80.00 |

## 📄 License

MIT License - feel free to use this for your dental clinic!

---

Built with ❤️ for SIA Dental
