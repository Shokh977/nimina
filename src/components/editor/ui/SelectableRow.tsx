'use client';

/** Row-selection control for options that need a description (Motion
 * presets, Typeface). Selected: border rgba(139,125,255,.55), fill
 * rgba(91,75,255,.14); unselected: border rgba(255,255,255,.1), fill
 * rgba(255,255,255,.03). Optional 18px radio circle for a mutually-
 * exclusive list (Motion presets); omit it for a plain list (Typeface). */
export default function SelectableRow({
  selected,
  onClick,
  title,
  description,
  radio = false,
  leading,
  trailing,
}: {
  selected: boolean;
  onClick: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  radio?: boolean;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full items-center gap-2.5 rounded-[11px] border px-3.5 py-3 text-left transition-colors duration-[.16s] ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff] ${
        selected ? 'border-[#8b7dff]/55 bg-[#5b4bff]/[.14]' : 'border-white/10 bg-white/[.03] hover:bg-white/[.06]'
      }`}
    >
      {radio && (
        <span className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2 ${selected ? 'border-[#8b7dff]' : 'border-white/[.22]'}`}>
          {selected && <span className="h-[7px] w-[7px] rounded-full bg-[#8b7dff]" />}
        </span>
      )}
      {leading}
      <span className="min-w-0 flex-1">
        <span className={`block text-[13.5px] font-semibold ${selected ? 'text-[#cfc8ff]' : 'text-[#f4f5f8]'}`}>{title}</span>
        {description && <span className="mt-0.5 block text-[12px] leading-[1.45] text-[#767e8d]">{description}</span>}
      </span>
      {trailing}
    </button>
  );
}
