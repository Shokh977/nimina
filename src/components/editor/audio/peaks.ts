/** Waveform envelope of a decoded file for the timeline: the loudest sample
 * in each 1/PEAKS_PER_SECOND slice, normalised to 0–1. Cached per buffer. */
export const PEAKS_PER_SECOND = 50;

const cache = new WeakMap<AudioBuffer, Float32Array>();

export function bufferPeaks(buffer: AudioBuffer): Float32Array {
  const hit = cache.get(buffer);
  if (hit) return hit;
  const bins = Math.max(1, Math.ceil(buffer.duration * PEAKS_PER_SECOND));
  const size = Math.max(1, Math.floor(buffer.length / bins));
  const out = new Float32Array(bins);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let b = 0; b < bins; b++) {
      let m = out[b];
      const end = Math.min(data.length, (b + 1) * size);
      // Every 4th sample is plenty for a ~10px-tall drawing.
      for (let i = b * size; i < end; i += 4) {
        const v = Math.abs(data[i]);
        if (v > m) m = v;
      }
      out[b] = m;
    }
  }
  let top = 1e-6;
  for (const v of out) if (v > top) top = v;
  for (let b = 0; b < bins; b++) out[b] /= top;
  cache.set(buffer, out);
  return out;
}
