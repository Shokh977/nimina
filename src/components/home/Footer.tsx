import Link from 'next/link';

import type { FooterContent } from '@/lib/siteContent';

export default function Footer({ content }: { content: FooterContent }) {
  return (
    <footer className="border-t border-white/[.06] bg-[#08090c]">
      <nav aria-label="Footer" className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-4 px-6 py-9 text-[13.5px] text-[#767e8d]">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG logo mark, no benefit from next/image's raster optimizer */}
          <img src="/brand/logo-mark-light.svg" alt="" className="h-5 w-5 shrink-0" />
          <span>{content.copyrightText}</span>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          {content.links.map((l, i) => (
            <Link key={`${l.label}-${i}`} href={l.href} className="transition-colors hover:text-[#f4f5f8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]">
              {l.label}
            </Link>
          ))}
        </div>
      </nav>
    </footer>
  );
}
