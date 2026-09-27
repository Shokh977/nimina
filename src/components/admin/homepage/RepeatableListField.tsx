'use client';

import { emptyItem, type PrimitiveField, type StringListField } from '@/lib/siteContentSchema';
import PrimitiveInput from './PrimitiveInput';
import StringListEditor from './StringListEditor';

/** Generic add/remove/reorder editor for a list of objects, each with its
 * own fields (which may include a nested string list, e.g. a pricing
 * plan's `features`) — drives every repeating section on the homepage
 * (logos, steps, features, stats, testimonials, pricing plans, FAQ,
 * footer links, hero slides) from one component instead of nine. */
export default function RepeatableListField({
  items,
  onChange,
  itemFields,
  itemLabel,
}: {
  items: Record<string, unknown>[];
  onChange: (items: Record<string, unknown>[]) => void;
  itemFields: (PrimitiveField | StringListField)[];
  itemLabel: string;
}) {
  const updateItem = (index: number, key: string, value: unknown) => {
    onChange(items.map((it, i) => (i === index ? { ...it, [key]: value } : it)));
  };
  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  const remove = (index: number) => onChange(items.filter((_, i) => i !== index));
  const add = () => onChange([...items, emptyItem(itemFields)]);

  return (
    <div className="grid gap-2.5">
      {items.map((item, i) => (
        <div key={i} className="rounded-xl border border-black/10 p-3 dark:border-white/10">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[11.5px] font-bold text-neutral-500 dark:text-neutral-400">
              {itemLabel} {i + 1}
            </span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded-md border border-black/10 px-1.5 py-0.5 text-[11px] font-bold disabled:opacity-30 dark:border-white/10">
                ↑
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="rounded-md border border-black/10 px-1.5 py-0.5 text-[11px] font-bold disabled:opacity-30 dark:border-white/10">
                ↓
              </button>
              <button type="button" onClick={() => remove(i)} className="rounded-md border border-black/10 px-1.5 py-0.5 text-[11px] font-bold text-red-600 dark:border-white/10">
                Remove
              </button>
            </div>
          </div>
          <div className="grid gap-2">
            {itemFields.map((f) => (
              <label key={f.key} className="block">
                {f.kind !== 'boolean' && <span className="mb-1 block text-[11.5px] font-bold text-neutral-500 dark:text-neutral-400">{f.label}</span>}
                {f.kind === 'stringList' ? (
                  <StringListEditor items={Array.isArray(item[f.key]) ? (item[f.key] as string[]) : []} onChange={(v) => updateItem(i, f.key, v)} itemLabel={f.itemLabel} />
                ) : (
                  <PrimitiveInput field={f} value={item[f.key]} onChange={(v) => updateItem(i, f.key, v)} />
                )}
              </label>
            ))}
          </div>
        </div>
      ))}
      <button type="button" onClick={add} className="justify-self-start rounded-lg border border-dashed border-black/20 px-3 py-1.5 text-[12.5px] font-semibold text-neutral-500 dark:border-white/20 dark:text-neutral-400">
        + Add {itemLabel.toLowerCase()}
      </button>
    </div>
  );
}
