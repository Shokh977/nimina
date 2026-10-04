'use client';

import { useState } from 'react';

import { CUTOUT_PRESETS } from '@/engine/constants';
import type { CutoutLayer, CutoutPreset, ImageSlide } from '@/engine/types';
import { AiUsageNote, reportAiUsage, useAiUsage } from '@/components/ai/useAiUsage';
import type { AiFeatureUsage } from '@/lib/ai/usage';
import { useEditorStore } from '@/store/editorStore';
import CutoutsPicker, { type CutoutSuggestion } from './CutoutsPicker';

interface DetectResponse {
 elements: Array<{ kind: string; label: string; rect: { x: number; y: number; w: number; h: number } }>;
}

/**
 * "Cutouts" editor for one image slide (Prompt 3): draw a rectangle on the
 * screenshot to pop that piece out as its own animated layer, pick a
 * one-click preset, toggle whether the area it leaves behind is hollowed
 * out, and (optionally) let Claude suggest buttons/cards/list items/bubbles
 * to cut out instead of drawing by hand.
 */
export default function CutoutsEditor({ slide, img }: { slide: ImageSlide; img: HTMLImageElement | HTMLCanvasElement | null }) {
 const projectId = useEditorStore((s) => s.projectId);
 const addCutout = useEditorStore((s) => s.addCutout);
 const updateCutout = useEditorStore((s) => s.updateCutout);
 const removeCutout = useEditorStore((s) => s.removeCutout);
 const updateSlide = useEditorStore((s) => s.updateSlide);
 const aiUsage = useAiUsage();
 const [selectedId, setSelectedId] = useState<string | null>(null);
 const [suggestions, setSuggestions] = useState<CutoutSuggestion[]>([]);
 const [detecting, setDetecting] = useState(false);
 const [detectError, setDetectError] = useState('');

 const setCutout = <K extends keyof CutoutLayer>(id: string, key: K, value: CutoutLayer[K]) => updateCutout(slide.id, id, { [key]: value } as Partial<CutoutLayer>);

 const create = (rect: CutoutLayer['rect']) => {
 const id = addCutout(slide.id, rect);
 setSelectedId(id);
 };

 const cached = slide.detected && slide.detected.assetId === slide.imgAssetId ? slide.detected.elements : null;
 const showSuggestions = (elements: Array<{ label: string; rect: CutoutLayer['rect'] }>) => setSuggestions(elements.map((el, i) => ({ id: `sugg-${i}`, label: el.label, rect: el.rect })));

 const detect = async (fresh = false) => {
 if (!projectId) {
 setDetectError('Save this project first (it needs to be a saved project, not the local demo).');
 return;
 }
 if (!slide.imgAssetId) return;
 // Already detected on this screenshot: show those again — no AI call, no use counted.
 if (cached && !fresh) {
 setDetectError('');
 showSuggestions(cached);
 return;
 }
 setDetecting(true);
 setDetectError('');
 setSuggestions([]);
 try {
 const res = await fetch('/api/ai/detect-elements', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ projectId, sceneId: slide.id, assetId: slide.imgAssetId }),
 });
 const data = await res.json();
 if (!res.ok) throw new Error(data?.error || 'Element detection failed.');
 const result = data as DetectResponse;
 const elements = result.elements.map((el) => ({ label: el.label, rect: el.rect }));
 updateSlide(slide.id, { detected: { assetId: slide.imgAssetId, elements } });
 reportAiUsage('detect', (data as { usage?: AiFeatureUsage }).usage);
 showSuggestions(elements);
 } catch (err) {
 setDetectError(err instanceof Error ? err.message : 'Element detection failed.');
 } finally {
 setDetecting(false);
 }
 };

 const acceptSuggestion = (s: CutoutSuggestion) => {
 create(s.rect);
 setSuggestions((prev) => prev.filter((x) => x.id !== s.id));
 };

 return (
 <div>
 <p className="mb-2.5 text-[12.5px] text-[#767e8d] ">Drag a rectangle on the screenshot to pop that piece out as its own layer. Click a cutout to edit it, drag its corners to resize, or the amber dot to round its corners.</p>

 <CutoutsPicker
 image={img}
 cutouts={slide.cutouts}
 selectedId={selectedId}
 suggestions={suggestions}
 onCreate={create}
 onSelect={setSelectedId}
 onChangeRect={(id, rect) => setCutout(id, 'rect', rect)}
 onChangeRadius={(id, radius) => setCutout(id, 'radius', radius)}
 onAcceptSuggestion={acceptSuggestion}
 />

 <div className="mt-2.5 flex items-center gap-2.5">
 <button onClick={() => detect()} disabled={detecting || !slide.imgAssetId || (!cached && aiUsage?.features.detect.left === 0)} className="rounded-lg border border-white/[.12] bg-white/[.03] px-3 py-1.5 text-[12.5px] font-bold disabled:opacity-50 ">
 {detecting ? 'Looking…' : cached ? '✨ Show detected elements' : '✨ Detect elements'}
 </button>
 {cached && suggestions.length > 0 && (
 <button onClick={() => detect(true)} disabled={detecting} title="Ask the AI again (uses one of this month's detections)" className="text-[12px] font-semibold text-[#8b7dff] hover:text-[#a89bff] disabled:opacity-50">
 Detect again
 </button>
 )}
 {suggestions.length > 0 && <span className="text-[12px] text-[#767e8d] ">Click a suggestion on the screenshot to add it.</span>}
 </div>
 <AiUsageNote feature="detect" unit="detections" className="mt-1.5" />
 {detectError && <p className="mt-1.5 text-[12.5px] font-semibold text-[#ff8f76]">{detectError}</p>}

 {slide.cutouts.length === 0 ? (
 <p className="mt-3 text-[12.5px] text-[#767e8d] ">No cutouts yet.</p>
 ) : (
 <div className="mt-3 grid gap-2">
 {slide.cutouts.map((c, i) => (
 <div key={c.id} onClick={() => setSelectedId(c.id)} className={`cursor-pointer rounded-xl p-2.5 ${c.id === selectedId ? 'bg-[#5b4bff]/[.18]' : 'bg-white/[.03] /60'}`}>
 <div className="flex items-center justify-between gap-2">
 <span className="text-[12.5px] font-bold">Cutout {i + 1}</span>
 <button
 onClick={(e) => {
 e.stopPropagation();
 removeCutout(slide.id, c.id);
 if (selectedId === c.id) setSelectedId(null);
 }}
 className="text-[12px] font-bold text-[#ff8f76]"
 >
 Delete
 </button>
 </div>
 {c.id === selectedId && (
 <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
 <label className="block text-[11.5px] font-semibold text-[#767e8d] ">
 Preset
 <select
 value={c.preset}
 onChange={(e) => setCutout(c.id, 'preset', e.target.value as CutoutPreset)}
 className="mt-1 block w-full rounded-lg border border-white/[.12] bg-white/[.03] px-2 py-1.5 text-[13px] "
 >
 {CUTOUT_PRESETS.map(([v, label]) => (
 <option key={v} value={v}>
 {label}
 </option>
 ))}
 </select>
 </label>
 <label className="block text-[11.5px] font-semibold text-[#767e8d] ">
 Starts at
 <input
 type="number"
 min={0}
 step={0.1}
 value={c.at}
 onChange={(e) => setCutout(c.id, 'at', Math.max(0, Number(e.target.value)))}
 className="mt-1 block w-full rounded-lg border border-white/[.12] bg-white/[.03] px-2 py-1.5 text-[13px] "
 />
 </label>
 <label className="col-span-full block text-[11.5px] font-semibold text-[#767e8d] ">
 Corner radius
 <input type="range" min={0} max={0.5} step={0.01} value={c.radius} onChange={(e) => setCutout(c.id, 'radius', Number(e.target.value))} className="mt-1.5 block w-full accent-indigo-600" />
 </label>
 {c.preset === 'stack' && (
 <label className="block text-[11.5px] font-semibold text-[#767e8d] ">
 Stack position
 <input
 type="number"
 min={0}
 value={c.stackIndex}
 onChange={(e) => setCutout(c.id, 'stackIndex', Math.max(0, Math.round(Number(e.target.value))))}
 className="mt-1 block w-full rounded-lg border border-white/[.12] bg-white/[.03] px-2 py-1.5 text-[13px] "
 />
 </label>
 )}
 <label className="col-span-full flex min-h-11 items-center gap-2 text-[12.5px] font-semibold md:min-h-0">
 <input type="checkbox" checked={c.hollow} onChange={(e) => setCutout(c.id, 'hollow', e.target.checked)} className="h-[22px] w-[22px] shrink-0 accent-indigo-600 md:h-[16px] md:w-[16px]" />
 Hollow out the area it left behind
 </label>
 </div>
 )}
 </div>
 ))}
 </div>
 )}
 </div>
 );
}
