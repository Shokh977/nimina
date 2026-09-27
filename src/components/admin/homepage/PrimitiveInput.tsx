'use client';

import type { PrimitiveField } from '@/lib/siteContentSchema';

/** Renders the right control for one PrimitiveField, sized for use both as
 * a section's own top-level field and inside a RepeatableListField item —
 * callers own the label. */
export default function PrimitiveInput({ field, value, onChange }: { field: PrimitiveField; value: unknown; onChange: (value: unknown) => void }) {
  if (field.kind === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-black/20 dark:border-white/20" />
        {field.label}
      </label>
    );
  }
  if (field.kind === 'number') {
    return <input type="number" value={typeof value === 'number' ? value : 0} onChange={(e) => onChange(Number(e.target.value))} className="w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-[13.5px] dark:border-white/10 dark:bg-neutral-900" />;
  }
  if (field.kind === 'textarea') {
    return (
      <textarea
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-[13.5px] dark:border-white/10 dark:bg-neutral-900"
      />
    );
  }
  return (
    <input
      type="text"
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-[13.5px] dark:border-white/10 dark:bg-neutral-900"
    />
  );
}
