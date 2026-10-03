/**
 * Video slides: a screen recording playing inside the device frame.
 *
 * The engine never touches a <video> element. The caller (live preview,
 * export) puts the frame for the right moment into the AssetMap under the
 * clip's asset id — a canvas — before calling render(); everything here is
 * pure time maths: which file time a slide shows at a given moment, and the
 * auto-zoom/tap-ripple state at that file time. Frames can therefore be
 * rendered in any order (frame-by-frame export).
 */
import { easeInOutCubic } from './utils';
import type { Point, Project, VideoClip, VideoSlide } from './types';

/** Auto-zoom timing around a tap, in file seconds. */
export const TAP_ZOOM = {
  /** Zoom-in starts this long before the tap… */
  lead: 0.45,
  /** …and is complete this long before it. */
  settle: 0.05,
  /** Stays zoomed this long after the last tap of a run… */
  hold: 0.7,
  /** …then zooms back out over this long. */
  out: 0.5,
  /** Taps closer together than this stay zoomed and pan between targets. */
  merge: 1.7,
  /** Zoom strength, as drawScene's spotlight `zp` (z = 1 + 1.25·zp → ~1.7×). */
  zp: 0.55,
  /** The ripple at the tap point lasts this long. */
  ripple: 0.6,
} as const;

/** A video clip's starting state for a file just added. */
export function newVideoClip(assetId: string, duration: number, width: number, height: number): VideoClip {
  return { assetId, duration, width, height, trimStart: 0, trimEnd: duration, taps: [], autoZoom: true, sound: false, volume: 1 };
}

/** The file time a video slide shows `local` seconds (output time) into
 * its segment. The recording plays at the project's Motion speed. */
export function videoSourceTime(slide: VideoSlide, local: number, speedFactor: number): number {
  const { trimStart, trimEnd } = slide.video;
  return Math.max(trimStart, Math.min(trimEnd - 1 / 120, trimStart + local * speedFactor));
}

/** Which recording is on screen at time `t`, and at which file time — the
 * frame the caller must provide before render(). Matches render()'s own
 * segment choice. */
export function videoFrameAt(project: Project, list: Array<{ start: number; dur: number; scene?: unknown }>, t: number): { slide: VideoSlide; sourceTime: number } | null {
  if (!list.length) return null;
  let idx = list.findIndex((g) => t >= g.start && t < g.start + g.dur);
  if (idx < 0) idx = list.length - 1;
  const seg = list[idx];
  const scene = seg.scene as { kind?: string } | undefined;
  if (!scene || scene.kind !== 'video') return null;
  const slide = scene as VideoSlide;
  if (!slide.video.assetId) return null;
  const local = Math.max(0, Math.min(t - seg.start, seg.dur - 0.0001));
  return { slide, sourceTime: videoSourceTime(slide, local, project.motionSpeed / 100) };
}

function sortedTaps(clip: VideoClip) {
  return [...clip.taps].sort((a, b) => a.t - b.t);
}

/** Zoom amount (drawScene `zp`) and focus point at file time `s`. Runs of
 * taps less than TAP_ZOOM.merge apart stay zoomed in and pan from one tap
 * to the next. Pure function of (clip, s). */
export function videoZoomAt(clip: VideoClip, s: number): { zp: number; focus: Point } {
  const taps = sortedTaps(clip);
  const none = { zp: 0, focus: taps[0] ? { x: taps[0].x, y: taps[0].y } : { x: 0.5, y: 0.5 } };
  if (!clip.autoZoom || !taps.length) return none;

  // Group into runs.
  const runs: (typeof taps)[] = [];
  for (const tap of taps) {
    const run = runs.at(-1);
    if (run && tap.t - run.at(-1)!.t < TAP_ZOOM.merge) run.push(tap);
    else runs.push([tap]);
  }

  let best = none;
  for (const run of runs) {
    const first = run[0];
    const last = run.at(-1)!;
    const inStart = first.t - TAP_ZOOM.lead;
    const inEnd = first.t - TAP_ZOOM.settle;
    const outStart = last.t + TAP_ZOOM.hold;
    const outEnd = outStart + TAP_ZOOM.out;
    if (s < inStart || s > outEnd) continue;
    let k = 1;
    if (s < inEnd) k = easeInOutCubic((s - inStart) / (inEnd - inStart));
    else if (s > outStart) k = 1 - easeInOutCubic((s - outStart) / (outEnd - outStart));
    // Focus: the latest tap reached, easing toward the next during its lead-in.
    let focus: Point = { x: first.x, y: first.y };
    for (let i = 1; i < run.length; i++) {
      const prev = run[i - 1];
      const next = run[i];
      const a = next.t - TAP_ZOOM.lead;
      const b = next.t - TAP_ZOOM.settle;
      if (s >= b) focus = { x: next.x, y: next.y };
      else if (s > a) {
        const p = easeInOutCubic((s - a) / (b - a));
        focus = { x: prev.x + (next.x - prev.x) * p, y: prev.y + (next.y - prev.y) * p };
        break;
      } else break;
    }
    const zp = TAP_ZOOM.zp * k;
    if (zp > best.zp) best = { zp, focus };
  }
  return best;
}

/** Tap ripples showing at file time `s`: position and progress 0→1. */
export function videoRipplesAt(clip: VideoClip, s: number): Array<{ x: number; y: number; p: number }> {
  return clip.taps.filter((tap) => s >= tap.t && s - tap.t < TAP_ZOOM.ripple).map((tap) => ({ x: tap.x, y: tap.y, p: (s - tap.t) / TAP_ZOOM.ripple }));
}
