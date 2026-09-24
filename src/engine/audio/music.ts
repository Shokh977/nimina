/** Beat-grid and ducking helpers shared by the live preview and export mixdown. */
import type { SfxEvent } from './events';

/** Rounds `t` (seconds) to the nearest beat of a `bpm` grid, optionally
 * offset (e.g. if the music doesn't start exactly at project t=0). */
export function snapToBeat(t: number, bpm: number, offsetSec = 0): number {
  const beat = 60 / bpm;
  const n = Math.round((t - offsetSec) / beat);
  return offsetSec + n * beat;
}

const DUCK_AMOUNT = 0.45; // fraction of volume kept while ducked (lower = more ducking)
const DUCK_ATTACK = 0.03;
const DUCK_HOLD = 0.12;
const DUCK_RELEASE = 0.25;

/**
 * Schedules a dip-and-recover gain automation on `gain` around every event
 * time, so background music audibly makes room for each sound effect
 * instead of masking it. `baseVolume` is the music's own volume (already
 * user-set); ducking multiplies it down and back, it doesn't replace it.
 */
export function scheduleDucking(gain: GainNode, ctxTimeForProjectTime: (t: number) => number, events: SfxEvent[], baseVolume: number, from: number, to: number): void {
  for (const e of events) {
    if (e.time < from || e.time > to) continue;
    const at = ctxTimeForProjectTime(e.time);
    gain.gain.setValueAtTime(baseVolume, Math.max(0, at - 0.01));
    gain.gain.linearRampToValueAtTime(baseVolume * DUCK_AMOUNT, at + DUCK_ATTACK);
    gain.gain.setValueAtTime(baseVolume * DUCK_AMOUNT, at + DUCK_ATTACK + DUCK_HOLD);
    gain.gain.linearRampToValueAtTime(baseVolume, at + DUCK_ATTACK + DUCK_HOLD + DUCK_RELEASE);
  }
}
