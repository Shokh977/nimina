import type { Metadata } from 'next';

import EngineFonts from '@/components/EngineFonts';

export const metadata: Metadata = {
  title: 'Engine dev — Nimina',
};

/** Engine fonts by exact family name (see src/components/EngineFonts.tsx). */
export default function EngineDevLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <EngineFonts />
      {children}
    </>
  );
}
