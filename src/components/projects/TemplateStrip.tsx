import Link from 'next/link';

import type { MarketingTemplateCard } from '@/lib/supabase/templates';

export default function TemplateStrip({ templates }: { templates: MarketingTemplateCard[] }) {
  return (
    <div className="mt-14">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-space-grotesk)] text-[24px] font-bold tracking-[-.02em] text-[#f4f5f8]">Pick up a template</h2>
          <p className="mt-1 text-[15px] text-[#9aa1af]">Premade edits sized for the channels you post on.</p>
        </div>
        <Link href="/templates" className="text-[14px] font-semibold text-[#8b7dff] hover:text-[#a89bff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]">
          Browse all {templates.length} →
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        {templates.slice(0, 4).map((t) => (
          <Link
            key={t.id}
            href="/templates"
            className="overflow-hidden rounded-2xl border border-white/[.08] bg-[#11131a] transition-[transform,border-color] duration-200 hover:-translate-y-[3px] hover:border-[#8b7dff]/45"
          >
            <div className="h-[92px]" style={{ background: `linear-gradient(140deg, ${t.swatch[0]}, ${t.swatch[1]})` }} />
            <div className="p-4">
              <p className="font-[family-name:var(--font-space-grotesk)] text-[15.5px] font-semibold text-[#f4f5f8]">{t.name}</p>
              <p className="mt-1 text-[13px] text-[#767e8d]">{Math.round(t.durationSeconds)}s · {t.category}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
