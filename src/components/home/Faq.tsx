'use client';

import { useState } from 'react';

import type { FaqContent } from '@/lib/siteContent';

export default function Faq({ content }: { content: FaqContent }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section aria-labelledby="faq-heading" className="border-t border-white/[.06] bg-[#08090c] py-24">
      <div className="mx-auto max-w-[820px] px-6">
        <h2 id="faq-heading" className="text-center font-[family-name:var(--font-space-grotesk)] text-[clamp(28px,3.2vw,38px)] leading-[1.08] font-bold tracking-[-.025em] text-[#f4f5f8]">
          {content.heading}
        </h2>

        <div className="mt-10 flex flex-col gap-2.5">
          {content.items.map((item, i) => {
            const isOpen = openIndex === i;
            const panelId = `faq-panel-${i}`;
            const buttonId = `faq-button-${i}`;
            return (
              <div key={`${item.q}-${i}`} className="rounded-[14px] border border-white/[.08] bg-[#11131a]">
                <h3>
                  <button
                    id={buttonId}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-[22px] py-[19px] text-left text-[16px] font-semibold text-[#f4f5f8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]"
                  >
                    {item.q}
                    <span aria-hidden className="shrink-0 text-[20px] text-[#8b7dff]">
                      {isOpen ? '−' : '+'}
                    </span>
                  </button>
                </h3>
                {isOpen && (
                  <div id={panelId} role="region" aria-labelledby={buttonId} className="px-[22px] pb-[19px] text-[15.5px] leading-[1.65] text-[#9aa1af]">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
