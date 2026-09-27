import type { LogosContent } from '@/lib/siteContent';

export default function LogoMarquee({ content }: { content: LogosContent }) {
  return (
    <section aria-label="Teams using Nimina" className="border-t border-white/[.06] pt-24 pb-24">
      <p className="text-center text-[12px] font-semibold tracking-[.14em] text-[#5f6675] uppercase">{content.label}</p>
      <div className="relative mt-8 overflow-hidden" style={{ maskImage: 'linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)', WebkitMaskImage: 'linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)' }}>
        <div className="home-marquee-track flex w-max items-center gap-14">
          {[0, 1].map((rep) => (
            <div key={rep} className="flex shrink-0 items-center gap-14" aria-hidden={rep === 1}>
              {content.items.map((logo, i) => (
                <span key={`${logo.name}-${i}`} className="font-[family-name:var(--font-space-grotesk)] text-[19px] font-semibold whitespace-nowrap text-[#565d6c]">
                  {logo.name}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
