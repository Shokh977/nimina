import Link from 'next/link';

import type { PricingContent } from '@/lib/siteContent';

// Which page a plan's button goes to, and which tier is visually
// emphasized, are funnel/structural decisions — not admin-editable content
// (see src/lib/siteContent.ts's PricingPlanContent, which only carries
// name/price/suffix/features/ctaLabel). Both plans link to the real
// /pricing page (live Paddle prices + checkout) — a signed-out visitor is
// bounced to /login?next=/pricing from there and lands back on /pricing
// afterward, so this never needs to special-case being signed in itself.
const HIGHLIGHTED_PLAN_NAME = 'Pro';
const PLAN_HREF = '/pricing';

export default function PricingSection({ content }: { content: PricingContent }) {
  return (
    <section id="pricing" aria-labelledby="pricing-heading" className="border-t border-white/[.06] py-24" style={{ background: 'linear-gradient(180deg,#0a0b10,#08090c)' }}>
      <div className="mx-auto max-w-[1180px] px-6">
        <div className="text-center">
          <h2 id="pricing-heading" className="font-[family-name:var(--font-space-grotesk)] text-[clamp(30px,3.6vw,44px)] leading-[1.08] font-bold tracking-[-.025em] text-[#f4f5f8]">
            {content.heading}
          </h2>
          <p className="mt-3 text-[16px] text-[#9aa1af]">{content.subhead}</p>
        </div>

        <div className="mt-12 grid grid-cols-[repeat(auto-fit,minmax(270px,1fr))] items-start gap-5">
          {content.plans.map((p) => {
            const highlighted = p.name === HIGHLIGHTED_PLAN_NAME;
            return (
              <div
                key={p.name}
                className={`relative rounded-[20px] border p-[30px] ${highlighted ? 'border-[#8b7dff]/55 shadow-[0_26px_60px_rgba(91,75,255,.18)]' : 'border-white/[.08] bg-[#11131a]'}`}
                style={highlighted ? { background: 'radial-gradient(120% 120% at 50% 0%, rgba(91,75,255,.2), #11131a 60%)' } : undefined}
              >
                {highlighted && <span className="absolute -top-3 left-[30px] rounded-full bg-[#5b4bff] px-3 py-1 text-[11px] font-bold tracking-wide text-white uppercase">Most popular</span>}

                <h3 className="font-[family-name:var(--font-space-grotesk)] text-[19px] font-semibold text-[#f4f5f8]">{p.name}</h3>
                <p className="mt-3 font-[family-name:var(--font-space-grotesk)] text-[40px] font-bold text-[#f4f5f8]">
                  {p.price}
                  <span className="text-[16px] font-medium text-[#767e8d]"> {p.suffix}</span>
                </p>

                <ul className="mt-6 flex flex-col gap-[11px]">
                  {p.features.map((f, i) => (
                    <li key={`${f}-${i}`} className="flex items-start gap-2 text-[14.5px] text-[#e6e8ee]">
                      <span aria-hidden className="mt-[3px] text-[#5ee6b5]">
                        ✓
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href={PLAN_HREF}
                  className={`mt-7 block rounded-xl px-7 py-[15px] text-center text-[15px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff] ${
                    highlighted ? 'bg-[#5b4bff] text-white shadow-[0_14px_34px_rgba(91,75,255,.4)] hover:bg-[#6d5eff]' : 'border border-white/[.16] bg-white/[.03] text-[#f4f5f8] hover:bg-white/[.08]'
                  }`}
                >
                  {p.ctaLabel}
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
