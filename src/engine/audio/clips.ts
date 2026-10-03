/**
 * Timeline audio: reading a project's tracks/clips, and scheduling one clip
 * onto any Web Audio context — the live preview's AudioContext, the
 * WebCodecs exporter's OfflineAudioContext and the MediaRecorder exporter's
 * live graph all go through scheduleClip(), so what you hear while editing
 * is what gets exported.
 */
import { scheduleDucking } from './music';
import type { SfxEvent } from './events';
import type { AudioClip, AudioTrack, Project } from '../types';

export const DEFAULT_MUSIC_VOLUME = 0.8;
/** The fade-out every project had before clips existed. */
export const DEFAULT_FADE_OUT = 1.2;

export function audioTracks(p: Project): AudioTrack[] {
  return p.audio?.tracks ?? [];
}

/** Every clip on an unmuted track. */
export function audibleClips(p: Project): AudioClip[] {
  return audioTracks(p).flatMap((t) => (t.muted ? [] : t.clips));
}

/** Every clip, muted or not — for loading their files. */
export function allAudioClips(p: Project): AudioClip[] {
  return audioTracks(p).flatMap((t) => t.clips);
}

/** The (single, for now) music clip the editor works with. */
export function musicClip(p: Project): AudioClip | null {
  return audioTracks(p).find((t) => t.kind === 'music')?.clips[0] ?? null;
}

export function findClip(p: Project, clipId: string): AudioClip | null {
  return allAudioClips(p).find((c) => c.id === clipId) ?? null;
}

/** A new music clip with the long-standing defaults: from the top of the
 * video to its end, looping, faded out over the last 1.2 s. */
export function newMusicClip(id: string, assetId: string, name: string, bpm?: number, volume = DEFAULT_MUSIC_VOLUME): AudioClip {
  return {
    id,
    assetId,
    name,
    ...(bpm ? { bpm } : {}),
    start: 0,
    duration: null,
    sourceOffset: 0,
    loop: true,
    volume,
    fadeIn: 0,
    fadeOut: DEFAULT_FADE_OUT,
  };
}

/** Where the clip is actually audible on a timeline of `total` seconds.
 * Without loop it also stops when the file runs out (needs the file's
 * length; pass undefined while it's still loading). */
export function clipWindow(clip: AudioClip, total: number, bufferDuration?: number): { start: number; end: number } {
  const start = Math.max(0, Math.min(clip.start, total));
  let end = clip.duration === null ? total : Math.min(total, clip.start + clip.duration);
  if (!clip.loop && bufferDuration !== undefined) end = Math.min(end, clip.start + Math.max(0, bufferDuration - clip.sourceOffset));
  return { start, end: Math.max(start, end) };
}

/** Where in the file the clip is playing at timeline time `t` (inside its window). */
export function sourceTimeAt(clip: AudioClip, t: number, bufferDuration: number): number {
  const loopStart = clampOffset(clip.sourceOffset, bufferDuration);
  const pos = loopStart + (t - clip.start);
  if (!clip.loop || pos < bufferDuration) return pos;
  const span = bufferDuration - loopStart;
  return span > 0 ? loopStart + ((pos - loopStart) % span) : loopStart;
}

function clampOffset(offset: number, bufferDuration: number): number {
  return Math.max(0, Math.min(offset, Math.max(0, bufferDuration - 0.05)));
}

/** The clip's own gain at timeline time `t`: volume shaped by the fades. */
export function clipGainAt(clip: AudioClip, start: number, end: number, t: number): number {
  let k = 1;
  if (clip.fadeIn > 0) k = Math.min(k, (t - start) / clip.fadeIn);
  if (clip.fadeOut > 0) k = Math.min(k, (end - t) / clip.fadeOut);
  return clip.volume * Math.max(0, Math.min(1, k));
}

export interface ScheduleClipOptions {
  /** Timeline length of the video. */
  total: number;
  /** Timeline time playback starts from (0 for export, the playhead in preview). */
  from: number;
  /** Converts a timeline time to the context's clock. */
  at: (t: number) => number;
  /** Story SFX the music dips under (empty = no ducking). */
  duckUnder?: SfxEvent[];
}

/**
 * Schedules `clip` on `ctx` into `dest`, from timeline time `opts.from`
 * onward. Returns the source node (so the preview can stop it), or null if
 * the clip has nothing left to play.
 *
 * The gain is piecewise linear — volume, ramps for the fades — and ducking
 * runs on a second gain node, so the two automations never fight over one
 * parameter (the result is their product, as before clips existed).
 */
export function scheduleClip(ctx: BaseAudioContext, dest: AudioNode, clip: AudioClip, buffer: AudioBuffer, opts: ScheduleClipOptions): AudioBufferSourceNode | null {
  if (buffer.duration <= 0) return null;
  const { start, end } = clipWindow(clip, opts.total, buffer.duration);
  const begin = Math.max(start, opts.from);
  if (end - begin <= 0.001) return null;

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  if (clip.loop) {
    src.loop = true;
    src.loopStart = clampOffset(clip.sourceOffset, buffer.duration);
    src.loopEnd = buffer.duration;
  }
  const gain = ctx.createGain();
  const duck = ctx.createGain();
  src.connect(gain).connect(duck).connect(dest);

  // Envelope breakpoints: fade-in end, fade-out start, and where the two
  // ramps cross on a clip shorter than both fades.
  const g = gain.gain;
  g.setValueAtTime(clipGainAt(clip, start, end, begin), opts.at(begin));
  const points = [start + clip.fadeIn, end - clip.fadeOut, end];
  if (clip.fadeIn > 0 && clip.fadeOut > 0) points.push((start * clip.fadeOut + end * clip.fadeIn) / (clip.fadeIn + clip.fadeOut));
  for (const p of [...new Set(points)].filter((p) => p > begin && p <= end).sort((a, b) => a - b)) {
    g.linearRampToValueAtTime(clipGainAt(clip, start, end, p), opts.at(p));
  }

  if (opts.duckUnder?.length) {
    duck.gain.setValueAtTime(1, opts.at(begin));
    scheduleDucking(duck, opts.at, opts.duckUnder, 1, begin, end - clip.fadeOut);
  }

  src.start(opts.at(begin), sourceTimeAt(clip, begin, buffer.duration));
  src.stop(opts.at(end));
  return src;
}

/**
 * Converts the pre-timeline fields (`music`, `volume`) into a music track,
 * with exactly the old behaviour: from 0 to the end, looping, faded out
 * over the last 1.2 s. Projects already on tracks just lose the old fields.
 */
export function migrateLegacyAudio(p: Project): Project {
  if (!('music' in p) && !('volume' in p)) return p;
  const { music, volume, ...rest } = p;
  if (rest.audio || !music) return rest;
  return {
    ...rest,
    audio: {
      tracks: [
        {
          id: 'music',
          kind: 'music',
          clips: [newMusicClip('music-1', music.assetId, music.name, music.bpm, volume ?? DEFAULT_MUSIC_VOLUME)],
        },
      ],
    },
  };
}

/** Decoded audio files, keyed by clip.assetId. */
export type AudioBuffers = Record<string, AudioBuffer>;

/** The audible clips whose files are loaded, paired with their buffers. */
export function playableClips(p: Project, buffers: AudioBuffers): Array<{ clip: AudioClip; buffer: AudioBuffer }> {
  return audibleClips(p).flatMap((clip) => {
    const buffer = buffers[clip.assetId];
    return buffer && buffer.duration > 0 ? [{ clip, buffer }] : [];
  });
}
