import type { ReactNode } from 'react';

import { LEGAL } from '@/lib/legal';

/** Layout for /terms, /privacy and /refunds: title, date, an optional
 * plain-language summary, then the numbered sections. */
export default function LegalPage({ title, summary, children }: { title: string; summary?: ReactNode; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-[760px] px-4 py-14 sm:px-6">
      <h1 className="font-[family-name:var(--font-bricolage)] text-[32px] font-extrabold tracking-tight">{title}</h1>
      <p className="mt-1 text-[13px] text-neutral-500 dark:text-neutral-400">Last updated: {LEGAL.updated}</p>
      {summary && (
        <div className="mt-6 rounded-2xl border border-black/10 bg-white/60 px-5 py-4 text-[14px] leading-relaxed text-neutral-700 dark:border-white/10 dark:bg-white/[.03] dark:text-neutral-300">
          <p className="mb-1.5 font-bold text-neutral-900 dark:text-neutral-100">In short</p>
          {summary}
        </div>
      )}
      <div className="mt-8 space-y-7 text-[14.5px] leading-relaxed text-neutral-700 dark:text-neutral-300">{children}</div>
    </article>
  );
}

export function LegalSection({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-[17.5px] font-bold text-neutral-900 dark:text-neutral-100">{title}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

/** A mailto link to the support address. */
export function Mail({ subject }: { subject?: string }) {
  return (
    <a href={`mailto:${LEGAL.email}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`} className="font-semibold text-indigo-600 underline dark:text-indigo-400">
      {LEGAL.email}
    </a>
  );
}
