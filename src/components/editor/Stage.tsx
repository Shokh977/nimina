'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { FORMATS } from '@/engine/constants';
import { getTimeline, resolveStyle } from '@/engine/render';
import { layout } from '@/engine/slides';
import type { ClassicSlide, Format } from '@/engine/types';
import { useEditorStore } from '@/store/editorStore';
import type { PlaybackEngine } from './usePlaybackEngine';

/** Per-ratio CSS-px caps for the canvas's *height* — the stage box is
 * measured (ResizeObserver), never guessed, so the filmstrip/transport
 * bar stay on screen at every viewport height. See the clamp/cap formula
 * below; do not substitute aspect-ratio+max-height, which reintroduces
 * overflow when the column is short. */
const HEIGHT_CAP: Record<Format, number> = { '9:16': 466, '1:1': 380, '16:9': 300 };
const ZOOM_STEPS = [50, 75, 100, 150, 200, 300] as const;
const FIT_ZOOM_INDEX = ZOOM_STEPS.indexOf(100);
const ZOOM_KEY = 'promo-studio:stage-zoom';

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
export default function Stage({ engine }: { engine: PlaybackEngine }) {
  const project = useEditorStore((s) => s.project);
  const updateSlide = useEditorStore((s) => s.updateSlide);
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
  const size = { width: Math.round((fitSize.width * zoomPercent) / 100), height: Math.round((fitSize.height * zoomPercent) / 100) };

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
  const L = layout(FORMATS[project.format].w, FORMATS[project.format].h, project.format, style?.textPos ?? 'top');
  const cssScale = size.width / FORMATS[project.format].w;
  const textLeft = (L.align === 'center' ? L.textX - L.textW / 2 : L.textX) * cssScale;
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
        className={`flex flex-1 items-center justify-center p-[20px_20px_4px] ${zoomPercent > 100 ? 'overflow-auto' : 'overflow-hidden'}`}
        style={{ background: 'radial-gradient(90% 70% at 50% 0%, rgba(91,75,255,.09), #08090c 70%)' }}
      >
        <div className="relative flex-none overflow-hidden rounded-[22px] border border-white/10 shadow-[0_40px_90px_rgba(0,0,0,.6)]" style={{ width: size.width, height: size.height }}>
          <canvas ref={canvasRef} className="block" />

        {slide && style && (
          <>
            <span className="absolute top-3 left-3 rounded-[7px] bg-[#08090c]/55 px-[9px] py-[5px] text-[11px] font-semibold text-[#f4f5f8] backdrop-blur-sm">{slide.headline ? stripStars(slide.headline).slice(0, 24) || 'Slide' : 'Slide'}</span>

            {editing === 'headline' ? (
              <textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}
                style={{ left: textLeft, top: headlineTop - 6, width: L.textW * cssScale, fontSize: L.hSize * cssScale, textAlign: L.align }}
                className="absolute resize-none rounded-[9px] border border-dashed border-white/75 bg-black/[.18] font-[family-name:var(--font-space-grotesk)] leading-[1.15] font-bold text-white outline-none"
                rows={2}
              />
            ) : (
              <button
                ref={headlineRef}
                onClick={() => startEdit('headline')}
                style={{ left: textLeft, top: headlineTop, width: L.textW * cssScale, fontSize: L.hSize * cssScale, textAlign: L.align }}
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
                style={{ left: textLeft, top: subTop - 4, width: L.textW * cssScale, fontSize: L.sSize * cssScale, textAlign: L.align }}
                className="absolute resize-none rounded-[9px] border border-dashed border-white/75 bg-black/[.18] leading-[1.45] text-white/90 outline-none"
                rows={2}
              />
            ) : (
              <button
                onClick={() => startEdit('sub')}
                style={{ left: textLeft, top: subTop, width: L.textW * cssScale, fontSize: L.sSize * cssScale, textAlign: L.align }}
                className="absolute rounded-[9px] border border-dashed border-transparent leading-[1.45] text-white/90 hover:border-white/40"
              >
                {slide.sub || ' '}
              </button>
            )}
          </>
        )}
        </div>
      </div>

      <div className="absolute right-3 bottom-3 flex items-center gap-0.5 rounded-[8px] border border-white/[.12] bg-[#0a0b10]/90 p-0.5 backdrop-blur-sm">
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
