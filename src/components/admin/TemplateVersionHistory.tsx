'use client';

import { useEffect, useState } from 'react';

import { createClient } from '@/lib/supabase/client';
import type { TemplateData } from '@/lib/supabase/templates';
import { useEditorStore } from '@/store/editorStore';

interface VersionRow {
 version: number;
 created_at: string;
 created_by: string | null;
 data: TemplateData;
}

/** "Restore" snaps the live editor state back to an old snapshot —
 * loadProject() already resets undo history, so no new store method is
 * needed. The restored state isn't written back until the next autosave
 * fires (useTemplatePersistence), which records it as a *new* version —
 * history itself is never overwritten in place. */
export default function TemplateVersionHistory({ templateId }: { templateId: string }) {
 const [versions, setVersions] = useState<VersionRow[] | null>(null);
 const [emails, setEmails] = useState<Record<string, string>>({});

 useEffect(() => {
 let cancelled = false;
 const supabase = createClient();
 supabase
 .from('template_versions')
 .select('version, created_at, created_by, data')
 .eq('template_id', templateId)
 .order('version', { ascending: false })
 .then(async ({ data }) => {
 if (cancelled || !data) return;
 setVersions(data as VersionRow[]);
 const ids = [...new Set(data.map((v) => v.created_by).filter((id): id is string => !!id))];
 if (ids.length) {
 const { data: profiles } = await supabase.from('profiles').select('id, email').in('id', ids);
 if (!cancelled && profiles) setEmails(Object.fromEntries(profiles.map((p) => [p.id, p.email])));
 }
 });
 return () => {
 cancelled = true;
 };
 }, [templateId]);

 const restore = (version: VersionRow) => {
 if (!confirm(`Restore version ${version.version}? This replaces the current unsaved editing state.`)) return;
 useEditorStore.getState().loadProject(version.data.project, templateId, { images: useEditorStore.getState().assets.images });
 };

 if (!versions) return <p className="text-[13px] text-[#767e8d] ">Loading…</p>;

 return (
 <div className="grid gap-1.5">
 {versions.map((v) => (
 <div key={v.version} className="flex items-center justify-between gap-2 rounded-lg border border-white/[.12] px-2.5 py-2 text-[12.5px] ">
 <div>
 <span className="font-bold">v{v.version}</span>{' '}
 <span className="text-[#767e8d] ">
 {new Date(v.created_at).toLocaleString()} {v.created_by && `· ${emails[v.created_by] ?? 'admin'}`}
 </span>
 </div>
 <button onClick={() => restore(v)} className="shrink-0 rounded-md border border-white/[.12] px-2 py-1 text-[11.5px] font-bold ">
 Restore
 </button>
 </div>
 ))}
 {versions.length === 0 && <p className="text-[13px] text-[#767e8d] ">No history yet.</p>}
 </div>
 );
}
