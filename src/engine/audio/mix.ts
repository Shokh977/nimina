/**
 * Offline audio mixdown for export — renders every audible timeline clip
 * (src/engine/audio/clips.ts: position, trim, loop, volume, fades, ducked
 * under sound effects) plus every scheduled SFX event into one
 * `AudioBuffer`, ready to hand to the video exporter's audio track. Used by
 * the WebCodecs exporter (which just needs the finished buffer) — the
 * MediaRecorder fallback instead builds an equivalent *live* graph (see
 * src/engine/export/mediaRecorderExporter.ts) since it can't render offline.
 */
import { playableClips, scheduleClip, type AudioBuffers } from './clips';
import { playSfx } from './synth';
import type { SfxEvent } from './events';
import type { Project } from '../types';

export interface MixOptions {
  totalSeconds: number;
  project: Project;
  buffers: AudioBuffers;
  sfxEvents: SfxEvent[];
}

export async function renderProjectAudio(opts: MixOptions): Promise<AudioBuffer | null> {
  const { totalSeconds, project, buffers, sfxEvents } = opts;
  const clips = playableClips(project, buffers);
  if (!clips.length && sfxEvents.length === 0) return null;

  const sampleRate = clips[0]?.buffer.sampleRate ?? 44100;
  const channels = Math.max(2, ...clips.map((c) => c.buffer.numberOfChannels));
  const length = Math.max(1, Math.ceil(totalSeconds * sampleRate));
  const ctx = new OfflineAudioContext(channels, length, sampleRate);

  const duckUnder = project.ducking ? sfxEvents : [];
  for (const { clip, buffer } of clips)
    scheduleClip(ctx, ctx.destination, clip, buffer, {
      total: totalSeconds,
      from: 0,
      at: (t) => t,
      duckUnder,
    });

  if (sfxEvents.length) {
    const sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.9;
    sfxGain.connect(ctx.destination);
    for (const e of sfxEvents) {
      if (e.time >= totalSeconds) continue;
      playSfx(ctx, sfxGain, e.id, e.time);
    }
  }

  return ctx.startRendering();
}
