'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { createClient } from '@/lib/supabase/client';
import type { Plan } from '@/lib/plan';

export default function DashboardHeader({ userEmail, plan }: { userEmail: string; plan: Plan }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

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
            <Link href="/projects" className="text-[14px] text-[#9aa1af] transition-colors hover:text-[#f4f5f8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]">
              Brand kit
            </Link>
          </nav>

          <a
            href="/api/paddle/portal"
            className="hidden rounded-[10px] border border-white/[.16] bg-white/[.03] px-3.5 py-2 text-[13.5px] font-semibold text-[#f4f5f8] transition-colors hover:bg-white/[.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff] sm:inline-block"
          >
            Manage subscription
          </a>

          <div ref={rootRef} className="relative">
            <button
              onClick={() => setOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={open}
              className="flex items-center gap-2 rounded-full border border-white/[.12] bg-white/[.03] py-1 pr-3.5 pl-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]"
            >
              <span className="grid h-[26px] w-[26px] place-items-center rounded-full font-[family-name:var(--font-space-grotesk)] text-[11.5px] font-bold text-white" style={{ background: 'linear-gradient(140deg,#5b4bff,#8b7dff)' }}>
                U
              </span>
              <span className="max-w-[180px] truncate text-[13.5px] text-[#c9cdd8]">{userEmail}</span>
            </button>

            {open && (
              <div role="menu" className="absolute top-[calc(100%+8px)] right-0 w-[230px] rounded-[14px] border border-white/[.08] bg-[#11131a] p-2 shadow-[0_26px_60px_rgba(0,0,0,.6)]">
                <Link role="menuitem" href="/pricing" className="block rounded-[9px] px-2.5 py-2.5 text-[13.5px] text-[#e6e8ee] hover:bg-white/[.06]" onClick={() => setOpen(false)}>
                  Account settings
                </Link>
                <a role="menuitem" href="/api/paddle/portal" className="block rounded-[9px] px-2.5 py-2.5 text-[13.5px] text-[#e6e8ee] hover:bg-white/[.06]" onClick={() => setOpen(false)}>
                  Billing &amp; invoices
                </a>
                <Link role="menuitem" href="/privacy" className="block rounded-[9px] px-2.5 py-2.5 text-[13.5px] text-[#e6e8ee] hover:bg-white/[.06]" onClick={() => setOpen(false)}>
                  Help centre
                </Link>
                <div className="my-1.5 h-px bg-white/[.08]" />
                <button role="menuitem" onClick={signOut} className="block w-full rounded-[9px] px-2.5 py-2.5 text-left text-[13.5px] text-[#ff8f76] hover:bg-[#ff7a59]/[.1]">
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
