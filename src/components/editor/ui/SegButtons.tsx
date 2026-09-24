'use client';

/** Row of pill buttons for picking one of a small set of string values,
 * styled like the prototype's `.seg-ctl`. */
export default function SegButtons<T extends string>({ options, value, onChange }: { options: Array<[T, string]>; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          aria-pressed={v === value}
          onClick={() => onChange(v)}
          className="rounded-full border border-black/10 bg-white px-3.5 py-1.5 text-[13px] font-semibold text-neutral-900 aria-pressed:border-neutral-900 aria-pressed:bg-neutral-900 aria-pressed:text-white dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-100 dark:aria-pressed:border-white dark:aria-pressed:bg-white dark:aria-pressed:text-neutral-900"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
