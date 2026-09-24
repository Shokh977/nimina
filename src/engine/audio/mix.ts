/**
 * Offline audio mixdown for export — renders background music (looped,
 * volume-controlled, faded out at the end, optionally ducked under sound
 * effects) plus every scheduled SFX event into one `AudioBuffer`, ready to
 * hand to the video exporter's audio track. Runs identically for the
 * WebCodecs exporter (which just needs the finished buffer) — the
 * MediaRecorder fallback instead builds an equivalent *live* graph (see
 * src/engine/export/mediaRecorderExporter.ts) since it can't render offline.
 */
import { scheduleDucking } from './music';
import { playSfx } from './synth';
import type { SfxEvent } from './events';

export interface MixOptions {
  totalSeconds: number;
  musicBuffer: AudioBuffer | null;
  volume: number;
  ducking: boolean;
  sfxEvents: SfxEvent[];
  fadeSeconds?: number;
}

export async function renderProjectAudio(opts: MixOptions): Promise<AudioBuffer | null> {
  const { totalSeconds, musicBuffer, volume, ducking, sfxEvents, fadeSeconds = 1.2 } = opts;
  if (!musicBuffer && sfxEvents.length === 0) return null;

  const sampleRate = musicBuffer?.sampleRate ?? 44100;
  const channels = musicBuffer?.numberOfChannels ?? 2;
  const length = Math.max(1, Math.ceil(totalSeconds * sampleRate));
  const ctx = new OfflineAudioContext(channels, length, sampleRate);

  if (musicBuffer) {
    const src = ctx.createBufferSource();
    src.buffer = musicBuffer;
    src.loop = true;
    const musicGain = ctx.createGain();
    src.connect(musicGain).connect(ctx.destination);
    src.start(0);

    const fadeStart = Math.max(0, totalSeconds - fadeSeconds);
    musicGain.gain.setValueAtTime(volume, 0);
    musicGain.gain.setValueAtTime(volume, fadeStart);
    musicGain.gain.linearRampToValueAtTime(0.0001, totalSeconds);
    if (ducking && sfxEvents.length) scheduleDucking(musicGain, (t) => t, sfxEvents, volume, 0, fadeStart);
  }

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
