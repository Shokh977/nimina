import type { Metadata, Viewport } from 'next';

import EngineFonts from '@/components/EngineFonts';
import { instrumentSans, spaceGrotesk } from '@/lib/fonts';

export const metadata: Metadata = {
  title: 'Editor',
};

// viewport-fit=cover lets the phone editor run edge to edge and pad itself
// with env(safe-area-inset-*) (notch, home indicator).
export const viewport: Viewport = {
  themeColor: '#121317',
  viewportFit: 'cover',
};

/**
 * EngineFonts loads the exact fonts the engine references by family name
 * (see src/components/EngineFonts.tsx). This is separate from spaceGrotesk/instrumentSans below (the UI chrome's own
 * type system, same dark theme as src/app/page.tsx and
 * src/components/projects/) — the two coexist: one feeds ctx.font strings,
 * the other feeds CSS custom properties.
 */
export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <EngineFonts />
      <div className={`${spaceGrotesk.variable} ${instrumentSans.variable} min-h-full bg-[#08090c] text-[#f4f5f8]`} style={{ fontFamily: 'var(--font-instrument-sans), "Instrument Sans", system-ui, sans-serif' }}>
        {children}
      </div>
    </>
  );
}
