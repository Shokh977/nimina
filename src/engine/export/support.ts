import { canEncodeAudio, canEncodeVideo } from 'mediabunny';

/** Whether this browser can actually encode H.264/AAC via WebCodecs at the
 * requested size/rate — not just whether the VideoEncoder/AudioEncoder
 * globals exist. Firefox, for instance, has historically lacked
 * VideoEncoder entirely; some browsers have the globals but not AVC/AAC
 * support for a given configuration. */
export async function supportsWebCodecsExport(opts: {
  width: number;
  height: number;
  fps: number;
  needsAudio: boolean;
  audioChannels?: number;
  audioSampleRate?: number;
}): Promise<boolean> {
  if (typeof VideoEncoder === 'undefined' || typeof AudioEncoder === 'undefined') return false;

  const videoOk = await canEncodeVideo('avc', { width: opts.width, height: opts.height, frameRate: opts.fps }).catch(() => false);
  if (!videoOk) return false;

  if (opts.needsAudio) {
    const audioOk = await canEncodeAudio('aac', {
      numberOfChannels: opts.audioChannels ?? 2,
      sampleRate: opts.audioSampleRate ?? 44100,
    }).catch(() => false);
    if (!audioOk) return false;
  }

  return true;
}
