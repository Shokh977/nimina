import { Suspense } from 'react';
import { Bricolage_Grotesque, Figtree } from 'next/font/google';

import Footer from '@/components/marketing/Footer';
import Nav from '@/components/marketing/Nav';
import NavAuthSlot from '@/components/marketing/NavAuthSlot';

const bricolage = Bricolage_Grotesque({ subsets: ['latin'], weight: ['400', '700', '800'], variable: '--font-bricolage' });
const figtree = Figtree({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-figtree' });

/**
 * Public marketing pages (/, /pricing, /privacy, /terms, /refunds) — no
 * canvas rendering happens here, so unlike the editor/login/dev routes this
 * uses next/font (self-hosted, no layout shift) instead of a <link> tag.
 *
 * The signed-in-aware nav is isolated behind a Suspense boundary
 * (NavAuthSlot) so the auth cookie check doesn't force every page under
 * this layout into dynamic rendering — pages that don't otherwise need it
 * (privacy, terms, refunds) stay statically generated.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${bricolage.variable} ${figtree.variable} flex min-h-full flex-col bg-[#ECEEF2] text-[#15171C] dark:bg-[#111318] dark:text-[#ECEEF3]`}
      style={{ fontFamily: 'var(--font-figtree), Figtree, system-ui, sans-serif' }}
    >
      <Suspense fallback={<Nav signedIn={false} />}>
        <NavAuthSlot />
      </Suspense>
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
