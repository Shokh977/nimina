'use client';

import { Mp3Encoder } from '@breezystack/lamejs';

/**
 * Admin music upload, in the browser: decodes an MP3/M4A/WAV, resamples to
 * 44.1 kHz stereo, measures waveform peaks, and encodes a 128 kbps MP3
 * (~1 MB per minute) — so every library file is small and the same format,
 * whatever was uploaded. Encoding runs in slices so the page stays
 * responsive; `onProgress` gets 0–1.
 */
const RATE = 44100;
const KBPS = 128;
const PEAKS = 160;

export interface PreparedTrack {
  mp3: Blob;
  duration: number;
  peaks: number[];
}

export async function prepareTrack(file: File, onProgress: (p: number) => void): Promise<PreparedTrack> {
  const ctx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(await file.arrayBuffer());
  } catch {
    throw new Error("That file couldn't be decoded — upload an MP3, M4A or WAV.");
  } finally {
    void ctx.close();
  }
  if (decoded.duration < 3) throw new Error('That track is shorter than 3 seconds.');

  // Resample to 44.1 kHz stereo.
  const offline = new OfflineAudioContext(2, Math.ceil(decoded.duration * RATE), RATE);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  const audio = await offline.startRendering();
  const left = audio.getChannelData(0),
    right = audio.getChannelData(1);

  const peaks = waveformPeaks(left, right, PEAKS);

  const encoder = new Mp3Encoder(2, RATE, KBPS);
  const parts: Uint8Array[] = [];
  const block = 1152;
  const l16 = new Int16Array(block),
    r16 = new Int16Array(block);
  for (let i = 0, n = 0; i < left.length; i += block, n++) {
    const len = Math.min(block, left.length - i);
    for (let k = 0; k < len; k++) {
      l16[k] = Math.max(-32768, Math.min(32767, left[i + k] * 32767));
      r16[k] = Math.max(-32768, Math.min(32767, right[i + k] * 32767));
    }
    const out = encoder.encodeBuffer(l16.subarray(0, len), r16.subarray(0, len));
    if (out.length) parts.push(new Uint8Array(out));
    if (n % 200 === 0) {
      onProgress(i / left.length);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  const tail = encoder.flush();
  if (tail.length) parts.push(new Uint8Array(tail));
  onProgress(1);
  return { mp3: new Blob(parts as BlobPart[], { type: 'audio/mpeg' }), duration: audio.duration, peaks };
}

/** Max absolute amplitude per bucket, normalized so the loudest is 1. */
export function waveformPeaks(left: Float32Array, right: Float32Array, buckets: number): number[] {
  const size = Math.max(1, Math.floor(left.length / buckets));
  const raw: number[] = [];
  for (let b = 0; b < buckets; b++) {
    let m = 0;
    for (let i = b * size, end = Math.min(left.length, (b + 1) * size); i < end; i += 4) m = Math.max(m, Math.abs(left[i]), Math.abs(right[i]));
    raw.push(m);
  }
  const top = Math.max(...raw, 1e-6);
  return raw.map((v) => Math.round((v / top) * 1000) / 1000);
}
