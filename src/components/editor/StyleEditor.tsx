'use client';

import { useEditorStore } from '@/store/editorStore';
import type { SlideStyle } from '@/engine/types';
import { defaultLabel, overrideCount, STYLE_FIELDS, type StyleFieldKey } from './styleFields';
import Details from './ui/Details';

/** The "Style for this slide" override grid, shared by scene cards and the
 * intro/outro cards. `style`/`onChange` let the same component drive either
 * a slide's `.style` or intro/outro's `.style`. */
export default function StyleEditor({
 title,
 keys,
 style,
 onChange,
 onReset,
 onApplyAll,
 defaultOpen = false,
}: {
 title: string;
 keys: StyleFieldKey[];
 style: SlideStyle;
 onChange: (key: StyleFieldKey, value: string | undefined) => void;
 onReset: () => void;
 onApplyAll?: () => void;
 defaultOpen?: boolean;
}) {
 const project = useEditorStore((s) => s.project);
 const n = overrideCount(style);

 return (
 <Details
 defaultOpen={defaultOpen}
 summary={
 <>
 {title}
 {n > 0 && <span className="rounded-full bg-[#5b4bff]/[.18] px-2 py-0.5 text-[11.5px] font-bold text-[#cfc8ff]">{n} custom</span>}
 </>
 }
 >
 <div className="grid grid-cols-2 gap-2.5">
 {keys.map((key) => {
 const field = STYLE_FIELDS[key];
 const current = (style[key] as string | undefined) ?? '';
 return (
 <label key={key} className="min-w-0 text-[12.5px] font-semibold text-[#767e8d] ">
 {field.label}
 <select
 value={current}
 onChange={(e) => onChange(key, e.target.value || undefined)}
 className="mt-1 block w-full min-w-0 max-w-full rounded-lg border border-white/[.12] bg-white/[.03] px-2.5 py-2 text-[14.5px] text-[#f4f5f8] "
 >
 <option value="">Default ({defaultLabel(project, key)})</option>
 {field.options().map(([v, label]) => (
 <option key={v} value={v}>
 {label}
 </option>
 ))}
 </select>
 </label>
 );
 })}
 </div>
 <div className="mt-2.5 flex flex-wrap gap-2">
 {onApplyAll && (
 <button type="button" onClick={onApplyAll} className="rounded-lg border border-white/[.12] bg-white/[.03] px-3 py-1.5 text-[13px] font-semibold ">
 Apply this style to all slides
 </button>
 )}
 <button type="button" onClick={onReset} className="rounded-lg border border-white/[.12] bg-white/[.03] px-3 py-1.5 text-[13px] font-semibold ">
 Reset to defaults
 </button>
 </div>
 </Details>
 );
}
