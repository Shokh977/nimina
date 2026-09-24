'use client';

import type { ReactNode } from 'react';

/** Collapsible section, styled like the prototype's `details.more`. */
export default function Details({ summary, defaultOpen = false, children }: { summary: ReactNode; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <details className="group mt-2.5 border-t border-black/10 pt-1.5 dark:border-white/10" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center gap-2 py-1.5 text-[13.5px] font-bold marker:content-none">
        <span className="inline-block h-[7px] w-[7px] flex-none rotate-[-45deg] border-r-2 border-b-2 border-neutral-500 transition-transform group-open:rotate-45" />
        {summary}
      </summary>
      <div className="pt-1">{children}</div>
    </details>
  );
}
