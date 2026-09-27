'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { resolveStyle } from '@/engine/render';
import type { Project, Segment } from '@/engine/types';
import { useEditorStore } from '@/store/editorStore';

function formatDur(s: number): string {
  return `${s.toFixed(1)}s`;
}

const MIN_DUR = 0.5;
const ZOOM_STEPS = [1, 2, 4, 8] as const;
const ZOOM_KEY = 'promo-studio:timeline-zoom';

/** The filmstrip — one clip per visible slide (intro/outro don't get
 * clips here, though they're still part of `segments`/`total` since those
 * come straight from getTimeline()), a trim grip on each clip's right
 * edge, and a single playhead shared with row 1's transport controls.
 * Clicking a clip selects that slide and seeks to its start; dragging a
 * grip live-resizes that slide's duration.
 *
 * Zoomable: at 1x ("Fit") every clip's width is proportional to duration
 * within the visible track, same as before zoom existed. At 2x/4x/8x the
 * track is rendered at that many times the fit pixels-per-second and
 * becomes horizontally scrollable, so short clips get enough room to trim
 * precisely — the playhead auto-scrolls into view during playback so
 * zooming in doesn't lose track of where playback is. */
export default function Timeline({ project, segments, total, t, onSeek }: { project: Project; segments: Segment[]; total: number; t: number; onSeek: (t: number) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId);
  const selectScene = useEditorStore((s) => s.selectScene);
  const updateSlide = useEditorStore((s) => s.updateSlide);
  const dragRef = useRef<{ sceneId: number; startX: number; startDur: number; pxPerSecond: number } | null>(null);

  const [fitWidth, setFitWidth] = useState(0);
  const [zoomIndex, setZoomIndex] = useState(0);
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

  const pxPerSecond = total > 0 ? (fitWidth / total) * zoom : 0;
  const trackWidth = Math.max(fitWidth, total * pxPerSecond);
  const zoomed = zoom > 1;

  // Keep the playhead in view as it moves during playback/seek, without
  // fighting a manual scroll the user is mid-drag on.
  useEffect(() => {
    if (!zoomed) return;
    const el = scrollRef.current;
    if (!el) return;
    const playheadX = t * pxPerSecond;
    if (playheadX < el.scrollLeft || playheadX > el.scrollLeft + el.clientWidth) {
      el.scrollLeft = Math.max(0, playheadX - el.clientWidth / 2);
    }
  }, [t, pxPerSecond, zoomed]);

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || total <= 0) return;
      const r = el.getBoundingClientRect();
      onSeek(((clientX - r.left) / r.width) * total);
    },
    [total, onSeek],
  );

  const setZoom = (idx: number) => {
    const clamped = Math.max(0, Math.min(ZOOM_STEPS.length - 1, idx));
    setZoomIndex(clamped);
    window.localStorage.setItem(ZOOM_KEY, String(ZOOM_STEPS[clamped]));
  };

  const clips = segments.filter((seg) => seg.type === 'scene' && seg.scene);

  return (
    <div className="flex flex-1 items-center gap-2">
      <div ref={scrollRef} className={`min-w-0 flex-1 ${zoomed ? 'overflow-x-auto' : 'overflow-hidden'}`}>
        <div
          ref={trackRef}
          role="slider"
          aria-label="Filmstrip, drag to scrub"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={t}
          style={{ width: zoomed ? trackWidth : '100%' }}
          className="relative flex h-[58px] touch-none gap-1.5 select-none"
          onPointerDown={(e) => {
            if (dragRef.current) return;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            seekFromClientX(e.clientX);
          }}
          onPointerMove={(e) => {
            if (e.buttons !== 1 || dragRef.current) return;
            seekFromClientX(e.clientX);
          }}
        >
          {clips.map((seg) => {
            const active = seg.scene!.id === selectedSceneId;
            const style = resolveStyle(project, seg.owner);
            return (
              <div
                key={seg.scene!.id}
                style={{
                  ...(zoomed ? { width: seg.dur * pxPerSecond, flex: 'none' } : { flex: `${seg.dur} 1 0` }),
                  background: `linear-gradient(150deg, ${style.colors.a}, ${style.colors.b})`,
                  opacity: active ? 1 : 0.62,
                  borderColor: active ? '#8b7dff' : 'rgba(255,255,255,.08)',
                }}
                className="relative flex min-w-0 cursor-pointer flex-col justify-end overflow-hidden rounded-[10px] border-2 px-2.5 py-1.5 transition-[opacity,border-color] duration-[.16s]"
                onClick={() => {
                  selectScene(seg.scene!.id);
                  onSeek(seg.start);
                }}
              >
                <span className="truncate text-[11.5px] font-semibold text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,.5)' }}>
                  {seg.scene!.kind === 'text' ? 'Aa ' : seg.scene!.kind === 'story' ? '▶ ' : ''}
                  {seg.label}
                </span>
                <span className="text-[10.5px] text-white/75" style={{ textShadow: '0 1px 3px rgba(0,0,0,.5)' }}>
                  {formatDur(seg.dur)}
                </span>
                <button
                  type="button"
                  title="Drag to trim"
                  aria-label="Drag to trim this slide's duration"
                  className="absolute top-0 bottom-0 right-1 my-2.5 w-[5px] cursor-ew-resize rounded-full bg-white/35 hover:bg-white/60"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const el = trackRef.current;
                    if (!el || total <= 0) return;
                    (e.target as HTMLElement).setPointerCapture(e.pointerId);
                    dragRef.current = { sceneId: seg.scene!.id, startX: e.clientX, startDur: seg.dur, pxPerSecond: zoomed ? pxPerSecond : el.getBoundingClientRect().width / total };
                  }}
                  onPointerMove={(e) => {
                    const drag = dragRef.current;
                    if (!drag || drag.sceneId !== seg.scene!.id) return;
                    const deltaSeconds = (e.clientX - drag.startX) / drag.pxPerSecond;
                    updateSlide(drag.sceneId, { dur: Math.max(MIN_DUR, drag.startDur + deltaSeconds) });
                  }}
                  onPointerUp={() => {
                    dragRef.current = null;
                  }}
                />
              </div>
            );
          })}
          <div
            className="pointer-events-none absolute -top-1 -bottom-1 w-0.5 rounded-sm bg-white shadow-[0_0_10px_rgba(255,255,255,.7)] transition-[left] duration-100 ease-linear"
            style={{ left: zoomed ? t * pxPerSecond : total ? `calc(${(t / total) * 100}% - 1px)` : '0' }}
          >
            <span className="absolute -top-1.5 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-white" />
          </div>
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
