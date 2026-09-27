'use client';

import type { SectionSchema } from '@/lib/siteContentSchema';
import PrimitiveInput from './PrimitiveInput';
import RepeatableListField from './RepeatableListField';
import StringListEditor from './StringListEditor';
import TemplateSelect from './TemplateSelect';

/** Renders one section's whole form from its SectionSchema — the generic
 * counterpart to RepeatableListField for a section's top-level fields.
 * `templates` is only used by a `templateSelect` field, if the schema has
 * one — every other section can omit it. */
export default function SectionEditor({
  schema,
  data,
  onChange,
  templates = [],
}: {
  schema: SectionSchema;
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
  templates?: { id: string; name: string }[];
}) {
  const set = (key: string, value: unknown) => onChange({ ...data, [key]: value });

  return (
    <div className="grid gap-4">
      {schema.fields.map((f) => (
        <div key={f.key}>
          {f.kind !== 'boolean' && <label className="mb-1 block text-[12.5px] font-bold text-neutral-500 dark:text-neutral-400">{f.label}</label>}
          {f.kind === 'objectList' ? (
            <RepeatableListField items={Array.isArray(data[f.key]) ? (data[f.key] as Record<string, unknown>[]) : []} onChange={(v) => set(f.key, v)} itemFields={f.itemFields} itemLabel={f.itemLabel} />
          ) : f.kind === 'stringList' ? (
            <StringListEditor items={Array.isArray(data[f.key]) ? (data[f.key] as string[]) : []} onChange={(v) => set(f.key, v)} itemLabel={f.itemLabel} />
          ) : f.kind === 'templateSelect' ? (
            <TemplateSelect templates={templates} value={typeof data[f.key] === 'string' ? (data[f.key] as string) : null} onChange={(v) => set(f.key, v)} />
          ) : (
            <PrimitiveInput field={f} value={data[f.key]} onChange={(v) => set(f.key, v)} />
          )}
        </div>
      ))}
    </div>
  );
}
