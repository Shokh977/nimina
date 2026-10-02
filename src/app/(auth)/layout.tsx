import Link from 'next/link';

import { instrumentSans, spaceGrotesk } from '@/lib/fonts';

/** Shared shell for /login, /signup, /forgot-password, /reset-password and
 * /verify-email — the landing page's dark theme, type and logo. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${spaceGrotesk.variable} ${instrumentSans.variable} flex min-h-full flex-1 flex-col bg-[#08090c] text-[#f4f5f8]`}
      style={{ fontFamily: 'var(--font-instrument-sans), "Instrument Sans", system-ui, sans-serif', background: 'radial-gradient(70% 55% at 50% 0%, rgba(91,75,255,.16), transparent 70%), #08090c' }}
    >
      <header className="mx-auto flex w-full max-w-[1180px] items-center px-6 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG logo mark, no benefit from next/image's raster optimizer */}
          <img src="/brand/logo-mark-light.svg" alt="" className="h-[26px] w-[26px]" />
          <span className="font-[family-name:var(--font-space-grotesk)] text-[17px] font-bold">Nimina</span>
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:items-center sm:pt-0">{children}</main>
    </div>
  );
}
