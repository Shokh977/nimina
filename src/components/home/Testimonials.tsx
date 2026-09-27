import type { TestimonialsContent } from '@/lib/siteContent';

export default function Testimonials({ content }: { content: TestimonialsContent }) {
  return (
    <section aria-labelledby="testimonials-heading" className="border-t border-white/[.06] bg-[#08090c] py-24">
      <div className="mx-auto max-w-[1180px] px-6">
        <h2 id="testimonials-heading" className="text-center font-[family-name:var(--font-space-grotesk)] text-[clamp(30px,3.6vw,44px)] leading-[1.08] font-bold tracking-[-.025em] text-[#f4f5f8]">
          {content.heading}
        </h2>

        <div className="mt-12 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5">
          {content.items.map((t, i) => (
            <figure key={`${t.name}-${i}`} className="rounded-[20px] border border-white/[.08] bg-[#11131a] p-7">
              <blockquote className="text-[16.5px] leading-[1.62] text-[#e6e8ee]">&ldquo;{t.quote}&rdquo;</blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <span className={`grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full font-[family-name:var(--font-space-grotesk)] text-[12.5px] font-semibold ${t.dark ? 'text-[#0a3b2a]' : 'text-white'}`} style={{ background: t.avatar }}>
                  {t.initials}
                </span>
                <span>
                  <span className="block text-[14px] font-semibold text-[#f4f5f8]">{t.name}</span>
                  <span className="block text-[13px] text-[#767e8d]">{t.role}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
