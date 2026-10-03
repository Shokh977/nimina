'use client';

import dynamic from 'next/dynamic';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { FORMATS } from '@/engine/constants';
import { renderLocaleFor } from '@/engine/localization';
import { withTextLocale } from '@/engine/locales';
import { getTimeline, resolveStyle } from '@/engine/render';
import { layout } from '@/engine/slides';
import type { ClassicSlide, Format } from '@/engine/types';
import { useEditorStore } from '@/store/editorStore';
import type { PlaybackEngine } from './usePlaybackEngine';

// Multilingual projects only (loaded on demand, like the Languages tab).
const LanguageSwitcher = dynamic(() => import('./LanguageSwitcher'));

/** Per-ratio CSS-px caps for the canvas's *height* — the stage box is
 * measured (ResizeObserver), never guessed, so the filmstrip/transport
 * bar stay on screen at every viewport height. See the clamp/cap formula
 * below; do not substitute aspect-ratio+max-height, which reintroduces
 * overflow when the column is short. */
const HEIGHT_CAP: Record<Format, number> = { '9:16': 466, '1:1': 380, '16:9': 300 };
const ZOOM_STEPS = [50, 75, 100, 150, 200, 300] as const;
const FIT_ZOOM_INDEX = ZOOM_STEPS.indexOf(100);
const ZOOM_KEY = 'promo-studio:stage-zoom';
/** Touch (phone) zoom range — continuous, from pinching. Capped at 3× so the
 * re-rendered canvas stays within mobile browsers' canvas-memory limits. */
const TOUCH_ZOOM_MAX = 3;
const clampN = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function computeFitSize(format: Format, availableWidth: number, availableHeight: number): { width: number; height: number } {
  const ratio = FORMATS[format].w / FORMATS[format].h;
  let height = Math.max(120, Math.min(availableHeight, HEIGHT_CAP[format]));
  let width = height * ratio;
  if (width > availableWidth) {
    width = availableWidth;
    height = width / ratio;
  }
  return { width: Math.round(width), height: Math.round(height) };
}

function stripStars(s: string): string {
  return s.replace(/\*/g, '');
}

/** Renders `*word*` runs in the accent color, same convention the canvas's
 * own drawWords() uses — a best-effort visual match for the click-to-edit
 * overlay's read mode (not the canvas itself, which the render engine
 * still draws pixel-for-pixel). */
function HighlightedText({ text, accent }: { text: string; accent: string }) {
  const parts = text.split(/(\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('*') && part.endsWith('*') ? (
          <span key={i} style={{ color: accent }}>
            {part.slice(1, -1)}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

/** The canvas, ResizeObserver-measured to fit the stage box exactly, plus
 * a click-to-edit overlay for the headline/supporting line of whichever
 * slide is currently on screen (the segment under the playhead — selecting
 * a slide in the rail/filmstrip seeks the playhead there, so the two stay
 * in sync). Transport controls live in TransportBar, a sibling under this. */
export default function Stage({ engine, touch = false }: { engine: PlaybackEngine; touch?: boolean }) {
  const project = useEditorStore((s) => s.project);
  const updateSlide = useEditorStore((s) => s.updateSlide);
  const previewLocale = useEditorStore((s) => s.previewLocale);
  const { canvasRef, displayT, setDisplaySize, playing } = engine;

  const boxRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLButtonElement>(null);
  const [fitSize, setFitSize] = useState({ width: 260, height: 466 });
  const [zoomIndex, setZoomIndex] = useState(FIT_ZOOM_INDEX);
  const [editing, setEditing] = useState<'headline' | 'sub' | null>(null);
  const [draft, setDraft] = useState('');
  // Measured, not assumed — the headline can wrap to 2+ lines depending on
  // its own text, so the supporting-line overlay's position is derived
  // from the headline overlay's actual rendered height (a fixed
  // single-line offset would overlap a wrapped headline).
  const [headlineHeight, setHeadlineHeight] = useState(0);

  const zoomPercent = ZOOM_STEPS[zoomIndex];
  // Touch mode: continuous pinch zoom plus a pan offset, instead of the
  // desktop's zoom steps and scrollbars.
  const [touchZoom, setTouchZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const zoomFactor = touch ? touchZoom : zoomPercent / 100;
  const size = { width: Math.round(fitSize.width * zoomFactor), height: Math.round(fitSize.height * zoomFactor) };
  const frameRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ z0: number; pan0: { x: number; y: number }; mid0: { x: number; y: number }; dist0: number; live: { z: number; pan: { x: number; y: number } } } | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(ZOOM_KEY));
    const idx = ZOOM_STEPS.indexOf(stored as (typeof ZOOM_STEPS)[number]);
    // One-time client-only read (localStorage isn't available during SSR).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (idx >= 0) setZoomIndex(idx);
  }, []);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const compute = () => {
      const style = getComputedStyle(box);
      const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      setFitSize(computeFitSize(project.format, box.clientWidth - padX, box.clientHeight - padY));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(box);
    return () => ro.disconnect();
  }, [project.format]);

  useEffect(() => {
    setDisplaySize(size.width, size.height);
  }, [size.width, size.height, setDisplaySize]);

  const setZoom = (idx: number) => {
    const clamped = Math.max(0, Math.min(ZOOM_STEPS.length - 1, idx));
    setZoomIndex(clamped);
    window.localStorage.setItem(ZOOM_KEY, String(ZOOM_STEPS[clamped]));
  };

  const { list: segments } = getTimeline(project);
  let idx = segments.findIndex((g) => displayT >= g.start && displayT < g.start + g.dur);
  if (idx < 0) idx = segments.length - 1;
  const seg = segments[idx];
  const style = seg ? resolveStyle(project, seg.owner) : null;
  const slide: ClassicSlide | null = seg?.type === 'scene' && seg.scene && seg.scene.kind !== 'story' ? seg.scene : null;
  // The overlay edits the project's own (source-language) text in place,
  // so it's laid out in the source language — and hidden entirely while a
  // translation is previewed (the translation table edits those).
  const loc = project.localization;
  const sourceLocale = loc ? renderLocaleFor(loc, loc.source) : undefined;
  const previewingTranslation = !!loc && !!previewLocale && previewLocale !== loc.source;
  const L = withTextLocale(sourceLocale, () => layout(FORMATS[project.format].w, FORMATS[project.format].h, project.format, style?.textPos ?? 'top'));
  const cssScale = size.width / FORMATS[project.format].w;
  const textLeft = (L.align === 'center' ? L.textX - L.textW / 2 : L.align === 'right' ? L.textX - L.textW : L.textX) * cssScale;
  const textDir = sourceLocale?.dir ?? 'ltr';
  const headlineTop = (L.textY ?? FORMATS[project.format].h * 0.075) * cssScale;
  const minHeadlineGap = L.hSize * cssScale * 1.35;
  const subTop = headlineTop + Math.max(minHeadlineGap, headlineHeight + 6);

  useLayoutEffect(() => {
    // While actively editing the headline, the read-mode button (and its
    // ref) is unmounted — keep the last measured height instead of
    // collapsing to the single-line minimum, so the supporting-line
    // overlay doesn't jump up and overlap the 2-row textarea mid-edit.
    if (headlineRef.current) setHeadlineHeight(headlineRef.current.offsetHeight);
  }, [slide?.headline, editing, size.width, L.textW, L.hSize]);

  // ---- touch: two fingers pinch to zoom and drag to pan; one finger taps
  // (the tap-to-edit text below keeps working).
  const twoFingers = () => {
    const [a, b] = [...pointers.current.values()];
    return { mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) };
  };
  const clampPan = (p: { x: number; y: number }, z: number) => {
    const box = boxRef.current;
    if (!box) return p;
    const maxX = Math.max(0, (fitSize.width * z - box.clientWidth) / 2 + 24);
    const maxY = Math.max(0, (fitSize.height * z - box.clientHeight) / 2 + 24);
    return z <= 1.001 ? { x: 0, y: 0 } : { x: clampN(p.x, -maxX, maxX), y: clampN(p.y, -maxY, maxY) };
  };
  const onTouchPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const { mid, dist } = twoFingers();
      gesture.current = { z0: touchZoom, pan0: pan, mid0: mid, dist0: dist, live: { z: touchZoom, pan } };
      suppressClick.current = true;
      if (editing) commitEdit();
    }
  };
  const onTouchPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const box = boxRef.current;
    if (!g || pointers.current.size < 2 || !box) return;
    const { mid, dist } = twoFingers();
    const rect = box.getBoundingClientRect();
    const c = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const z = clampN((g.z0 * dist) / g.dist0, 1, TOUCH_ZOOM_MAX);
    // Keep the point that was under the fingers under the fingers.
    const px = (g.mid0.x - c.x - g.pan0.x) / g.z0;
    const py = (g.mid0.y - c.y - g.pan0.y) / g.z0;
    const p = clampPan({ x: mid.x - c.x - px * z, y: mid.y - c.y - py * z }, z);
    g.live = { z, pan: p };
    // Live: a CSS transform on the frame (cheap); the canvas re-renders
    // sharp at the new size when the fingers lift.
    if (frameRef.current) frameRef.current.style.transform = `translate(${p.x}px, ${p.y}px) scale(${z / touchZoom})`;
  };
  const onTouchPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (g && pointers.current.size < 2) {
      gesture.current = null;
      if (frameRef.current) frameRef.current.style.transform = `translate(${g.live.pan.x}px, ${g.live.pan.y}px)`;
      setTouchZoom(g.live.z);
      setPan(g.live.pan);
    }
    if (pointers.current.size === 0) setTimeout(() => (suppressClick.current = false), 0);
  };
  const resetTouchZoom = () => {
    if (frameRef.current) frameRef.current.style.transform = 'translate(0px, 0px)';
    setTouchZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const startEdit = (field: 'headline' | 'sub') => {
    if (!slide || playing) return;
    setDraft(field === 'headline' ? slide.headline : slide.sub);
    setEditing(field);
  };
  const commitEdit = () => {
    if (slide && editing) updateSlide(slide.id, { [editing]: draft });
    setEditing(null);
  };

  return (
    <div className="relative flex flex-1 flex-col min-h-0">
      <div
        ref={boxRef}
        className={`flex flex-1 items-center justify-center ${touch ? 'touch-none overflow-hidden p-2' : `p-[20px_20px_4px] ${zoomPercent > 100 ? 'overflow-auto' : 'overflow-hidden'}`}`}
        style={{ background: 'radial-gradient(90% 70% at 50% 0%, rgba(91,75,255,.09), #08090c 70%)' }}
        onPointerDown={touch ? onTouchPointerDown : undefined}
        onPointerMove={touch ? onTouchPointerMove : undefined}
        onPointerUp={touch ? onTouchPointerUp : undefined}
        onPointerCancel={touch ? onTouchPointerUp : undefined}
        onClickCapture={
          touch
            ? (e) => {
                if (suppressClick.current) {
                  e.stopPropagation();
                  e.preventDefault();
                }
              }
            : undefined
        }
      >
        <div
          ref={frameRef}
          data-touch-exempt
          className={`relative flex-none overflow-hidden border border-white/10 shadow-[0_40px_90px_rgba(0,0,0,.6)] ${touch ? 'rounded-[16px]' : 'rounded-[22px]'}`}
          style={{ width: size.width, height: size.height, transform: touch ? `translate(${pan.x}px, ${pan.y}px)` : undefined }}
        >
          <canvas ref={canvasRef} className="block" />
          {(project.localization?.languages.length ?? 0) > 1 && <LanguageSwitcher />}

        {slide && style && !previewingTranslation && (
          <>
            <span className="absolute top-3 left-3 rounded-[7px] bg-[#08090c]/55 px-[9px] py-[5px] text-[11px] font-semibold text-[#f4f5f8] backdrop-blur-sm">{slide.headline ? stripStars(slide.headline).slice(0, 24) || 'Slide' : 'Slide'}</span>

            {editing === 'headline' ? (
              <textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}
                style={{ left: textLeft, top: headlineTop - 6, width: L.textW * cssScale, fontSize: L.hSize * cssScale, textAlign: L.align, direction: textDir }}
                className="absolute resize-none rounded-[9px] border border-dashed border-white/75 bg-black/[.18] font-[family-name:var(--font-space-grotesk)] leading-[1.15] font-bold text-white outline-none"
                rows={2}
              />
            ) : (
              <button
                ref={headlineRef}
                onClick={() => startEdit('headline')}
                style={{ left: textLeft, top: headlineTop, width: L.textW * cssScale, fontSize: L.hSize * cssScale, textAlign: L.align, direction: textDir }}
                className="absolute rounded-[9px] border border-dashed border-transparent font-[family-name:var(--font-space-grotesk)] leading-[1.15] font-bold text-white hover:border-white/40"
              >
                <HighlightedText text={stripStars(slide.headline) ? slide.headline : ' '} accent={style.colors.accent} />
              </button>
            )}

            {editing === 'sub' ? (
              <textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}
                style={{ left: textLeft, top: subTop - 4, width: L.textW * cssScale, fontSize: L.sSize * cssScale, textAlign: L.align, direction: textDir }}
                className="absolute resize-none rounded-[9px] border border-dashed border-white/75 bg-black/[.18] leading-[1.45] text-white/90 outline-none"
                rows={2}
              />
            ) : (
              <button
                onClick={() => startEdit('sub')}
                style={{ left: textLeft, top: subTop, width: L.textW * cssScale, fontSize: L.sSize * cssScale, textAlign: L.align, direction: textDir }}
                className="absolute rounded-[9px] border border-dashed border-transparent leading-[1.45] text-white/90 hover:border-white/40"
              >
                {slide.sub || ' '}
              </button>
            )}
          </>
        )}
        </div>
      </div>

      {touch && (touchZoom > 1.001 || pan.x !== 0 || pan.y !== 0) && (
        <button
          type="button"
          onClick={resetTouchZoom}
          className="absolute right-3 bottom-3 min-h-11 rounded-[12px] border border-white/[.14] bg-[#0a0b10]/90 px-4 text-[13px] font-semibold text-[#f4f5f8] backdrop-blur-sm"
        >
          Fit · {Math.round(touchZoom * 100)}%
        </button>
      )}

      <div className={`absolute right-3 bottom-3 flex items-center gap-0.5 rounded-[8px] border border-white/[.12] bg-[#0a0b10]/90 p-0.5 backdrop-blur-sm ${touch ? 'hidden' : ''}`}>
        <button
          type="button"
          onClick={() => setZoom(zoomIndex - 1)}
          disabled={zoomIndex === 0}
          aria-label="Zoom stage out"
          className="grid h-6 w-6 place-items-center rounded-[6px] text-[13px] text-[#c9cdd8] transition-colors duration-[.16s] hover:bg-white/[.08] disabled:opacity-30"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => setZoom(FIT_ZOOM_INDEX)}
          aria-label="Reset stage zoom to fit"
          title="Fit"
          className="w-[34px] text-center text-[10.5px] font-semibold text-[#9aa1af] tabular-nums hover:text-[#f4f5f8]"
        >
          {zoomPercent}%
        </button>
        <button
          type="button"
          onClick={() => setZoom(zoomIndex + 1)}
          disabled={zoomIndex === ZOOM_STEPS.length - 1}
          aria-label="Zoom stage in"
          className="grid h-6 w-6 place-items-center rounded-[6px] text-[13px] text-[#c9cdd8] transition-colors duration-[.16s] hover:bg-white/[.08] disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}
