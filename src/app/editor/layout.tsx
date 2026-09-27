import type { Metadata } from 'next';

import { instrumentSans, spaceGrotesk } from '@/lib/fonts';

export const metadata: Metadata = {
  title: 'Editor — Nimina',
};

/**
 * Loads the exact Google Fonts the engine references by family name (see
 * src/engine/constants.ts FONTS) — plain <link> tags rather than next/font,
 * whose generated class names wouldn't match what ctx.font expects. This is
 * separate from spaceGrotesk/instrumentSans below (the UI chrome's own
 * type system, same dark theme as src/app/page.tsx and
 * src/components/projects/) — the two coexist: one feeds ctx.font strings,
 * the other feeds CSS custom properties.
 */
export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router page, not pages/_document; the engine needs these exact family names, not next/font's generated ones */}
      <link
        href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;800&family=DM+Serif+Display&family=Figtree:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,400;700&family=Space+Grotesk:wght@400;700&family=Syne:wght@400;800&display=swap"
        rel="stylesheet"
      />
      <div className={`${spaceGrotesk.variable} ${instrumentSans.variable} min-h-full bg-[#08090c] text-[#f4f5f8]`} style={{ fontFamily: 'var(--font-instrument-sans), "Instrument Sans", system-ui, sans-serif' }}>
        {children}
      </div>
    </>
  );
}
