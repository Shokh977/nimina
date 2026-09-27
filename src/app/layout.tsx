import type { Metadata, Viewport } from 'next';
import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Nimina — Turn app screenshots into promo videos',
    template: '%s — Nimina',
  },
  description: 'Turn your app screenshots into a polished, animated promo video in minutes — device frames, motion, and music, exported straight to MP4.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/favicon-180.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'Nimina — Turn app screenshots into promo videos',
    description: 'Turn your app screenshots into a polished, animated promo video in minutes — device frames, motion, and music, exported straight to MP4.',
    images: [{ url: '/brand/og-image.png', width: 1200, height: 630, alt: 'Nimina — App promos that move' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nimina — Turn app screenshots into promo videos',
    description: 'Turn your app screenshots into a polished, animated promo video in minutes — device frames, motion, and music, exported straight to MP4.',
    images: ['/brand/og-image.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#121317',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
