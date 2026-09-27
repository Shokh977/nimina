'use client';

/** Repeatable boolean-row unit: title + sub-label on the left, a pill
 * switch on the right. Track rgba(255,255,255,.14) off / #5b4bff on; 20px
 * white knob sliding left:3px -> 21px. */
export default function ToggleRow({ title, sub, checked, onChange }: { title: React.ReactNode; sub?: React.ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[.08] bg-white/[.03] px-3.5 py-[13px]">
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold text-[#f4f5f8]">{title}</span>
        {sub && <span className="mt-0.5 block truncate text-[12px] text-[#767e8d]">{sub}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors duration-[.18s] ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff] ${checked ? 'bg-[#5b4bff]' : 'bg-white/[.14]'}`}
      >
        <span className={`absolute top-[3px] h-5 w-5 rounded-full bg-white transition-[left] duration-[.18s] ease-out ${checked ? 'left-[21px]' : 'left-[3px]'}`} />
      </button>
    </div>
  );
}
