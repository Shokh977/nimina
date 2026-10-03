'use client';

import { useEffect, useRef, useState } from 'react';

import type { VideoSlide, VideoTap } from '@/engine/types';
import { useEditorStore } from '@/store/editorStore';
import { usePlayback } from '../PlaybackContext';
import { sceneStart } from '../timelineHelpers';
import RangeInput from '../ui/RangeInput';
import SectionLabel from '../ui/SectionLabel';
import ToggleRow from '../ui/ToggleRow';

const MIN_LEN = 0.5;

function mmss(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`;
}

type Drag = { part: 'start' | 'end' | 'cursor'; pointerId: number };

/**
 * The recording inside a video slide: a preview of the file you click to
 * mark taps (each one gets the auto-zoom and a ripple), and a bar with trim
 * handles that set which part of the file this slide plays — the slide's
 * length follows. Moving through the file here also moves the main stage
 * to the same moment.
 */
export default function VideoClipEditor({ slide }: { slide: VideoSlide }) {
  const project = useEditorStore((s) => s.project);
  const source = useEditorStore((s) => (slide.video.assetId ? s.assets.videos[slide.video.assetId] : undefined));
  const updateVideoClip = useEditorStore((s) => s.updateVideoClip);
  const { seek, playFrom } = usePlayback();
  const clip = slide.video;
  const [cursor, setCursor] = useState(clip.trimStart);
  const videoRef = useRef<HTMLVideoElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [source?.url]);
  const speed = project.motionSpeed / 100;
  const start = sceneStart(project, slide.id);
  const dur = clip.duration || 1;

  // Show the frame at the cursor here and on the stage.
  const showAt = (fileTime: number) => {
    const t = Math.max(0, Math.min(dur, fileTime));
    setCursor(t);
    if (videoRef.current && Math.abs(videoRef.current.currentTime - t) > 0.005) videoRef.current.currentTime = t;
    if (t >= clip.trimStart && t <= clip.trimEnd) seek(start + (t - clip.trimStart) / speed);
  };

  useEffect(() => {
    if (videoRef.current) videoRef.current.currentTime = cursor;
    // Only when the file changes — cursor moves go through showAt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source?.url]);

  const timeAt = (clientX: number) => {
    const r = barRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * dur;
  };

  const onBarDown = (e: React.PointerEvent) => {
    const part = ((e.target as HTMLElement).closest<HTMLElement>('[data-trim]')?.dataset.trim ?? 'cursor') as Drag['part'];
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ part, pointerId: e.pointerId });
    if (part === 'cursor') showAt(timeAt(e.clientX));
  };
  const onBarMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const t = Math.round(timeAt(e.clientX) * 100) / 100;
    if (drag.part === 'start') {
      const s = Math.min(t, clip.trimEnd - MIN_LEN);
      updateVideoClip(slide.id, { trimStart: Math.max(0, s) });
      showAt(Math.max(0, s));
    } else if (drag.part === 'end') {
      const en = Math.max(t, clip.trimStart + MIN_LEN);
      updateVideoClip(slide.id, { trimEnd: Math.min(dur, en) });
      showAt(Math.min(dur, en) - 0.02);
    } else showAt(t);
  };

  const addTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const vw = clip.width || 9,
      vh = clip.height || 16;
    const k = Math.min(box.width / vw, box.height / vh);
    const w = vw * k,
      h = vh * k;
    const x = (e.clientX - box.left - (box.width - w) / 2) / w;
    const y = (e.clientY - box.top - (box.height - h) / 2) / h;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    const tap: VideoTap = { id: `tap-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, t: Math.round(cursor * 100) / 100, x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 };
    updateVideoClip(slide.id, { taps: [...clip.taps.filter((o) => Math.abs(o.t - tap.t) > 0.05), tap].sort((a, b) => a.t - b.t) });
  };
  const removeTap = (id: string) => updateVideoClip(slide.id, { taps: clip.taps.filter((t) => t.id !== id) });

  const pct = (t: number) => `${(t / dur) * 100}%`;
  // Taps near the cursor are drawn on the preview.
  const nearby = clip.taps.filter((t) => Math.abs(t.t - cursor) < 0.35);
  const vw = clip.width || 9,
    vh = clip.height || 16;

  if (!source) {
    return <div className="grid h-[180px] place-items-center rounded-xl bg-black/40 text-[12.5px] text-[#6d7484]">{clip.assetId ? 'Loading the recording…' : 'No recording'}</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      <div ref={boxRef} onClick={addTap} className="relative h-[280px] cursor-crosshair overflow-hidden rounded-xl bg-black/50" title="Click where you tapped to add a tap at this moment">
        <video ref={videoRef} src={source.url} muted playsInline preload="auto" className="pointer-events-none h-full w-full object-contain" />
        {box.w > 0 &&
          nearby.map((t) => {
            // Position inside the letterboxed picture.
            const k = Math.min(box.w / vw, box.h / vh);
            const left = (box.w - vw * k) / 2 + t.x * vw * k;
            const top = (box.h - vh * k) / 2 + t.y * vh * k;
            return <span key={t.id} style={{ left, top }} className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-white/30 shadow-[0_0_0_2px_rgba(0,0,0,.45)]" />;
          })}
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between text-[12px] text-[#9aa1af] tabular-nums">
          <span>
            {mmss(clip.trimStart)} – {mmss(clip.trimEnd)} · plays {(clip.trimEnd - clip.trimStart).toFixed(1)}s
          </span>
          <span>{mmss(cursor)}</span>
        </div>
        <div
          ref={barRef}
          role="slider"
          aria-label="Recording: drag the handles to trim, click to move through it"
          aria-valuemin={0}
          aria-valuemax={dur}
          aria-valuenow={Math.round(cursor * 10) / 10}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              e.preventDefault();
              showAt(cursor + (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 1 : 1 / 30));
            }
          }}
          onPointerDown={onBarDown}
          onPointerMove={onBarMove}
          onPointerUp={() => setDrag(null)}
          onPointerCancel={() => setDrag(null)}
          className="relative h-11 touch-none rounded-[10px] bg-white/[.06] select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]"
        >
          {/* Played part */}
          <div className="absolute inset-y-0 rounded-[8px] border-2 border-[#8b7dff] bg-[#5b4bff]/[.22]" style={{ left: pct(clip.trimStart), width: `${((clip.trimEnd - clip.trimStart) / dur) * 100}%` }} />
          {/* Taps */}
          {clip.taps.map((t) => (
            <span key={t.id} className="pointer-events-none absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" style={{ left: pct(t.t) }} />
          ))}
          {/* Trim handles */}
          {(['start', 'end'] as const).map((part) => (
            <span
              key={part}
              data-trim={part}
              title={part === 'start' ? 'Drag to trim the start' : 'Drag to trim the end'}
              className="absolute inset-y-0 z-10 flex w-4 -translate-x-1/2 cursor-ew-resize items-center justify-center"
              style={{ left: pct(part === 'start' ? clip.trimStart : clip.trimEnd) }}
            >
              <span className="h-7 w-[6px] rounded-full bg-white shadow-[0_0_0_2px_rgba(0,0,0,.35)]" />
            </span>
          ))}
          {/* Cursor */}
          <span className="pointer-events-none absolute -inset-y-1 z-20 w-0.5 -translate-x-1/2 bg-[#ffd166]" style={{ left: pct(cursor) }} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => playFrom(start)} className="shrink-0 rounded-[10px] whitespace-nowrap border border-white/[.12] bg-white/[.03] px-3 py-1.5 text-[12.5px] font-semibold text-[#c9cdd8] hover:bg-white/[.08]">
          ▶ Play slide
        </button>
        <p className="text-[12px] leading-snug text-[#767e8d]">Click the video where you tapped to add a tap at this moment.</p>
      </div>

      {clip.taps.length > 0 && (
        <div>
          <SectionLabel>Taps</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {clip.taps.map((t, i) => (
              <span key={t.id} className="flex items-center overflow-hidden rounded-full border border-white/[.12] text-[12px] text-[#c9cdd8] tabular-nums">
                <button type="button" onClick={() => showAt(t.t)} className="py-1 pr-1.5 pl-2.5 hover:bg-white/[.06]" title="Go to this tap">
                  {i + 1} · {mmss(t.t)}
                  {t.t < clip.trimStart || t.t > clip.trimEnd ? ' (trimmed)' : ''}
                </button>
                <button type="button" onClick={() => removeTap(t.id)} aria-label={`Remove tap ${i + 1}`} className="px-2 py-1 text-[#9aa1af] hover:bg-[#ff7a59]/[.12] hover:text-[#ff8f76]">
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2.5">
        <ToggleRow title="Zoom in on taps" sub="The phone pushes in toward each tap, then back out" checked={clip.autoZoom} onChange={(autoZoom) => updateVideoClip(slide.id, { autoZoom })} />
        <ToggleRow
          title="Recording sound"
          sub={source.hasAudio ? 'Play the recording’s own audio (music keeps playing)' : 'This recording has no sound'}
          checked={clip.sound && source.hasAudio}
          onChange={(sound) => source.hasAudio && updateVideoClip(slide.id, { sound })}
        />
        {clip.sound && source.hasAudio && <RangeInput min={0} max={1} step={0.05} value={clip.volume} onChange={(volume) => updateVideoClip(slide.id, { volume })} label="Recording volume" valueLabel={`${Math.round(clip.volume * 100)}%`} />}
      </div>
    </div>
  );
}
