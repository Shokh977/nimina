import type { Metadata } from 'next';
import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Promo Studio — Turn app screenshots into promo videos',
    template: '%s — Promo Studio',
  },
  description: 'Turn your app screenshots into a polished, animated promo video in minutes — device frames, motion, and music, exported straight to MP4.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
