'use client';

import type { ReactNode } from 'react';

/** Collapsible section, styled like the prototype's `details.more`. */
export default function Details({ summary, defaultOpen = false, children }: { summary: ReactNode; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <details className="group mt-2.5 border-t border-white/[.07] pt-1.5" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center gap-2 py-1.5 text-[12.5px] font-semibold text-[#c9cdd8] marker:content-none">
        <span className="inline-block h-[7px] w-[7px] flex-none rotate-[-45deg] border-r-2 border-b-2 border-[#767e8d] transition-transform duration-[.16s] group-open:rotate-45" />
        {summary}
      </summary>
      <div className="pt-1">{children}</div>
    </details>
  );
}
