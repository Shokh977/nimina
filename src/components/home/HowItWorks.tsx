import type { HowItWorksContent } from '@/lib/siteContent';

export default function HowItWorks({ content }: { content: HowItWorksContent }) {
  return (
    <section id="how" aria-labelledby="how-heading" className="border-t border-white/[.06] bg-[#08090c] py-24">
      <div className="mx-auto max-w-[1180px] px-6">
        <div className="text-center">
          <p className="text-[12px] font-semibold tracking-[.14em] text-[#8b7dff] uppercase">{content.eyebrow}</p>
          <h2 id="how-heading" className="mt-3 font-[family-name:var(--font-space-grotesk)] text-[clamp(30px,3.6vw,44px)] leading-[1.08] font-bold tracking-[-.025em] text-[#f4f5f8]">
            {content.heading}
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5">
          {content.steps.map((s) => (
            <div key={s.number} className="rounded-[20px] border border-white/[.08] p-7" style={{ background: 'linear-gradient(180deg,#12141b,#0e1015)' }}>
              <span className="font-[family-name:var(--font-space-grotesk)] text-[34px] font-bold text-[#8b7dff]/45">{s.number}</span>
              <h3 className="mt-3 font-[family-name:var(--font-space-grotesk)] text-[20px] font-semibold text-[#f4f5f8]">{s.title}</h3>
              <p className="mt-2 text-[15.5px] leading-[1.6] text-[#9aa1af]">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
