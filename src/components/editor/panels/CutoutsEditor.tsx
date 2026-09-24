'use client';

import { useState } from 'react';

import { CUTOUT_PRESETS } from '@/engine/constants';
import type { CutoutLayer, CutoutPreset, ImageSlide } from '@/engine/types';
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<CutoutSuggestion[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState('');

  const setCutout = <K extends keyof CutoutLayer>(id: string, key: K, value: CutoutLayer[K]) => updateCutout(slide.id, id, { [key]: value } as Partial<CutoutLayer>);

  const create = (rect: CutoutLayer['rect']) => {
    const id = addCutout(slide.id, rect);
    setSelectedId(id);
  };

  const detect = async () => {
    if (!projectId) {
      setDetectError('Save this project first (it needs to be a saved project, not the local demo).');
      return;
    }
    if (!slide.imgAssetId) return;
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
      setSuggestions(result.elements.map((el, i) => ({ id: `sugg-${i}`, label: el.label, rect: el.rect })));
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
      <p className="mb-2.5 text-[12.5px] text-neutral-500 dark:text-neutral-400">Drag a rectangle on the screenshot to pop that piece out as its own layer. Click a cutout to edit it, drag its corners to resize, or the amber dot to round its corners.</p>

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
        <button onClick={detect} disabled={detecting || !slide.imgAssetId} className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-[12.5px] font-bold disabled:opacity-50 dark:border-white/10 dark:bg-neutral-800">
          {detecting ? 'Looking…' : '✨ Detect elements'}
        </button>
        {suggestions.length > 0 && <span className="text-[12px] text-neutral-500 dark:text-neutral-400">Click a suggestion on the screenshot to add it.</span>}
      </div>
      {detectError && <p className="mt-1.5 text-[12.5px] font-semibold text-red-600">{detectError}</p>}

      {slide.cutouts.length === 0 ? (
        <p className="mt-3 text-[12.5px] text-neutral-500 dark:text-neutral-400">No cutouts yet.</p>
      ) : (
        <div className="mt-3 grid gap-2">
          {slide.cutouts.map((c, i) => (
            <div key={c.id} onClick={() => setSelectedId(c.id)} className={`cursor-pointer rounded-xl p-2.5 ${c.id === selectedId ? 'bg-indigo-100 dark:bg-indigo-500/15' : 'bg-neutral-100 dark:bg-neutral-800/60'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12.5px] font-bold">Cutout {i + 1}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeCutout(slide.id, c.id);
                    if (selectedId === c.id) setSelectedId(null);
                  }}
                  className="text-[12px] font-bold text-red-600"
                >
                  Delete
                </button>
              </div>
              {c.id === selectedId && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="block text-[11.5px] font-semibold text-neutral-500 dark:text-neutral-400">
                    Preset
                    <select
                      value={c.preset}
                      onChange={(e) => setCutout(c.id, 'preset', e.target.value as CutoutPreset)}
                      className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-2 py-1.5 text-[13px] dark:border-white/10 dark:bg-neutral-800"
                    >
                      {CUTOUT_PRESETS.map(([v, label]) => (
                        <option key={v} value={v}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-[11.5px] font-semibold text-neutral-500 dark:text-neutral-400">
                    Starts at
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={c.at}
                      onChange={(e) => setCutout(c.id, 'at', Math.max(0, Number(e.target.value)))}
                      className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-2 py-1.5 text-[13px] dark:border-white/10 dark:bg-neutral-800"
                    />
                  </label>
                  <label className="col-span-2 block text-[11.5px] font-semibold text-neutral-500 dark:text-neutral-400">
                    Corner radius
                    <input type="range" min={0} max={0.5} step={0.01} value={c.radius} onChange={(e) => setCutout(c.id, 'radius', Number(e.target.value))} className="mt-1.5 block w-full accent-indigo-600" />
                  </label>
                  {c.preset === 'stack' && (
                    <label className="block text-[11.5px] font-semibold text-neutral-500 dark:text-neutral-400">
                      Stack position
                      <input
                        type="number"
                        min={0}
                        value={c.stackIndex}
                        onChange={(e) => setCutout(c.id, 'stackIndex', Math.max(0, Math.round(Number(e.target.value))))}
                        className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-2 py-1.5 text-[13px] dark:border-white/10 dark:bg-neutral-800"
                      />
                    </label>
                  )}
                  <label className="col-span-2 flex items-center gap-2 text-[12.5px] font-semibold">
                    <input type="checkbox" checked={c.hollow} onChange={(e) => setCutout(c.id, 'hollow', e.target.checked)} className="h-[16px] w-[16px] accent-indigo-600" />
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
