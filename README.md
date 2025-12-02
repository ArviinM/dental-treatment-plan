# 🦷 Dental Treatment Plan Generator

A modern web application for generating professional dental treatment plan PDFs. Built for SiaDental clinics to streamline the creation of personalized treatment plans for patients.

![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat&logo=tailwindcss&logoColor=white)

## ✨ Features

- **Patient Information Form** - Capture patient name, doctor, date, and clinic location
- **Dynamic Treatment Table** - Add/remove treatment items with auto-fill from fee schedule
- **Auto-Calculate Fees** - Real-time total calculation as you add items
- **Item Code Autocomplete** - Type an item code and description/fee auto-fills
- **Live PDF Preview** - See exactly what the PDF will look like before downloading
- **PDF Download** - Generate professional PDFs with one click
- **No Backend Required** - 100% client-side, data stays in your browser

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/dental-treatment-plan.git

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
- **PDF Generation:** [@react-pdf/renderer](https://react-pdf.org/)
- **Hosting:** [Vercel](https://vercel.com/)

## 📁 Project Structure

```
src/
├── components/
│   ├── ui/                     # shadcn/ui components
│   ├── pdf/                    # PDF template components
│   │   └── TreatmentPlanPDF.tsx
│   └── forms/                  # Form components
│       ├── PatientInfoForm.tsx
│       └── TreatmentItemsTable.tsx
├── hooks/
│   ├── useFeeCalculator.ts     # Total calculation logic
│   └── useLocalStorage.ts      # Persist data to localStorage
├── data/
│   └── default-fee-schedule.ts # Default item codes & fees
├── types/
│   └── index.ts                # TypeScript interfaces
├── lib/
│   └── utils.ts                # Utility functions
├── App.tsx
└── main.tsx
```

## 📋 Usage

1. **Enter Patient Details** - Fill in patient name, select doctor, date, and location
2. **Add Treatment Items** - Type an item code (e.g., "613") to auto-fill description and fee
3. **Adjust as Needed** - Edit descriptions, fees, or tooth numbers
4. **Preview** - Click "Show Preview" to see the PDF
5. **Download** - Click "Download PDF" to save the treatment plan

## 🎨 Customization

### Fee Schedule

The default fee schedule is located in `src/data/default-fee-schedule.ts`. You can modify item codes, descriptions, and fees to match your clinic's pricing.

### Locations

Clinic locations are defined in `src/types/index.ts` under the `LOCATIONS` constant.

## 📝 Roadmap

- [ ] Custom template background upload
- [ ] CSV import/export for fee schedules
- [ ] Custom font support
- [ ] Multiple page layouts
- [ ] Team member management

## 📄 License

MIT License - feel free to use this for your dental clinic!

---

Built with ❤️ for SiaDental
