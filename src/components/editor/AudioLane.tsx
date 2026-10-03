'use client';

import { useEffect, useRef, useState } from 'react';

import { audioTracks, clipGainAt, clipWindow, sourceTimeAt } from '@/engine/audio/clips';
import type { AudioClip, Project, Segment } from '@/engine/types';
import { useEditorStore } from '@/store/editorStore';
import { bufferPeaks, PEAKS_PER_SECOND } from './audio/peaks';

export const AUDIO_LANE_H = 36;
const MIN_LEN = 0.5; // shortest clip, seconds
const SNAP_PX = 8;
const DRAG_THRESHOLD = 3;
const MAX_FADE = 10;

type Part = 'body' | 'left' | 'right' | 'fadeIn' | 'fadeOut';
interface Drag {
  part: Part;
  clipId: string;
  x0: number;
  clip0: AudioClip;
  start0: number;
  end0: number;
  moved: boolean;
}

function mmss(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`;
}
const round = (v: number, step = 0.05) => Math.round(v / step) * step;

/**
 * The audio row under the slides in the timeline, on the same time scale.
 * Each clip shows its waveform (shaped by its volume and fades) and is
 * edited in place:
 *  - drag the clip: slide the song inside it — which part of the song plays
 *  - drag its left/right edge: where the music starts/stops in the video
 *    (snaps to slide boundaries and the playhead; Alt = no snap)
 *  - drag the dots at its top corners: fade in / fade out
 *  - click: open its settings in the inspector; Delete removes it
 * With no audio the row is an "＋ Add music" button.
 */
export default function AudioLane({ project, total, pxPerSecond, segments, t }: { project: Project; total: number; pxPerSecond: number; segments: Segment[]; t: number }) {
  const buffers = useEditorStore((s) => s.assets.audio);
  const selection = useEditorStore((s) => s.audioSelection);
  const selectAudio = useEditorStore((s) => s.selectAudio);
  const updateAudioClip = useEditorStore((s) => s.updateAudioClip);
  const removeAudioClip = useEditorStore((s) => s.removeAudioClip);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);

  const clips = audioTracks(project).flatMap((tr) => tr.clips.map((c) => ({ clip: c, muted: !!tr.muted })));

  if (!clips.length) {
    return (
      <button
        type="button"
        data-audio-add
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => selectAudio('add')}
        className={`absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 rounded-[10px] border-2 border-dashed text-[12px] font-semibold transition-colors ${selection === 'add' ? 'border-[#8b7dff]/70 bg-[#5b4bff]/[.12] text-[#cfc8ff]' : 'border-white/[.12] text-[#9aa1af] hover:border-[#8b7dff]/50 hover:text-[#cfc8ff]'}`}
        style={{ height: AUDIO_LANE_H }}
      >
        ＋ Add music
      </button>
    );
  }

  const snapPoints = [0, total, t, ...segments.map((g) => g.start), ...segments.map((g) => g.start + g.dur)];
  const snap = (time: number, alt: boolean) => {
    if (alt || pxPerSecond <= 0) return time;
    let best = time;
    let bestPx = SNAP_PX;
    for (const p of snapPoints) {
      const d = Math.abs(p - time) * pxPerSecond;
      if (d < bestPx) {
        best = p;
        bestPx = d;
      }
    }
    return best;
  };

  const begin = (e: React.PointerEvent, part: Part, clip: AudioClip) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const w = clipWindow(clip, total, buffers[clip.assetId]?.duration);
    const d: Drag = {
      part,
      clipId: clip.id,
      x0: e.clientX,
      clip0: clip,
      start0: w.start,
      end0: w.end,
      moved: false,
    };
    dragRef.current = d;
    setDrag(d);
  };

  const move = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || pxPerSecond <= 0) return;
    e.stopPropagation();
    const dxPx = e.clientX - d.x0;
    if (!d.moved) {
      if (Math.abs(dxPx) < DRAG_THRESHOLD) return;
      d.moved = true;
      setDrag({ ...d });
    }
    const dt = dxPx / pxPerSecond;
    const c = d.clip0;
    const fileLen = buffers[c.assetId]?.duration;
    if (d.part === 'body') {
      // Dragging right brings earlier parts of the song into view.
      const maxOff = fileLen !== undefined ? Math.max(0, fileLen - 0.5) : Number.POSITIVE_INFINITY;
      updateAudioClip(c.id, {
        sourceOffset: Math.max(0, Math.min(maxOff, round(c.sourceOffset - dt))),
      });
    } else if (d.part === 'left') {
      const start = Math.max(0, Math.min(d.end0 - MIN_LEN, round(snap(d.start0 + dt, e.altKey))));
      // The audio under the clip stays put: trimming the front skips into the song.
      const sourceOffset = Math.max(0, round(c.sourceOffset + (start - d.start0)));
      updateAudioClip(c.id, {
        start,
        sourceOffset,
        ...(c.duration === null ? {} : { duration: round(d.end0 - start) }),
      });
    } else if (d.part === 'right') {
      let end = Math.max(d.start0 + MIN_LEN, Math.min(total, snap(d.end0 + dt, e.altKey)));
      if (!c.loop && fileLen !== undefined) end = Math.min(end, d.start0 + Math.max(MIN_LEN, fileLen - c.sourceOffset));
      // Back at the very end = "until the video ends", so it follows the video's length.
      updateAudioClip(c.id, {
        duration: end >= total - 0.05 ? null : round(end - c.start),
      });
    } else {
      const len = d.end0 - d.start0;
      const other = d.part === 'fadeIn' ? c.fadeOut : c.fadeIn;
      const raw = d.part === 'fadeIn' ? c.fadeIn + dt : c.fadeOut - dt;
      const v = Math.max(0, Math.min(MAX_FADE, len - other, round(raw, 0.1)));
      updateAudioClip(c.id, d.part === 'fadeIn' ? { fadeIn: v } : { fadeOut: v });
    }
  };

  const cancel = () => {
    dragRef.current = null;
    setDrag(null);
  };

  const end = (e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d) return;
    e.stopPropagation();
    if (!d.moved) selectAudio(d.clipId);
  };

  return (
    <>
      {clips.map(({ clip, muted }) => {
        const buffer = buffers[clip.assetId];
        const w = clipWindow(clip, total, buffer?.duration);
        const left = w.start * pxPerSecond;
        const width = Math.max(4, (w.end - w.start) * pxPerSecond);
        const selected = selection === clip.id;
        const active = drag?.clipId === clip.id && drag.moved ? drag : null;
        const tip =
          active?.part === 'body'
            ? `Song from ${mmss(clip.sourceOffset)}`
            : active?.part === 'left'
              ? `Starts ${mmss(w.start)}`
              : active?.part === 'right'
                ? clip.duration === null
                  ? 'To the end'
                  : `Ends ${mmss(w.end)}`
                : active?.part === 'fadeIn'
                  ? `Fade in ${clip.fadeIn.toFixed(1)}s`
                  : active?.part === 'fadeOut'
                    ? `Fade out ${clip.fadeOut.toFixed(1)}s`
                    : null;
        return (
          <div
            key={clip.id}
            role="button"
            tabIndex={0}
            data-audio-clip={clip.id}
            data-start={w.start.toFixed(3)}
            data-end={w.end.toFixed(3)}
            aria-label={`Music: ${clip.name}. Drag to choose which part of the song plays.`}
            aria-pressed={selected}
            title={clip.name}
            onPointerDown={(e) => begin(e, ((e.target as HTMLElement).closest<HTMLElement>('[data-audio-part]')?.dataset.audioPart as Part | undefined) ?? 'body', clip)}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={cancel}
            onKeyDown={(e) => {
              if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                e.stopPropagation();
                removeAudioClip(clip.id);
              } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectAudio(clip.id);
              }
            }}
            className={`absolute bottom-0 overflow-visible rounded-[9px] border-2 ${active?.part === 'body' ? 'cursor-grabbing' : 'cursor-grab'} ${selected ? 'border-[#8b7dff]' : 'border-[#2fb6a0]/50'} ${muted ? 'opacity-40' : ''} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#8b7dff]`}
            style={{
              left,
              width,
              height: AUDIO_LANE_H,
              background: selected ? 'rgba(47,182,160,.26)' : 'rgba(47,182,160,.16)',
            }}
          >
            <ClipWave clip={clip} buffer={buffer} start={w.start} end={w.end} pxPerSecond={pxPerSecond} width={width - 4} height={AUDIO_LANE_H - 4} />
            <span className="pointer-events-none absolute top-0.5 left-2 max-w-[calc(100%-16px)] truncate text-[10.5px] font-semibold text-white/90" style={{ textShadow: '0 1px 3px rgba(0,0,0,.6)' }}>
              ♪ {clip.name}
            </span>
            {/* Trim edges */}
            <span data-audio-part="left" title="Drag to change where the music starts" className="group absolute top-0 bottom-0 -left-0.5 flex w-2.5 cursor-ew-resize items-center justify-center">
              <span className="h-[55%] w-[3px] rounded-full bg-white/40 group-hover:bg-white/80" />
            </span>
            <span data-audio-part="right" title="Drag to change where the music stops" className="group absolute top-0 -right-0.5 bottom-0 flex w-2.5 cursor-ew-resize items-center justify-center">
              <span className="h-[55%] w-[3px] rounded-full bg-white/40 group-hover:bg-white/80" />
            </span>
            {/* Fade handles, at the end of each fade */}
            {(selected || active) && (
              <>
                <span
                  data-audio-part="fadeIn"

                  title="Drag to fade in"
                  className="absolute -top-[7px] z-10 grid h-3.5 w-3.5 -translate-x-1/2 cursor-ew-resize place-items-center"
                  style={{
                    left: Math.min(width - 10, 8 + clip.fadeIn * pxPerSecond),
                  }}
                >
                  <span className="h-2.5 w-2.5 rounded-full border-2 border-[#0a0b10] bg-white" />
                </span>
                <span
                  data-audio-part="fadeOut"

                  title="Drag to fade out"
                  className="absolute -top-[7px] z-10 grid h-3.5 w-3.5 translate-x-1/2 cursor-ew-resize place-items-center"
                  style={{
                    right: Math.min(width - 10, 8 + clip.fadeOut * pxPerSecond),
                  }}
                >
                  <span className="h-2.5 w-2.5 rounded-full border-2 border-[#0a0b10] bg-white" />
                </span>
              </>
            )}
            {tip && <span className="pointer-events-none absolute -top-6 left-1/2 z-30 -translate-x-1/2 rounded-[6px] bg-[#08090c] px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-white tabular-nums ring-1 ring-white/15">{tip}</span>}
          </div>
        );
      })}
    </>
  );
}

/** The clip's waveform: each pixel column shows the part of the file that
 * plays there (offset and looping included), scaled by the clip's gain so
 * the fades and volume are visible. */
function ClipWave({ clip, buffer, start, end, pxPerSecond, width, height }: { clip: AudioClip; buffer: AudioBuffer | undefined; start: number; end: number; pxPerSecond: number; width: number; height: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || width <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!buffer || pxPerSecond <= 0) return;
    const peaks = bufferPeaks(buffer);
    const mid = canvas.height / 2;
    ctx.fillStyle = 'rgba(160,240,226,.75)';
    const step = 2 * dpr;
    for (let x = 0; x < canvas.width; x += step) {
      const time = start + x / dpr / pxPerSecond;
      if (time > end) break;
      const src = sourceTimeAt(clip, time, buffer.duration);
      const peak = peaks[Math.min(peaks.length - 1, Math.floor(src * PEAKS_PER_SECOND))] ?? 0;
      // Shown against full volume, so a quiet clip looks quieter.
      const h = Math.max(dpr, peak * clipGainAt(clip, start, end, time) * (canvas.height - 4 * dpr));
      ctx.fillRect(x, mid - h / 2, Math.max(1, step - dpr), h);
    }
  }, [clip, buffer, start, end, pxPerSecond, width, height]);
  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute top-0.5 left-0.5" style={{ width, height }} />;
}
