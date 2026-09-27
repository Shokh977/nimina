import Link from 'next/link';

import type { ClosingCtaContent } from '@/lib/siteContent';

export default function ClosingCta({ content }: { content: ClosingCtaContent }) {
  return (
    <section aria-labelledby="cta-heading" className="border-t border-white/[.06] bg-[#08090c] py-24">
      <div className="mx-auto max-w-[1180px] px-6">
        <div
          className="rounded-[26px] border border-[#8b7dff]/[.28] px-8 text-center"
          style={{ background: 'radial-gradient(90% 140% at 50% 0%, rgba(91,75,255,.3), #0d0f15 62%)', paddingTop: 'clamp(44px,6vw,76px)', paddingBottom: 'clamp(44px,6vw,76px)' }}
        >
          <h2 id="cta-heading" className="font-[family-name:var(--font-space-grotesk)] text-[clamp(30px,4vw,48px)] leading-[1.08] font-bold tracking-[-.025em] text-[#f4f5f8]">
            {content.heading}
          </h2>
          <p className="mt-3 text-[16px] text-[#9aa1af]">{content.subhead}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={content.ctaPrimaryHref}
              className="rounded-xl bg-[#5b4bff] px-7 py-[15px] text-[15px] font-semibold text-white shadow-[0_14px_34px_rgba(91,75,255,.4)] transition-colors hover:bg-[#6d5eff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]"
            >
              {content.ctaPrimaryLabel}
            </Link>
            <a
              href={content.ctaSecondaryHref}
              className="rounded-xl border border-white/[.16] bg-white/[.03] px-7 py-[15px] text-[15px] font-semibold text-[#f4f5f8] transition-colors hover:bg-white/[.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]"
            >
              {content.ctaSecondaryLabel}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
