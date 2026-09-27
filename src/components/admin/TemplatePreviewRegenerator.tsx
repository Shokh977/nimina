'use client';

import { useState } from 'react';

import { exportVideo } from '@/engine/export';
import { getTemplate } from '@/engine/templates';
import { applyShortVariant } from '@/lib/templateShortVariant';
import { createClient } from '@/lib/supabase/client';
import { loadProjectImageAssets } from '@/lib/supabase/storage';
import type { TemplateData } from '@/lib/supabase/templates';

const BUCKET = 'template-previews';

/** Runs the real canvas/MediaRecorder export client-side, in the admin's
 * own browser tab (there's no server-side headless-browser rendering in
 * this app — video export has always been a client-side pipeline, see
 * CLAUDE.md's "known limitation, by design"). Same bucket/path convention
 * as scripts/render-template-previews.mjs, so nothing else (the gallery
 * card's video src) needs to change.
 *
 * Assets come from whatever the admin has actually uploaded to this
 * template's scenes (loadProjectImageAssets, the same real-upload lookup
 * the editor itself uses) — a code-level procedural sample generator
 * (buildSampleAssets, only implemented for a handful of templates) fills
 * in any scene that doesn't have a real upload yet, rather than gating the
 * whole button on that generator existing. */
export default function TemplatePreviewRegenerator({ templateId, sampleAssetsSourceId }: { templateId: string; sampleAssetsSourceId: string | null }) {
 const [log, setLog] = useState<string[]>([]);
 const [running, setRunning] = useState(false);

 const run = async () => {
 setRunning(true);
 const lines: string[] = [];
 const supabase = createClient();

 const { data: row } = await supabase.from('templates').select('data').eq('id', templateId).single();
 if (!row) {
 setLog(['[fail] could not load current template data']);
 setRunning(false);
 return;
 }
 const data = row.data as TemplateData;
 const sourceDef = sampleAssetsSourceId ? getTemplate(sampleAssetsSourceId) : undefined;
 const sampleAssets = sourceDef?.buildSampleAssets?.() ?? {};
 const realAssets = await loadProjectImageAssets(supabase, templateId, data.project);
 const assets = { ...sampleAssets, ...realAssets };
 const urls: Partial<{ '9x16': string; '16x9': string }> = {};

 for (const [tag, fmt] of [
 ['9x16', '9:16'],
 ['16x9', '16:9'],
 ] as const) {
 try {
 const project = applyShortVariant(data.project, data.shortVariant);
 const result = await exportVideo({ ...project, format: fmt }, assets, null, { resolution: '1080p' }, new AbortController().signal);
 const path = `${templateId}/preview-${tag}.mp4`;
 const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, result.blob, { upsert: true, contentType: 'video/mp4' });
 if (uploadErr) throw uploadErr;
 const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
 urls[tag] = pub.publicUrl;
 lines.push(`[ok] ${tag}: ${(result.sizeBytes / 1048576).toFixed(2)}MB, ${result.seconds.toFixed(1)}s`);
 } catch (err) {
 lines.push(`[fail] ${tag}: ${err instanceof Error ? err.message : String(err)}`);
 }
 setLog([...lines]);
 }

 if (urls['9x16'] || urls['16x9']) {
 const update: Record<string, string> = {};
 if (urls['9x16']) update.preview_video_9x16_url = urls['9x16'];
 if (urls['16x9']) update.preview_video_16x9_url = urls['16x9'];
 const { error } = await supabase.from('templates').update(update).eq('id', templateId);
 if (error) lines.push(`[fail] writing URLs back: ${error.message}`);
 else lines.push('[ok] preview URLs saved');
 setLog([...lines]);
 }

 setRunning(false);
 };

 return (
 <div>
 <p className="mb-2 text-[12.5px] font-bold text-[#767e8d] ">Preview video</p>
 <p className="mb-2 text-[12px] text-[#767e8d] ">Renders using whatever screenshots are already on this template&apos;s slides.</p>
 <button onClick={run} disabled={running} className="rounded-lg border border-white/[.12] px-3 py-1.5 text-[12.5px] font-bold disabled:opacity-50 ">
 {running ? 'Rendering… (30-60s per format, keep this tab open)' : 'Re-render previews'}
 </button>
 {log.length > 0 && <pre className="mt-2 rounded-lg bg-white/[.03] p-2 text-[11px] whitespace-pre-wrap ">{log.join('\n')}</pre>}
 </div>
 );
}
