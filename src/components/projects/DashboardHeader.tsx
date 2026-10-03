'use client';

import Link from 'next/link';

import AccountMenu from '@/components/auth/AccountMenu';
import type { Plan } from '@/lib/plan';

export default function DashboardHeader({ userEmail, plan }: { userEmail: string; plan: Plan }) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[.07] bg-[#08090c]/78 backdrop-blur-[14px]">
      <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-3 px-6 py-3.5">
        <div className="flex items-center gap-3">
          <Link href="/projects" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element -- static SVG logo mark, no benefit from next/image's raster optimizer */}
            <img src="/brand/logo-mark-light.svg" alt="" className="h-[26px] w-[26px] shrink-0" />
            <span className="font-[family-name:var(--font-space-grotesk)] text-[17px] font-bold text-[#f4f5f8]">Nimina</span>
          </Link>
          <span className="rounded-full bg-[#8b7dff]/[.14] px-2.5 py-1 text-[11.5px] font-semibold tracking-[.04em] text-[#cfc8ff] uppercase">{plan}</span>
        </div>

        <div className="flex items-center gap-5">
          <nav aria-label="Primary" className="hidden items-center gap-5 sm:flex">
            <Link href="/templates" className="text-[14px] text-[#9aa1af] transition-colors hover:text-[#f4f5f8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]">
              Templates
            </Link>
          </nav>

          <AccountMenu email={userEmail} plan={plan} />
        </div>
      </div>
    </header>
  );
}
