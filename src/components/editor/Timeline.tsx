'use client';

import { useEffect, useRef, useState } from 'react';

import { resolveStyle } from '@/engine/render';
import type { Project, Segment } from '@/engine/types';
import { useEditorStore } from '@/store/editorStore';

function formatDur(s: number): string {
  return `${s.toFixed(1)}s`;
}
function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`;
}

const MIN_DUR = 0.5;
const CLIP_GAP = 4; // px of visual gap at each clip's right edge
const DRAG_THRESHOLD = 4; // px before a press becomes a drag
const ZOOM_STEPS = [1, 2, 4, 8] as const;
const ZOOM_KEY = 'promo-studio:timeline-zoom';

type Drag =
  | { mode: 'press'; x0: number; seg: number | null }
  | { mode: 'scrub' }
  | { mode: 'trim'; seg: number; x0: number; dur0: number; moved: boolean }
  | { mode: 'reorder'; seg: number; x0: number; dx: number; beforeId: number | null; markerT: number };

/**
 * The filmstrip. Every segment of the video — intro, each visible slide,
 * outro — is drawn at its real start time on ONE time scale (pixels per
 * second), the same scale the playhead and clicks use, so the playhead
 * always sits exactly on the real slide boundaries.
 *
 *  - click anywhere: seek to that exact time (and select the clip under it)
 *  - drag the playhead knob, or drag across the strip: scrub
 *  - drag a clip's right edge: change its duration (0.1s steps)
 *  - drag a slide sideways: reorder it among the slides
 *  - ←/→ seek 0.1s (shift: 1s) when the strip has focus
 *
 * Zoomable: at Fit the whole video fits the strip; at 2×/4×/8× it scrolls,
 * and the playhead is kept in view during playback.
 */
export default function Timeline({ project, segments, total, t, onSeek }: { project: Project; segments: Segment[]; total: number; t: number; onSeek: (t: number) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId);
  const selectScene = useEditorStore((s) => s.selectScene);
  const updateSlide = useEditorStore((s) => s.updateSlide);
  const setIntro = useEditorStore((s) => s.setIntro);
  const setOutro = useEditorStore((s) => s.setOutro);
  const moveSlideBefore = useEditorStore((s) => s.moveSlideBefore);

  const [fitWidth, setFitWidth] = useState(0);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const zoom = ZOOM_STEPS[zoomIndex];

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(ZOOM_KEY));
    const idx = ZOOM_STEPS.indexOf(stored as (typeof ZOOM_STEPS)[number]);
    // One-time client-only read (localStorage isn't available during SSR).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (idx >= 0) setZoomIndex(idx);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setFitWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // One scale for everything: clips, playhead, clicks.
  const pxPerSecond = total > 0 && fitWidth > 0 ? (fitWidth / total) * zoom : 0;
  const trackWidth = Math.max(fitWidth, total * pxPerSecond);
  const zoomed = zoom > 1;
  const speedFactor = project.motionSpeed / 100;

  // Keep the playhead in view as it moves during playback/seek.
  useEffect(() => {
    if (!zoomed || dragRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const x = t * pxPerSecond;
    if (x < el.scrollLeft || x > el.scrollLeft + el.clientWidth) el.scrollLeft = Math.max(0, x - el.clientWidth / 2);
  }, [t, pxPerSecond, zoomed]);

  const timeAt = (clientX: number) => {
    const el = trackRef.current;
    if (!el || pxPerSecond <= 0) return 0;
    return Math.min(total, Math.max(0, (clientX - el.getBoundingClientRect().left) / pxPerSecond));
  };
  const segAtTime = (time: number) => {
    const i = segments.findIndex((g) => time >= g.start && time < g.start + g.dur);
    return i < 0 ? segments.length - 1 : i;
  };
  const selectSeg = (seg: Segment) => selectScene(seg.type === 'scene' ? seg.scene!.id : seg.type === 'intro' ? 'intro' : 'outro');
  const setDragState = (d: Drag | null) => {
    dragRef.current = d;
    setDrag(d);
  };

  /** Where a dragged slide would land: before the first other slide whose
   * middle is right of the pointer, else after the last slide. */
  const dropTarget = (time: number, dragged: number) => {
    const scenes = segments.map((g, i) => ({ g, i })).filter(({ g, i }) => g.type === 'scene' && i !== dragged);
    for (const { g } of scenes) if (time < g.start + g.dur / 2) return { beforeId: g.scene!.id, markerT: g.start };
    const last = scenes.at(-1)?.g;
    // After the last visible slide = before whatever slide follows it (a hidden one) or the end.
    const lastIdx = last ? project.scenes.findIndex((s) => s.id === last.scene!.id) : -1;
    const next = lastIdx >= 0 ? project.scenes.slice(lastIdx + 1).find((s) => s.id !== segments[dragged].scene!.id) : undefined;
    return { beforeId: next ? next.id : null, markerT: last ? last.start + last.dur : 0 };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || total <= 0) return;
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-tl]');
    trackRef.current?.setPointerCapture(e.pointerId);
    const kind = target?.dataset.tl;
    const seg = target?.dataset.seg !== undefined ? Number(target.dataset.seg) : null;
    if (kind === 'edge' && seg !== null) {
      setDragState({ mode: 'trim', seg, x0: e.clientX, dur0: segments[seg].dur, moved: false });
    } else if (kind === 'playhead') {
      setDragState({ mode: 'scrub' });
    } else {
      setDragState({ mode: 'press', x0: e.clientX, seg });
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.mode === 'press') {
      if (Math.abs(e.clientX - d.x0) < DRAG_THRESHOLD) return;
      const seg = d.seg !== null ? segments[d.seg] : null;
      if (seg?.type === 'scene') {
        const target = dropTarget(timeAt(e.clientX), d.seg!);
        setDragState({ mode: 'reorder', seg: d.seg!, x0: d.x0, dx: e.clientX - d.x0, ...target });
      } else {
        setDragState({ mode: 'scrub' });
        onSeek(timeAt(e.clientX));
      }
      return;
    }
    if (d.mode === 'scrub') onSeek(timeAt(e.clientX));
    else if (d.mode === 'trim') {
      if (!d.moved) {
        if (Math.abs(e.clientX - d.x0) < DRAG_THRESHOLD) return;
        dragRef.current = { ...d, moved: true };
      }
      const seg = segments[d.seg];
      const shown = Math.max(MIN_DUR, Math.round((d.dur0 + (e.clientX - d.x0) / pxPerSecond) * 10) / 10);
      // Shown durations are scaled by Motion speed; the stored value isn't.
      const dur = Math.round(shown * speedFactor * 100) / 100;
      if (seg.type === 'scene') updateSlide(seg.scene!.id, { dur });
      else if (seg.type === 'intro') setIntro({ dur });
      else setOutro({ dur });
    } else if (d.mode === 'reorder') {
      const target = dropTarget(timeAt(e.clientX), d.seg);
      setDragState({ ...d, dx: e.clientX - d.x0, ...target });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    setDragState(null);
    if (!d) return;
    if (d.mode === 'press' || (d.mode === 'trim' && !d.moved)) {
      // A click (also on a trim handle that wasn't dragged): seek to exactly where it landed, select what's there.
      const time = timeAt(e.clientX);
      onSeek(time);
      const seg = segments[segAtTime(time)];
      if (seg) selectSeg(seg);
    } else if (d.mode === 'reorder') {
      const id = segments[d.seg].scene!.id;
      moveSlideBefore(id, d.beforeId);
      selectScene(id);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const step = (e.shiftKey ? 1 : 0.1) * (e.key === 'ArrowLeft' ? -1 : 1);
    onSeek(Math.min(total, Math.max(0, t + step)));
  };

  const setZoom = (idx: number) => {
    const clamped = Math.max(0, Math.min(ZOOM_STEPS.length - 1, idx));
    setZoomIndex(clamped);
    window.localStorage.setItem(ZOOM_KEY, String(ZOOM_STEPS[clamped]));
  };

  const tooltip =
    drag?.mode === 'trim'
      ? { x: (segments[drag.seg].start + segments[drag.seg].dur) * pxPerSecond, text: formatDur(segments[drag.seg].dur) }
      : drag?.mode === 'scrub'
        ? { x: t * pxPerSecond, text: formatTime(t) }
        : null;

  return (
    <div className="flex flex-1 items-center gap-2">
      {/* pt-2.5: room for the playhead knob, which sits above the strip. */}
      <div ref={scrollRef} className={`min-w-0 flex-1 pt-2.5 ${zoomed ? 'overflow-x-auto' : 'overflow-hidden'}`}>
        <div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label="Timeline: click to seek, drag to scrub"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={Number(t.toFixed(1))}
          aria-valuetext={`${formatTime(t)} of ${formatTime(total)}`}
          style={{ width: zoomed ? trackWidth : '100%' }}
          className={`relative h-[58px] touch-none select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff] ${drag?.mode === 'scrub' ? 'cursor-ew-resize' : 'cursor-pointer'}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => setDragState(null)}
          onKeyDown={onKeyDown}
        >
          {pxPerSecond > 0 &&
            segments.map((seg, i) => {
              const isScene = seg.type === 'scene';
              const id = isScene ? seg.scene!.id : seg.type;
              const active = id === selectedSceneId;
              const style = resolveStyle(project, seg.owner);
              const dragging = drag?.mode === 'reorder' && drag.seg === i;
              const canTrim = !(isScene && seg.scene!.kind === 'story'); // story length comes from its actions
              return (
                <div
                  key={String(id)}
                  data-tl="clip"
                  data-seg={i}
                  data-id={String(id)}
                  data-start={seg.start.toFixed(3)}
                  data-dur={seg.dur.toFixed(3)}
                  style={{
                    left: seg.start * pxPerSecond,
                    width: Math.max(2, seg.dur * pxPerSecond - CLIP_GAP),
                    background: isScene ? `linear-gradient(150deg, ${style.colors.a}, ${style.colors.b})` : 'rgba(255,255,255,.05)',
                    opacity: active || dragging ? 1 : isScene ? 0.62 : 0.85,
                    borderColor: active ? '#8b7dff' : 'rgba(255,255,255,.08)',
                    transform: dragging ? `translateX(${drag.dx}px)` : undefined,
                    zIndex: dragging ? 5 : undefined,
                    boxShadow: dragging ? '0 12px 30px rgba(0,0,0,.5)' : undefined,
                  }}
                  className={`absolute top-0 bottom-0 flex min-w-0 flex-col justify-end overflow-hidden rounded-[10px] border-2 px-2.5 py-1.5 ${isScene ? '' : 'border-dashed'} ${dragging ? 'cursor-grabbing' : ''}`}
                >
                  <span className="truncate text-[11.5px] font-semibold text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,.5)' }}>
                    {seg.label}
                  </span>
                  <span className="truncate text-[10.5px] text-white/75" style={{ textShadow: '0 1px 3px rgba(0,0,0,.5)' }}>
                    {formatDur(seg.dur)}
                  </span>
                  {canTrim && (
                    <span
                      data-tl="edge"
                      data-seg={i}
                      title="Drag to change the duration"
                      aria-hidden
                      className="group absolute top-0 right-0 bottom-0 flex w-3 cursor-ew-resize items-center justify-center"
                    >
                      <span className="h-[60%] w-[4px] rounded-full bg-white/35 group-hover:bg-white/70" />
                    </span>
                  )}
                </div>
              );
            })}

          {drag?.mode === 'reorder' && (
            <div className="pointer-events-none absolute -top-1 -bottom-1 z-10 w-[3px] -translate-x-1/2 rounded-full bg-[#8b7dff]" style={{ left: drag.markerT * pxPerSecond - CLIP_GAP / 2 }} />
          )}

          {/* Playhead: the line is exactly at t on the same scale as the clips; the knob is draggable. */}
          <div className="pointer-events-none absolute -top-1 -bottom-1 z-20 w-0.5 -translate-x-1/2 rounded-sm bg-white shadow-[0_0_10px_rgba(255,255,255,.7)]" style={{ left: t * pxPerSecond }} data-playhead>
            <span data-tl="playhead" className="pointer-events-auto absolute -top-2 left-1/2 grid h-5 w-5 -translate-x-1/2 cursor-ew-resize place-items-center" title="Drag to scrub">
              <span className="h-3 w-3 rounded-full bg-white" />
            </span>
          </div>

          {tooltip && (
            <div className="pointer-events-none absolute top-1 z-30 -translate-x-1/2 rounded-[6px] bg-[#08090c] px-1.5 py-0.5 text-[11px] font-semibold text-white tabular-nums ring-1 ring-white/15" style={{ left: tooltip.x }}>
              {tooltip.text}
            </div>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 rounded-[8px] border border-white/[.12] p-0.5">
        <button
          type="button"
          onClick={() => setZoom(zoomIndex - 1)}
          disabled={zoomIndex === 0}
          aria-label="Zoom timeline out"
          className="grid h-6 w-6 place-items-center rounded-[6px] text-[13px] text-[#c9cdd8] transition-colors duration-[.16s] hover:bg-white/[.08] disabled:opacity-30"
        >
          −
        </button>
        <span className="w-[30px] text-center text-[10.5px] font-semibold text-[#9aa1af] tabular-nums">{zoom === 1 ? 'Fit' : `${zoom}×`}</span>
        <button
          type="button"
          onClick={() => setZoom(zoomIndex + 1)}
          disabled={zoomIndex === ZOOM_STEPS.length - 1}
          aria-label="Zoom timeline in"
          className="grid h-6 w-6 place-items-center rounded-[6px] text-[13px] text-[#c9cdd8] transition-colors duration-[.16s] hover:bg-white/[.08] disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}
