'use client';

import { useMemo, useState } from 'react';

import type { TemplateLibraryContent } from '@/lib/siteContent';
import type { MarketingTemplateCard } from '@/lib/supabase/templates';

function formatDuration(seconds: number): string {
  return `${Math.round(seconds)}s`;
}

function TemplateCard({ t }: { t: MarketingTemplateCard }) {
  return (
    <div className="group rounded-[18px] border border-white/[.08] bg-[#11131a] transition-[transform,border-color] duration-200 hover:-translate-y-1 hover:border-[#8b7dff]/45">
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-t-[18px]" style={{ background: `linear-gradient(140deg, ${t.swatch[0]}, ${t.swatch[1]})` }}>
        <span className="absolute top-2.5 left-2.5 rounded-md bg-[#08090c]/55 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm">{formatDuration(t.durationSeconds)}</span>
        <div className="grid h-[118px] w-[62px] grid-rows-[auto_auto_1fr_auto] gap-1.5 rounded-[12px] border-2 border-white/70 bg-black/25 p-1.5">
          <div className="h-1 w-[70%] rounded-full bg-white/60" />
          <div className="h-1 w-[90%] rounded-full bg-white/35" />
          <div className="rounded-sm bg-white/15" />
          <div className="h-2 rounded-sm bg-white/70" />
        </div>
        <span className="absolute right-2.5 bottom-2.5 grid h-[30px] w-[30px] place-items-center rounded-full bg-[#08090c]/55 backdrop-blur-sm">
          <span className="ml-0.5 h-0 w-0 border-y-[5px] border-l-[7px] border-y-transparent border-l-white" />
        </span>
      </div>
      <div className="flex flex-col gap-1.5 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-[family-name:var(--font-space-grotesk)] text-[16.5px] font-semibold text-[#f4f5f8]">{t.name}</span>
          <span className="rounded-full bg-[#8b7dff]/[.12] px-2 py-[3px] text-[11.5px] whitespace-nowrap text-[#8b7dff]">{t.category}</span>
        </div>
        <p className="text-[13.5px] text-[#767e8d]">{t.description}</p>
      </div>
    </div>
  );
}

export default function TemplateLibrary({ content, templates }: { content: TemplateLibraryContent; templates: MarketingTemplateCard[] }) {
  const categories = useMemo(() => ['All', ...Array.from(new Set(templates.map((t) => t.category).filter(Boolean)))], [templates]);
  const [active, setActive] = useState('All');
  const visible = active === 'All' ? templates : templates.filter((t) => t.category === active);

  return (
    <section id="templates" aria-labelledby="templates-heading" className="border-t border-white/[.06] py-24" style={{ background: 'linear-gradient(180deg,#0a0b10,#08090c)' }}>
      <div className="mx-auto max-w-[1180px] px-6">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div className="max-w-[560px]">
            <p className="text-[12px] font-semibold tracking-[.14em] text-[#8b7dff] uppercase">{content.eyebrow}</p>
            <h2 id="templates-heading" className="mt-3 font-[family-name:var(--font-space-grotesk)] text-[clamp(30px,3.6vw,44px)] leading-[1.08] font-bold tracking-[-.025em] text-[#f4f5f8]">
              {content.heading}
            </h2>
            <p className="mt-3 text-[16px] leading-[1.6] text-[#9aa1af]">{content.subhead}</p>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter templates by category">
            {categories.map((c) => {
              const isActive = active === c;
              return (
                <button
                  key={c}
                  onClick={() => setActive(c)}
                  aria-pressed={isActive}
                  className={`rounded-full border px-4 py-2 text-[13.5px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff] ${
                    isActive ? 'border-[#8b7dff]/60 bg-[#5b4bff]/[.18] text-[#cfc8ff]' : 'border-white/[.12] bg-white/[.03] text-[#9aa1af] hover:bg-white/[.08]'
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-10 grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-5">
          {visible.map((t) => (
            <TemplateCard key={t.id} t={t} />
          ))}
        </div>

        <div className="mt-10 text-center">
          <a href={content.footerLinkHref} className="text-[14.5px] font-semibold text-[#8b7dff] hover:text-[#a89bff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]">
            See all {templates.length} templates →
          </a>
        </div>
      </div>
    </section>
  );
}
