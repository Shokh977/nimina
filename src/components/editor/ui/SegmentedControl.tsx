'use client';

/** Bounded, exclusive control for 2-4 short options — a 4px-padded
 * container with a 1px control border and 8px-radius segments inside.
 * Distinct from SegButtons' wrapping pill row (5+ options); the two are
 * spec'd as visually different and never mixed. Non-wrapping — if a caller
 * needs more room than fits, it should scroll horizontally rather than
 * shrink the type (see Length's 8-value row). */
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  scroll = false,
}: {
  options: Array<[T, React.ReactNode]>;
  value: T;
  onChange: (v: T) => void;
  scroll?: boolean;
}) {
  return (
    <div role="tablist" className={`flex gap-1 rounded-[10px] border border-white/[.12] p-1 ${scroll ? 'overflow-x-auto' : ''}`}>
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={v === value}
          onClick={() => onChange(v)}
          className="shrink-0 rounded-[8px] px-3 py-[7px] text-[12.5px] font-semibold whitespace-nowrap text-[#9aa1af] transition-colors duration-[.16s] ease-out hover:bg-white/[.06] aria-selected:bg-[#5b4bff]/[.24] aria-selected:text-[#cfc8ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
