import type { StatsContent } from '@/lib/siteContent';

export default function StatsBand({ content }: { content: StatsContent }) {
  return (
    <section aria-label="Nimina by the numbers" className="border-y border-white/[.06] bg-[#0a0b10] py-[70px]">
      <div className="mx-auto grid max-w-[1180px] grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-8 px-6 text-center">
        {content.items.map((s, i) => (
          <div key={`${s.label}-${i}`}>
            <p className="font-[family-name:var(--font-space-grotesk)] text-[38px] font-bold" style={{ backgroundImage: 'linear-gradient(100deg,#8b7dff,#ff9b7a)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
              {s.value}
            </p>
            <p className="mt-1 text-[14px] text-[#8b93a1]">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
