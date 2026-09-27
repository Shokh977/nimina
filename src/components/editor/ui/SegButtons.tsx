'use client';

/** Wrapping row of pill buttons for picking one of 5+ short string values
 * (bg pattern, text animation, transition, highlight style, ...). For 2-4
 * exclusive options in a bounded box, use SegmentedControl instead — the
 * two are spec'd as visually distinct and never mixed. */
export default function SegButtons<T extends string>({ options, value, onChange }: { options: Array<[T, string]>; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          aria-pressed={v === value}
          onClick={() => onChange(v)}
          className="rounded-full border border-white/[.12] bg-transparent px-3.5 py-1.5 text-[12.5px] font-semibold text-[#9aa1af] transition-colors duration-[.16s] ease-out hover:bg-white/[.08] aria-pressed:border-transparent aria-pressed:bg-[#5b4bff]/[.18] aria-pressed:text-[#cfc8ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
