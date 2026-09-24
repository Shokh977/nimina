/**
 * Live/offline sound-effect synthesis via Web Audio nodes. Every function
 * takes a `BaseAudioContext` (a live `AudioContext` for preview, or an
 * `OfflineAudioContext` for export mixdown — same node-scheduling API) plus
 * a destination node and an absolute context time to start at, and just
 * schedules oscillators/noise/envelopes — no return value, nothing to await.
 */
import type { SfxId } from './sfx';

function envelope(ctx: BaseAudioContext, t: number, attack: number, decay: number, peak = 0.5): GainNode {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.001, t + attack + decay);
  return gain;
}

function tone(ctx: BaseAudioContext, dest: AudioNode, t: number, freq: number, type: OscillatorType, attack: number, decay: number, peak = 0.5, freqEnd?: number): void {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t + attack + decay);
  const gain = envelope(ctx, t, attack, decay, peak);
  osc.connect(gain).connect(dest);
  osc.start(t);
  osc.stop(t + attack + decay + 0.05);
}

/** A short filtered-noise burst (clicks, whooshes, hats). */
function noiseBurst(ctx: BaseAudioContext, dest: AudioNode, t: number, duration: number, filterFreq: number, filterType: BiquadFilterType, peak = 0.4): void {
  const len = Math.max(1, Math.round(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = filterFreq;
  const gain = envelope(ctx, t, 0.002, duration, peak);
  src.connect(filter).connect(gain).connect(dest);
  src.start(t);
  src.stop(t + duration + 0.02);
}

export function playSfx(ctx: BaseAudioContext, dest: AudioNode, id: SfxId, t: number): void {
  switch (id) {
    case 'tap':
      tone(ctx, dest, t, 880, 'sine', 0.002, 0.08, 0.35);
      break;
    case 'longPress':
      tone(ctx, dest, t, 520, 'sine', 0.01, 0.35, 0.3);
      break;
    case 'swipe':
      noiseBurst(ctx, dest, t, 0.18, 2200, 'bandpass', 0.22);
      break;
    case 'type':
      tone(ctx, dest, t, 1400, 'square', 0.001, 0.03, 0.12);
      break;
    case 'highlight':
      tone(ctx, dest, t, 660, 'triangle', 0.005, 0.2, 0.25);
      break;
    case 'notification':
      tone(ctx, dest, t, 988, 'sine', 0.005, 0.12, 0.3);
      tone(ctx, dest, t + 0.1, 1318, 'sine', 0.005, 0.18, 0.28);
      break;
    case 'success':
      tone(ctx, dest, t, 784, 'sine', 0.005, 0.12, 0.3);
      tone(ctx, dest, t + 0.09, 987, 'sine', 0.005, 0.12, 0.3);
      tone(ctx, dest, t + 0.18, 1318, 'sine', 0.005, 0.28, 0.32);
      break;
    case 'launch':
      tone(ctx, dest, t, 220, 'sine', 0.01, 0.4, 0.3, 660);
      break;
    case 'loading':
      tone(ctx, dest, t, 440, 'sine', 0.02, 0.15, 0.15);
      break;
    case 'scroll':
      noiseBurst(ctx, dest, t, 0.3, 900, 'lowpass', 0.15);
      break;
    case 'iconRing':
      tone(ctx, dest, t, 1200, 'sine', 0.002, 0.1, 0.25);
      tone(ctx, dest, t + 0.12, 1200, 'sine', 0.002, 0.1, 0.2);
      break;
    case 'iconBounce':
      tone(ctx, dest, t, 300, 'sine', 0.005, 0.15, 0.28, 450);
      break;
    case 'iconPulse':
      tone(ctx, dest, t, 660, 'sine', 0.01, 0.25, 0.22);
      break;
    case 'iconPop':
      tone(ctx, dest, t, 500, 'triangle', 0.002, 0.1, 0.3, 900);
      break;
    case 'sprite':
      noiseBurst(ctx, dest, t, 0.4, 700, 'lowpass', 0.12);
      break;
    case 'none':
    default:
      break;
  }
}
