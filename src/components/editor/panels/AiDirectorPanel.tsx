'use client';

import { useState } from 'react';

import type { ImageSlide } from '@/engine/types';
import { AiUsageNote, reportAiUsage, useAiUsage } from '@/components/ai/useAiUsage';
import { MAX_DIRECTOR_SLIDES } from '@/lib/ai/usage';
import { useEditorStore } from '@/store/editorStore';

interface SlideSuggestion {
 sceneId: number;
 headline?: string;
 sub?: string;
 anim?: ImageSlide['anim'];
 effect?: ImageSlide['effect'];
 badge?: string;
 callout?: string;
}
interface DirectorResult {
 summary: string;
 slides: SlideSuggestion[];
}

/** Sends the project's screenshot slides to /api/ai/director (Claude with
 * vision) and lets the user review and apply its suggestions one at a time
 * or all at once — every apply goes through the normal updateSlide action,
 * so it's a regular undoable edit like anything else in the editor. */
export default function AiDirectorPanel() {
 const project = useEditorStore((s) => s.project);
 const projectId = useEditorStore((s) => s.projectId);
 const updateSlide = useEditorStore((s) => s.updateSlide);
 const aiUsage = useAiUsage();
 const [goal, setGoal] = useState('');
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState('');
 const [result, setResult] = useState<DirectorResult | null>(null);
 const [appliedIds, setAppliedIds] = useState<Set<number>>(new Set());

 const allImageSlides = project.scenes.filter((s): s is ImageSlide => s.kind === 'image' && !!s.imgAssetId);
 // One run looks at up to MAX_DIRECTOR_SLIDES screenshots (cost cap) — the first ones.
 const imageSlides = allImageSlides.slice(0, MAX_DIRECTOR_SLIDES);

 const run = async () => {
 if (!projectId) {
 setError('Save this project first (it needs to be a saved project, not the local demo).');
 return;
 }
 if (imageSlides.length === 0) {
 setError('Add at least one screenshot slide first.');
 return;
 }
 setLoading(true);
 setError('');
 setResult(null);
 setAppliedIds(new Set());
 try {
 const res = await fetch('/api/ai/director', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 projectId,
 goal: goal.trim() || 'Make this promo video more compelling.',
 screenshots: imageSlides.map((s) => ({ sceneId: s.id, assetId: s.imgAssetId })),
 }),
 });
 const data = await res.json();
 if (!res.ok) throw new Error(data?.error || 'AI Director failed.');
 setResult(data as DirectorResult);
 reportAiUsage('director', data.usage);
 } catch (err) {
 setError(err instanceof Error ? err.message : 'AI Director failed.');
 } finally {
 setLoading(false);
 }
 };

 const apply = (s: SlideSuggestion) => {
 const { sceneId, ...patch } = s;
 updateSlide(sceneId, patch);
 setAppliedIds((prev) => new Set(prev).add(sceneId));
 };

 const applyAll = () => {
 result?.slides.forEach(apply);
 };

 return (
 <div>
 <p className="mb-4 rounded-xl border border-[#8b7dff]/[.28] bg-[#5b4bff]/[.1] px-3.5 py-3 text-[12.5px] text-[#cfc8ff]">
 AI Director looks at your screenshot slides and suggests headlines, motion and effects. It never changes anything until you hit Apply.
 </p>

 <label className="block text-[12.5px] font-semibold text-[#767e8d] ">
 What&apos;s this video for?
 <input
 type="text"
 value={goal}
 onChange={(e) => setGoal(e.target.value)}
 placeholder="e.g. Launch announcement for our new checkout flow"
 className="mt-1 block w-full rounded-lg border border-white/[.12] bg-white/[.03] px-2.5 py-2 text-[14.5px] "
 />
 </label>
 <button onClick={run} disabled={loading || aiUsage?.features.director.left === 0} className="mt-3 rounded-xl bg-[#5b4bff] px-4 py-2.5 font-bold text-white disabled:opacity-50">
 {loading ? 'Thinking…' : `Analyze ${imageSlides.length} slide${imageSlides.length === 1 ? '' : 's'}`}
 </button>
 <AiUsageNote feature="director" unit="runs" className="mt-2" />
 {allImageSlides.length > MAX_DIRECTOR_SLIDES && <p className="mt-1 text-[12px] text-[#767e8d]">Each run looks at the first {MAX_DIRECTOR_SLIDES} screenshot slides.</p>}

 {error && <p className="mt-3 text-[13px] font-semibold text-[#ff8f76]">{error}</p>}

 {result && (
 <div className="mt-4">
 <p className="text-[13.5px] font-semibold">{result.summary}</p>
 {result.slides.length > 0 && (
 <button onClick={applyAll} className="mt-2 rounded-lg border border-white/[.12] bg-white/[.03] px-3 py-1.5 text-[12.5px] font-bold ">
 Apply all
 </button>
 )}
 <div className="mt-3 grid gap-2.5">
 {result.slides.map((s) => {
 const index = project.scenes.findIndex((sc) => sc.id === s.sceneId);
 const applied = appliedIds.has(s.sceneId);
 return (
 <div key={s.sceneId} className="rounded-xl bg-white/[.03] p-3">
 <div className="flex items-center justify-between gap-2">
 <span className="text-[13px] font-bold">Slide {index + 1}</span>
 <button
 onClick={() => apply(s)}
 disabled={applied}
 className="rounded-lg border border-white/[.12] bg-white/[.03] px-2.5 py-1 text-[12px] font-bold disabled:opacity-50 "
 >
 {applied ? 'Applied' : 'Apply'}
 </button>
 </div>
 <ul className="mt-1.5 grid gap-0.5 text-[12.5px] text-[#9aa1af]">
 {s.headline && <li>Headline → &ldquo;{s.headline}&rdquo;</li>}
 {s.sub && <li>Subtitle → &ldquo;{s.sub}&rdquo;</li>}
 {s.anim && <li>Motion → {s.anim}</li>}
 {s.effect && s.effect !== 'none' && <li>Effect → {s.effect}</li>}
 {s.badge && <li>Badge → {s.badge}</li>}
 {s.callout && <li>Callout → {s.callout}</li>}
 </ul>
 </div>
 );
 })}
 </div>
 </div>
 )}
 </div>
 );
}
