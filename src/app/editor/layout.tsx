import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Editor — Promo Studio',
};

/**
 * Loads the exact Google Fonts the engine references by family name (see
 * src/engine/constants.ts FONTS) — plain <link> tags rather than next/font,
 * whose generated class names wouldn't match what ctx.font expects.
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
      <div className="min-h-full bg-[#ECEEF2] text-[#15171C] dark:bg-[#111318] dark:text-[#ECEEF3]">{children}</div>
    </>
  );
}
