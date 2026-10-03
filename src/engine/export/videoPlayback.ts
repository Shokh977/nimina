/**
 * Real-time video for the live preview (and the real-time MediaRecorder
 * export): one <video> element per screen recording, kept in step with the
 * timeline, its current frame copied into a canvas the engine draws as the
 * device screen. Frame-accurate export uses videoFrames.ts instead.
 *
 * The <video> is always muted: a recording's own sound, when turned on,
 * plays through the same Web Audio scheduling as the music
 * (src/engine/audio/clips.ts), so preview and export mix it identically.
 */
import { videoFrameAt } from '../video';
import type { AssetMap, Project, Segment } from '../types';

const MAX_SIDE = 1920;

export interface VideoSource {
  /** The file — kept for frame-accurate export decoding. */
  blob: Blob;
  /** Object URL of `blob`, playing in `el`. */
  url: string;
  el: HTMLVideoElement;
  /** The canvas the engine draws: `el`'s current frame copied in. */
  frame: HTMLCanvasElement;
  /** A still from the start of the file, for thumbnails. */
  poster: HTMLCanvasElement;
  duration: number;
  width: number;
  height: number;
  /** Whether the file has a sound track at all. */
  hasAudio: boolean;
  /** el.currentTime when `frame` was last filled (NaN = never). */
  copiedAt: number;
}

function canvasFor(w: number, h: number): HTMLCanvasElement {
  const k = Math.min(1, MAX_SIDE / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(2, Math.round(w * k));
  c.height = Math.max(2, Math.round(h * k));
  return c;
}

function once(el: HTMLVideoElement, ok: string, timeoutMs = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => done(new Error('timeout')), timeoutMs);
    const onOk = () => done();
    const onErr = () => done(new Error('error'));
    function done(err?: Error) {
      clearTimeout(timer);
      el.removeEventListener(ok, onOk);
      el.removeEventListener('error', onErr);
      if (err) reject(err);
      else resolve();
    }
    el.addEventListener(ok, onOk);
    el.addEventListener('error', onErr);
  });
}

/** Thrown when this browser can't play the file (e.g. HEVC on a PC without
 * the codec) — the message is shown to the user. */
export class UnplayableVideoError extends Error {}

/** Opens a recording: metadata, a first frame, and whether it has sound. */
export async function loadVideoSource(blob: Blob): Promise<VideoSource> {
  const url = URL.createObjectURL(blob);
  const el = document.createElement('video');
  el.muted = true;
  el.playsInline = true;
  el.preload = 'auto';
  el.src = url;
  try {
    await once(el, 'loadeddata');
  } catch {
    URL.revokeObjectURL(url);
    throw new UnplayableVideoError("This browser can't play that video. Export it as an H.264 MP4 and try again.");
  }
  const width = el.videoWidth,
    height = el.videoHeight;
  if (!width || !height) {
    URL.revokeObjectURL(url);
    throw new UnplayableVideoError("That file has no video picture we can read. Try an MP4 screen recording.");
  }
  const frame = canvasFor(width, height);
  const poster = canvasFor(width, height);
  // A frame a little in, past any black first frame.
  el.currentTime = Math.min(0.5, el.duration / 2);
  await once(el, 'seeked').catch(() => {});
  poster.getContext('2d')!.drawImage(el, 0, 0, poster.width, poster.height);
  frame.getContext('2d')!.drawImage(el, 0, 0, frame.width, frame.height);
  const anyEl = el as HTMLVideoElement & { mozHasAudio?: boolean; webkitAudioDecodedByteCount?: number; audioTracks?: { length: number } };
  const hasAudio = anyEl.mozHasAudio ?? (anyEl.audioTracks ? anyEl.audioTracks.length > 0 : true);
  return { blob, url, el, frame, poster, duration: el.duration, width, height, hasAudio, copiedAt: el.currentTime };
}

/** Separate players for the same files — so a real-time export doesn't
 * fight the live preview over one <video> element. */
export async function cloneVideoSources(videos: Record<string, VideoSource>): Promise<Record<string, VideoSource>> {
  const out: Record<string, VideoSource> = {};
  await Promise.all(
    Object.entries(videos).map(async ([id, v]) => {
      const el = document.createElement('video');
      el.muted = true;
      el.playsInline = true;
      el.preload = 'auto';
      el.src = v.url;
      await once(el, 'loadeddata').catch(() => {});
      out[id] = { ...v, el, frame: canvasFor(v.width, v.height), copiedAt: NaN };
    }),
  );
  return out;
}

/**
 * Keeps the <video> of the recording on screen at time `t` where the
 * timeline says it should be, pauses the others, and returns `images` with
 * that recording's frame added. Call once per drawn frame.
 */
export function syncVideos(project: Project, list: Segment[], videos: Record<string, VideoSource>, images: AssetMap, t: number, playing: boolean): AssetMap {
  const vf = videoFrameAt(project, list, t);
  const activeId = vf?.slide.video.assetId ?? null;
  for (const [id, v] of Object.entries(videos)) if (id !== activeId && !v.el.paused) v.el.pause();
  if (!vf || !activeId) return images;
  const v = videos[activeId];
  if (!v) return images;
  const el = v.el;
  const speed = project.motionSpeed / 100;
  if (playing) {
    const drift = vf.sourceTime - el.currentTime;
    if (el.paused) {
      el.playbackRate = speed;
      el.currentTime = vf.sourceTime;
      void el.play().catch(() => {});
    } else if (Math.abs(drift) > 0.3) {
      el.currentTime = vf.sourceTime;
    } else {
      // Small drift: catch up (or ease off) by nudging the speed, which
      // doesn't stutter the way a seek does.
      const rate = speed * (1 + Math.max(-0.2, Math.min(0.2, drift * 2)));
      if (Math.abs(el.playbackRate - rate) > 0.01) el.playbackRate = rate;
    }
  } else {
    if (!el.paused) el.pause();
    if (!el.seeking && Math.abs(el.currentTime - vf.sourceTime) > 0.01) el.currentTime = vf.sourceTime;
  }
  if (el.readyState >= 2 && !el.seeking && el.currentTime !== v.copiedAt) {
    v.frame.getContext('2d')!.drawImage(el, 0, 0, v.frame.width, v.frame.height);
    v.copiedAt = el.currentTime;
  }
  return { ...images, [activeId]: v.frame };
}

export function pauseVideos(videos: Record<string, VideoSource>): void {
  for (const v of Object.values(videos)) if (!v.el.paused) v.el.pause();
}
