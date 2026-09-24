/**
 * Procedural background-music generator — pure math over a sample buffer,
 * with zero imports so it can run identically in the browser and in a plain
 * Node script (see scripts/seed-music-library.ts, which seeds the curated
 * "music library" storage bucket from these definitions). Mirrors the
 * project's existing "procedural, no external assets" pattern (compare
 * src/dev/sampleProject.ts's makeSample() for procedurally-drawn
 * screenshots) — these are clearly-labeled placeholder tracks, not an
 * attempt at production-quality music, meant to prove the music-library
 * pipeline (storage, BPM metadata, looping, ducking, snap-to-beat) end to
 * end without any licensing risk.
 */

export interface MusicTrackDef {
  id: string;
  name: string;
  category: string;
  bpm: number;
  /** Loop length in 4/4 bars — the generated buffer loops seamlessly at
   * exactly `bars * 4 * (60 / bpm)` seconds. */
  bars: number;
}

export const MUSIC_TRACK_DEFS: MusicTrackDef[] = [
  { id: 'soft-pulse', name: 'Soft Pulse', category: 'Ambient', bpm: 72, bars: 4 },
  { id: 'upbeat-bounce', name: 'Upbeat Bounce', category: 'Energetic', bpm: 120, bars: 4 },
  { id: 'chill-groove', name: 'Chill Groove', category: 'Chill', bpm: 96, bars: 4 },
];

/* ---------- tiny DSP toolkit ---------- */

function seededNoise(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s / 2147483647) * 2 - 1;
  };
}

/** Linear attack, exponential-ish decay envelope, 0-1. */
function pluckEnvelope(u: number, attack: number, decay: number): number {
  if (u < attack) return u / attack;
  const d = (u - attack) / Math.max(0.0001, decay);
  return Math.max(0, Math.exp(-d * 5));
}

function sine(freq: number, t: number): number {
  return Math.sin(2 * Math.PI * freq * t);
}

/** A soft, slightly-detuned pad: three sine partials with a slow tremolo. */
function padSample(freq: number, t: number): number {
  return (sine(freq, t) + sine(freq * 1.005, t) * 0.6 + sine(freq * 2, t) * 0.15) * (0.75 + 0.25 * Math.sin(2 * Math.PI * 0.3 * t));
}

/** Synthesized kick: a pitch-swept low sine with a fast amplitude decay. */
function kickSample(u: number, sr: number, i: number): number {
  const env = pluckEnvelope(u, 0.002, 0.18);
  const freq = 120 * Math.exp(-u * 18) + 40;
  return Math.sin((2 * Math.PI * freq * i) / sr) * env;
}

/** Synthesized closed hat: filtered noise burst. */
function hatSample(u: number, noise: () => number, prevOut: { v: number }): number {
  const env = pluckEnvelope(u, 0.001, 0.03);
  const raw = noise();
  // one-pole highpass to keep it thin/bright rather than a low thud
  const filtered = raw - prevOut.v * 0.92;
  prevOut.v = raw;
  return filtered * env * 0.5;
}

/* ---------- track generators ---------- */

function generateSoftPulse(def: MusicTrackDef, sr: number): Float32Array {
  const beat = 60 / def.bpm;
  const seconds = def.bars * 4 * beat;
  const out = new Float32Array(Math.round(seconds * sr));
  const chord = [220, 277.18, 329.63, 440]; // A3 C#4 E4 A4 — Amaj-ish pad
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    let s = 0;
    for (const f of chord) s += padSample(f, t) * 0.16;
    out[i] = s;
  }
  return out;
}

function generateBeatTrack(def: MusicTrackDef, sr: number, bassNotes: number[]): Float32Array {
  const beat = 60 / def.bpm;
  const seconds = def.bars * 4 * beat;
  const out = new Float32Array(Math.round(seconds * sr));
  const noise = seededNoise(7);
  const hatFilterState = { v: 0 };
  const steps = def.bars * 4; // one step per beat
  const stepSamples = Math.round(beat * sr);

  for (let step = 0; step < steps; step++) {
    const stepStart = step * stepSamples;
    const isDownbeat = step % 4 === 0;
    const bassFreq = bassNotes[step % bassNotes.length];
    for (let i = 0; i < stepSamples && stepStart + i < out.length; i++) {
      const u = i / stepSamples;
      let s = 0;
      // kick on every downbeat, hat on every step
      if (isDownbeat) s += kickSample(u, sr, i) * 0.9;
      s += hatSample(u, noise, hatFilterState);
      // soft bass note under it all
      s += sine(bassFreq, i / sr) * pluckEnvelope(u, 0.01, 0.5) * 0.18;
      out[stepStart + i] += s;
    }
  }
  return out;
}

export function generateProceduralTrack(def: MusicTrackDef, sr = 44100): Float32Array {
  if (def.id === 'soft-pulse') return generateSoftPulse(def, sr);
  if (def.id === 'upbeat-bounce') return generateBeatTrack(def, sr, [110, 110, 146.83, 130.81]); // A2 A2 D3 C3
  if (def.id === 'chill-groove') return generateBeatTrack(def, sr, [98, 98, 87.31, 110]); // G2 G2 F2 A2
  return generateSoftPulse(def, sr);
}
