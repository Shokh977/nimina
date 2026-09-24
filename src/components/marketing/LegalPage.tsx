import type { ReactNode } from 'react';

export default function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-[720px] px-4 py-14 sm:px-6">
      <div className="mb-8 rounded-2xl border-2 border-amber-400 bg-amber-50 px-5 py-4 text-[13.5px] text-amber-900 dark:border-amber-500/60 dark:bg-amber-500/10 dark:text-amber-200">
        <p className="font-bold">Placeholder — not legal advice, not reviewed by a lawyer.</p>
        <p className="mt-1">
          This page is draft text generated to fill in the shape of a real policy. It has not been reviewed by a lawyer and must not be published as-is. Replace the bracketed
          placeholders, verify every claim against what the product actually does, and have it reviewed before this page goes live.
        </p>
      </div>
      <h1 className="font-[family-name:var(--font-bricolage)] text-[30px] font-extrabold tracking-tight">{title}</h1>
      <p className="mt-1 text-[13px] text-neutral-500 dark:text-neutral-400">Last updated: [date]</p>
      <div className="mt-8 space-y-6 text-[14.5px] leading-relaxed text-neutral-700 dark:text-neutral-300">{children}</div>
    </article>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-[17px] font-bold text-neutral-900 dark:text-neutral-100">{title}</h2>
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
