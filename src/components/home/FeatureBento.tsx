import type { FeatureBentoContent } from '@/lib/siteContent';

export default function FeatureBento({ content }: { content: FeatureBentoContent }) {
  return (
    <section id="features" aria-labelledby="features-heading" className="border-t border-white/[.06] bg-[#08090c] py-24">
      <div className="mx-auto max-w-[1180px] px-6">
        <div className="text-center">
          <h2 id="features-heading" className="font-[family-name:var(--font-space-grotesk)] text-[clamp(30px,3.6vw,44px)] leading-[1.08] font-bold tracking-[-.025em] text-[#f4f5f8]">
            {content.heading}
          </h2>
          <p className="mt-3 text-[16px] text-[#9aa1af]">{content.subhead}</p>
        </div>

        <div className="mt-12 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5">
          <div
            className="flex flex-col justify-between gap-8 rounded-[20px] border border-white/[.08] p-7 sm:col-span-2 sm:flex-row sm:items-end"
            style={{ background: 'radial-gradient(120% 140% at 0% 0%, rgba(91,75,255,.22), #11131a 58%)' }}
          >
            <div className="max-w-[420px]">
              <h3 className="font-[family-name:var(--font-space-grotesk)] text-[20px] font-semibold text-[#f4f5f8]">{content.heroTitle}</h3>
              <p className="mt-2 text-[15.5px] leading-[1.6] text-[#9aa1af]">{content.heroBody}</p>
            </div>
            <div className="flex shrink-0 items-end gap-3 self-end sm:self-auto">
              <span className="h-[84px] w-[46px] rounded-[10px] border-2 border-[#8b7dff]/40" />
              <span className="h-[106px] w-[58px] rounded-[12px] border-2 border-[#8b7dff]/40 bg-[#8b7dff]/[.2]" />
              <span className="h-[62px] w-[86px] rounded-[10px] border-2 border-[#8b7dff]/40" />
            </div>
          </div>

          {content.features.map((f, i) => (
            <div key={`${f.title}-${i}`} className="rounded-[20px] border border-white/[.08] bg-[#11131a] p-[26px]">
              <h3 className="font-[family-name:var(--font-space-grotesk)] text-[19px] font-semibold text-[#f4f5f8]">{f.title}</h3>
              <p className="mt-2 text-[15px] leading-[1.6] text-[#9aa1af]">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
