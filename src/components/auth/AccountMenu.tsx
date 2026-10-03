'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import StorageMeter from '@/components/storage/StorageMeter';
import { isPro, type Plan } from '@/lib/plan';
import { createClient } from '@/lib/supabase/client';

/**
 * The signed-in user's avatar button and its menu — email and plan, storage
 * used, account settings, billing (Pro) or upgrade (Free), sign out. One
 * compact control instead of a row of header buttons; used by the editor
 * and the projects dashboard.
 */
export default function AccountMenu({ email, plan, showProjectsLink = false }: { email: string; plan: Plan; showProjectsLink?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pro = isPro(plan);

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
    await createClient().auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const item = 'block w-full rounded-[9px] px-2.5 py-2 text-left text-[13.5px] text-[#e6e8ee] hover:bg-white/[.06] focus-visible:bg-white/[.06] focus-visible:outline-none';
  const initial = (email.trim()[0] ?? '?').toUpperCase();

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${email}`}
        title={email}
        className="grid h-9 w-9 place-items-center rounded-full font-[family-name:var(--font-space-grotesk)] text-[13.5px] font-bold text-white ring-1 ring-white/[.14] transition-shadow hover:ring-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]"
        style={{ background: 'linear-gradient(140deg,#5b4bff,#8b7dff)' }}
      >
        {initial}
      </button>

      {open && (
        <div role="menu" className="absolute top-[calc(100%+8px)] right-0 z-50 w-[260px] rounded-[14px] border border-white/[.08] bg-[#11131a] p-2 shadow-[0_26px_60px_rgba(0,0,0,.6)]">
          <div className="px-2.5 pt-1.5 pb-2.5">
            <div className="truncate text-[13.5px] font-semibold text-[#f4f5f8]" title={email}>
              {email}
            </div>
            <span className="mt-1 inline-block rounded-full bg-[#8b7dff]/[.14] px-2 py-0.5 text-[11px] font-semibold tracking-[.04em] text-[#cfc8ff] uppercase">{pro ? 'Pro' : 'Free'}</span>
          </div>
          <div className="mx-2.5 mb-2 rounded-[10px] border border-white/[.07] bg-white/[.03] p-2.5">
            <StorageMeter compact />
          </div>
          {showProjectsLink && (
            <Link role="menuitem" href="/projects" className={item} onClick={() => setOpen(false)}>
              My projects
            </Link>
          )}
          <Link role="menuitem" href="/account" className={item} onClick={() => setOpen(false)}>
            Account settings
          </Link>
          {pro ? (
            <a role="menuitem" href="/api/paddle/portal" className={item} onClick={() => setOpen(false)}>
              Billing &amp; invoices
            </a>
          ) : (
            <Link role="menuitem" href="/pricing" className={`${item} font-semibold text-[#cfc8ff]`} onClick={() => setOpen(false)}>
              Upgrade to Pro
            </Link>
          )}
          <div className="my-1.5 h-px bg-white/[.08]" />
          <button type="button" role="menuitem" onClick={signOut} className={`${item} text-[#ff8f76] hover:bg-[#ff7a59]/[.1]`}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
