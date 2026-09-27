'use client';

import { useEffect, useState } from 'react';

import { slugify } from '@/lib/slug';
import { createClient } from '@/lib/supabase/client';
import { setTemplateStatus, type TemplateData, type TemplateStatus } from '@/lib/supabase/templates';
import { useEditorStore } from '@/store/editorStore';

interface Meta {
 name: string;
 slug: string;
 category: string;
 description: string;
 status: TemplateStatus;
}

/** Metadata editing is a plain in-place update, not versioned — version
 * history (TemplateVersionHistory) is about "restore a prior build," and
 * name/description/slot copy aren't part of what a restore meaningfully
 * rewinds. */
export default function TemplateMetadataPanel({ templateId }: { templateId: string }) {
 const [meta, setMeta] = useState<Meta | null>(null);
 const [slots, setSlots] = useState<TemplateData['slots']>([]);
 const [saving, setSaving] = useState(false);
 const [slugTouched, setSlugTouched] = useState(true);

 useEffect(() => {
 let cancelled = false;
 createClient()
 .from('templates')
 .select('name, slug, category, description, status, data')
 .eq('id', templateId)
 .single()
 .then(({ data }) => {
 if (cancelled || !data) return;
 setMeta({ name: data.name ?? '', slug: data.slug ?? '', category: data.category ?? '', description: data.description ?? '', status: data.status });
 setSlots((data.data as TemplateData)?.slots ?? []);
 });
 return () => {
 cancelled = true;
 };
 }, [templateId]);

 if (!meta) return <p className="text-[13px] text-[#767e8d] ">Loading…</p>;

 const save = async (patch: Partial<Meta>) => {
 const next = { ...meta, ...patch };
 setMeta(next);
 setSaving(true);
 const { error } = await createClient()
 .from('templates')
 .update({ name: next.name, slug: next.slug, category: next.category, description: next.description, updated_at: new Date().toISOString() })
 .eq('id', templateId);
 setSaving(false);
 if (error) console.error('[admin] metadata save failed', error);
 };

 const saveSlots = async (nextSlots: TemplateData['slots']) => {
 setSlots(nextSlots);
 // Sources `project` from the live store, not a fresh DB read — the
 // Slides/Look/Motion tabs autosave the same `data` column on their own
 // 1.5s debounce (useTemplatePersistence), so re-reading the row here
 // would race it and could clobber a newer project edit with a stale
 // one. shortVariant never changes after import/duplicate, so a DB read
 // for just that field is safe.
 const { data: row } = await createClient().from('templates').select('data').eq('id', templateId).single();
 if (!row) return;
 const data: TemplateData = { project: useEditorStore.getState().project, slots: nextSlots, shortVariant: (row.data as TemplateData).shortVariant };
 const { error } = await createClient().from('templates').update({ data, updated_at: new Date().toISOString() }).eq('id', templateId);
 if (error) console.error('[admin] slot save failed', error);
 };

 const togglePublish = async () => {
 const next: TemplateStatus = meta.status === 'published' ? 'draft' : 'published';
 setMeta({ ...meta, status: next });
 try {
 await setTemplateStatus(createClient(), templateId, next);
 } catch (err) {
 console.error('[admin] publish toggle failed', err);
 setMeta({ ...meta, status: meta.status });
 }
 };

 return (
 <div className="grid gap-4">
 <div className="flex items-center justify-between">
 <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${meta.status === 'published' ? 'bg-[#5ee6b5]/[.1] text-[#5ee6b5]' : 'bg-white/[.06] text-[#9aa1af]'}`}>{meta.status}</span>
 <button onClick={togglePublish} className="rounded-lg border border-white/[.12] px-3 py-1.5 text-[12.5px] font-bold ">
 {meta.status === 'published' ? 'Unpublish' : 'Publish'}
 </button>
 </div>

 <Field label="Name">
 <input
 value={meta.name}
 onChange={(e) => {
 const name = e.target.value;
 setMeta({ ...meta, name, slug: slugTouched ? meta.slug : slugify(name) });
 }}
 onBlur={() => save(meta)}
 className="w-full rounded-lg border border-white/[.12] px-2.5 py-1.5 text-[13.5px] "
 />
 </Field>

 <Field label="Slug">
 <div className="flex gap-2">
 <input
 value={meta.slug}
 onChange={(e) => {
 setSlugTouched(true);
 setMeta({ ...meta, slug: e.target.value });
 }}
 onBlur={() => save(meta)}
 className="w-full rounded-lg border border-white/[.12] px-2.5 py-1.5 text-[13.5px] "
 />
 <button
 onClick={() => {
 setSlugTouched(false);
 save({ slug: slugify(meta.name) });
 }}
 className="shrink-0 rounded-lg border border-white/[.12] px-2.5 text-[12px] font-bold "
 >
 From name
 </button>
 </div>
 </Field>

 <Field label="Category">
 <input value={meta.category} onChange={(e) => setMeta({ ...meta, category: e.target.value })} onBlur={() => save(meta)} className="w-full rounded-lg border border-white/[.12] px-2.5 py-1.5 text-[13.5px] " />
 </Field>

 <Field label="Description">
 <textarea value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} onBlur={() => save(meta)} rows={2} className="w-full rounded-lg border border-white/[.12] px-2.5 py-1.5 text-[13.5px] " />
 </Field>

 <div>
 <p className="mb-2 text-[12.5px] font-bold text-[#767e8d] ">Slots ({slots.length})</p>
 <div className="grid gap-2">
 {slots.map((slot, i) => (
 <div key={slot.key} className="rounded-lg border border-white/[.12] p-2.5 ">
 <div className="flex items-center justify-between gap-2">
 <span className="text-[11.5px] font-bold text-[#767e8d]">{slot.key}</span>
 {slot.targets.length > 1 && <span className="rounded-full bg-[#5b4bff]/[.18] px-1.5 py-0.5 text-[10px] font-bold text-[#cfc8ff]">feeds {slot.targets.length} slides</span>}
 </div>
 <input
 value={slot.label}
 onChange={(e) => {
 const next = slots.map((s, si) => (si === i ? { ...s, label: e.target.value } : s));
 setSlots(next);
 }}
 onBlur={() => saveSlots(slots)}
 placeholder="Label"
 className="mt-1.5 w-full rounded-md border border-white/[.12] px-2 py-1 text-[12.5px] "
 />
 <input
 value={slot.hint}
 onChange={(e) => {
 const next = slots.map((s, si) => (si === i ? { ...s, hint: e.target.value } : s));
 setSlots(next);
 }}
 onBlur={() => saveSlots(slots)}
 placeholder="Hint"
 className="mt-1 w-full rounded-md border border-white/[.12] px-2 py-1 text-[12.5px] "
 />
 </div>
 ))}
 </div>
 </div>

 {saving && <p className="text-[11.5px] text-[#767e8d]">Saving…</p>}
 </div>
 );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
 return (
 <label className="block">
 <span className="mb-1 block text-[12.5px] font-bold text-[#767e8d] ">{label}</span>
 {children}
 </label>
 );
}
