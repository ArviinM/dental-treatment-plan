import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';

import './globals.css';

// Absolute URLs for the Open Graph / Twitter images. Vercel sets VERCEL_URL per
// deployment, so previews advertise themselves rather than production.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Treatment Plan Generator | SIA Dental',
  description:
    'Generate professional dental treatment plans for SIA Dental clinics. Create personalized treatment plans with automatic fee calculation for Essendon, Burwood, and Mulgrave locations.',
  icons: { icon: '/brand/logo-favicon.png' },
  openGraph: {
    type: 'website',
    title: 'Treatment Plan Generator | SIA Dental',
    description: 'Generate professional dental treatment plans for SIA Dental clinics.',
    images: ['/brand/logo-rectangle.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Treatment Plan Generator | SIA Dental',
    description: 'Generate professional dental treatment plans for SIA Dental clinics.',
    images: ['/brand/logo-rectangle.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#2BBFB3',
};

// Nunito is served from public/fonts and declared with @font-face in globals.css.
// Only the weights the app actually paints are preloaded; the PDF renderer reads
// Regular and Bold on the server, so those two never block the browser.
const PRELOADED_FONTS = [
  'Nunito-Regular.ttf',
  'Nunito-Medium.ttf',
  'Nunito-SemiBold.ttf',
  'Nunito-Bold.ttf',
  'Nunito-ExtraBold.ttf',
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {PRELOADED_FONTS.map((file) => (
          <link
            key={file}
            rel="preload"
            href={`/fonts/${file}`}
            as="font"
            type="font/ttf"
            crossOrigin=""
          />
        ))}
      </head>
      <body>
        {children}
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{ style: { fontFamily: 'Nunito, sans-serif' } }}
        />
      </body>
    </html>
  );
}
