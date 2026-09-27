'use client';

/** A plain list of strings (e.g. a pricing plan's feature bullets) — add,
 * edit in place, remove. No reordering; these lists are short and order
 * rarely matters as much as it does for the sections themselves. */
export default function StringListEditor({ items, onChange, itemLabel }: { items: string[]; onChange: (items: string[]) => void; itemLabel: string }) {
  return (
    <div className="grid gap-1.5">
      {items.map((value, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            value={value}
            onChange={(e) => onChange(items.map((v, vi) => (vi === i ? e.target.value : v)))}
            className="w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-[13px] dark:border-white/10 dark:bg-neutral-900"
          />
          <button type="button" onClick={() => onChange(items.filter((_, vi) => vi !== i))} className="shrink-0 rounded-lg border border-black/10 px-2 py-1.5 text-[11.5px] font-bold text-red-600 dark:border-white/10">
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, ''])} className="justify-self-start rounded-lg border border-dashed border-black/20 px-2.5 py-1 text-[12px] font-semibold text-neutral-500 dark:border-white/20 dark:text-neutral-400">
        + Add {itemLabel.toLowerCase()}
      </button>
    </div>
  );
}
