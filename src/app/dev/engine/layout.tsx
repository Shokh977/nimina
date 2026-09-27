import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Engine dev — Nimina',
};

/**
 * Loads the same Google Fonts the prototype (legacy/promo-studio.html) uses,
 * by exact family name, so canvas text rendered here matches. The engine's
 * ctx.font calls reference these family names directly (see
 * src/engine/constants.ts FONTS), which is why this uses plain <link> tags
 * instead of next/font (next/font renames the family to a generated class).
 */
export default function EngineDevLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router page, not pages/_document; scoped to this dev-only route on purpose */}
      <link
        href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;800&family=DM+Serif+Display&family=Figtree:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,400;700&family=Space+Grotesk:wght@400;700&family=Syne:wght@400;800&display=swap"
        rel="stylesheet"
      />
      {children}
    </>
  );
}
