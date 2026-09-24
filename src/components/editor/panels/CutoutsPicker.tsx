'use client';

import { useRef, useState } from 'react';

import type { CutoutLayer, ImageAsset } from '@/engine/types';
import { assetSrc } from '@/lib/assetSrc';

export interface CutoutSuggestion {
  id: string;
  label: string;
  rect: { x: number; y: number; w: number; h: number };
}

type Rect = { x: number; y: number; w: number; h: number };
type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'radius';

const MIN_SIZE = 0.02;

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function normalizeRect(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
  const x = Math.min(a.x, b.x),
    y = Math.min(a.y, b.y);
  return { x, y, w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
}

/**
 * Draws/edits CutoutLayer rects directly on the *full* source screenshot —
 * the ScreenPlacementPicker pattern (percentage-positioned absolute
 * overlays on a plain <img>), extended from click-a-point to drag-a-
 * rectangle, move, resize from a corner, and adjust corner radius from a
 * dedicated handle. Positions are normalized 0-1 against the full image,
 * matching every cutout's `rect` field, not the cropped/cover-fit device
 * screen box — so this stays correct regardless of format or device frame.
 */
export default function CutoutsPicker({
  image,
  cutouts,
  selectedId,
  suggestions = [],
  onCreate,
  onSelect,
  onChangeRect,
  onChangeRadius,
  onAcceptSuggestion,
}: {
  image: ImageAsset | null;
  cutouts: CutoutLayer[];
  selectedId: string | null;
  suggestions?: CutoutSuggestion[];
  onCreate: (rect: Rect) => void;
  onSelect: (id: string) => void;
  onChangeRect: (id: string, rect: Rect) => void;
  onChangeRadius: (id: string, radius: number) => void;
  onAcceptSuggestion: (s: CutoutSuggestion) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<Rect | null>(null);
  const drag = useRef<{ kind: 'create'; start: { x: number; y: number } } | { kind: 'move'; id: string; start: { x: number; y: number }; rectStart: Rect } | { kind: 'resize'; id: string; handle: Handle; rectStart: Rect } | { kind: 'radius'; id: string } | null>(null);

  const pointFromEvent = (e: React.PointerEvent): { x: number; y: number } => {
    const r = containerRef.current!.getBoundingClientRect();
    return { x: clamp01((e.clientX - r.left) / r.width), y: clamp01((e.clientY - r.top) / r.height) };
  };

  const onContainerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.cutoutBg) return;
    const p = pointFromEvent(e);
    drag.current = { kind: 'create', start: p };
    setDraft({ x: p.x, y: p.y, w: 0, h: 0 });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const startMove = (e: React.PointerEvent, cutout: CutoutLayer) => {
    e.stopPropagation();
    onSelect(cutout.id);
    drag.current = { kind: 'move', id: cutout.id, start: pointFromEvent(e), rectStart: cutout.rect };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const startResize = (e: React.PointerEvent, cutout: CutoutLayer, handle: Handle) => {
    e.stopPropagation();
    onSelect(cutout.id);
    drag.current = { kind: 'resize', id: cutout.id, handle, rectStart: cutout.rect };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const startRadius = (e: React.PointerEvent, cutout: CutoutLayer) => {
    e.stopPropagation();
    onSelect(cutout.id);
    drag.current = { kind: 'radius', id: cutout.id };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const p = pointFromEvent(e);
    if (d.kind === 'create') {
      setDraft(normalizeRect(d.start, p));
    } else if (d.kind === 'move') {
      const dx = p.x - d.start.x,
        dy = p.y - d.start.y;
      const w = d.rectStart.w,
        h = d.rectStart.h;
      const x = Math.min(1 - w, Math.max(0, d.rectStart.x + dx));
      const y = Math.min(1 - h, Math.max(0, d.rectStart.y + dy));
      onChangeRect(d.id, { x, y, w, h });
    } else if (d.kind === 'resize') {
      const r = d.rectStart;
      let x = r.x,
        y = r.y,
        w = r.w,
        h = r.h;
      const right = r.x + r.w,
        bottom = r.y + r.h;
      if (d.handle === 'nw') {
        x = Math.min(p.x, right - MIN_SIZE);
        y = Math.min(p.y, bottom - MIN_SIZE);
        w = right - x;
        h = bottom - y;
      } else if (d.handle === 'ne') {
        y = Math.min(p.y, bottom - MIN_SIZE);
        w = Math.max(MIN_SIZE, p.x - r.x);
        h = bottom - y;
      } else if (d.handle === 'sw') {
        x = Math.min(p.x, right - MIN_SIZE);
        w = right - x;
        h = Math.max(MIN_SIZE, p.y - r.y);
      } else if (d.handle === 'se') {
        w = Math.max(MIN_SIZE, p.x - r.x);
        h = Math.max(MIN_SIZE, p.y - r.y);
      }
      onChangeRect(d.id, { x: clamp01(x), y: clamp01(y), w: Math.min(w, 1 - x), h: Math.min(h, 1 - y) });
    } else if (d.kind === 'radius') {
      const cutout = cutouts.find((c) => c.id === d.id);
      if (!cutout) return;
      const { x, y, w, h } = cutout.rect;
      // Distance from the box's top-left corner toward its center, as a
      // fraction of the shorter side — 0 at the corner (square), 0.5 at the
      // center (a full stadium/circle).
      const cornerDist = Math.hypot(p.x - x, p.y - y);
      const maxDist = Math.hypot(w, h) / 2;
      onChangeRadius(d.id, clamp01(cornerDist / Math.max(0.0001, maxDist)) * 0.5);
    }
  };

  const onPointerUp = () => {
    const d = drag.current;
    if (d?.kind === 'create' && draft && draft.w > MIN_SIZE / 2 && draft.h > MIN_SIZE / 2) {
      onCreate(draft);
    }
    drag.current = null;
    setDraft(null);
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={onContainerPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="relative w-full touch-none overflow-hidden rounded-xl bg-black select-none"
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- in-memory/data-URL asset
        <img data-cutout-bg src={assetSrc(image)} alt="" className="block h-auto w-full cursor-crosshair select-none" draggable={false} />
      ) : (
        <div className="grid h-[220px] place-items-center px-3 text-center text-[12px] text-neutral-400">Add a screenshot to draw cutouts on it</div>
      )}

      {suggestions.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAcceptSuggestion(s);
          }}
          title={`Add cutout: ${s.label}`}
          style={{ left: `${s.rect.x * 100}%`, top: `${s.rect.y * 100}%`, width: `${s.rect.w * 100}%`, height: `${s.rect.h * 100}%` }}
          className="absolute rounded border-2 border-dashed border-amber-400 bg-amber-400/10 text-[10px] font-bold text-amber-200 hover:bg-amber-400/25"
        >
          <span className="absolute -top-5 left-0 rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-black">+ {s.label}</span>
        </button>
      ))}

      {cutouts.map((c) => {
        const selected = c.id === selectedId;
        return (
          <div
            key={c.id}
            onPointerDown={(e) => startMove(e, c)}
            style={{ left: `${c.rect.x * 100}%`, top: `${c.rect.y * 100}%`, width: `${c.rect.w * 100}%`, height: `${c.rect.h * 100}%`, borderRadius: `${c.radius * 100}%` }}
            className={`absolute cursor-move border-2 ${selected ? 'border-indigo-400 bg-indigo-400/15' : 'border-white/70 bg-white/5 hover:border-white'}`}
          >
            {selected && (
              <>
                {(['nw', 'ne', 'sw', 'se'] as const).map((h) => (
                  <span
                    key={h}
                    onPointerDown={(e) => startResize(e, c, h)}
                    style={{
                      left: h.includes('w') ? -6 : undefined,
                      right: h.includes('e') ? -6 : undefined,
                      top: h.includes('n') ? -6 : undefined,
                      bottom: h.includes('s') ? -6 : undefined,
                      cursor: h === 'nw' || h === 'se' ? 'nwse-resize' : 'nesw-resize',
                    }}
                    className="absolute h-3 w-3 rounded-full border-2 border-indigo-500 bg-white"
                  />
                ))}
                <span onPointerDown={(e) => startRadius(e, c)} title="Drag to adjust corner radius" style={{ left: 10, top: 10, cursor: 'pointer' }} className="absolute h-3 w-3 rounded-full border-2 border-amber-400 bg-white" />
              </>
            )}
          </div>
        );
      })}

      {draft && (
        <div
          style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%`, width: `${draft.w * 100}%`, height: `${draft.h * 100}%` }}
          className="pointer-events-none absolute border-2 border-dashed border-indigo-300 bg-indigo-300/10"
        />
      )}
    </div>
  );
}
