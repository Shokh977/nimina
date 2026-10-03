import { videoSoundKey } from '@/engine/audio/clips';
import { loadVideoSource, type VideoSource } from '@/engine/export/videoPlayback';
import { useEditorStore } from '@/store/editorStore';
import { getAudioContext } from '../audio/audioContext';

/** Longest screen recording a video slide accepts. */
export const MAX_RECORDING_SECONDS = 60;

/**
 * Opens a recording for the editor: the player and frame canvas the engine
 * draws from (videoPlayback.ts), registered in the store — and, in the
 * background, its sound decoded into the audio buffers (under
 * videoSoundKey) so "Recording sound" can play it through the same mixer
 * as the music. Throws UnplayableVideoError with a user-facing message.
 */
export async function openRecording(assetId: string, blob: Blob): Promise<VideoSource> {
  const source = await loadVideoSource(blob);
  useEditorStore.getState().registerVideo(assetId, source);
  void decodeSound(assetId, source);
  return source;
}

async function decodeSound(assetId: string, source: VideoSource) {
  try {
    const buffer = await getAudioContext().decodeAudioData(await source.blob.arrayBuffer());
    if (buffer.duration <= 0) throw new Error('empty');
    useEditorStore.setState((s) => ({ assets: { ...s.assets, audio: { ...s.assets.audio, [videoSoundKey(assetId)]: buffer } } }));
  } catch {
    // No sound track (or one this browser can't decode) — the toggle says so.
    source.hasAudio = false;
    useEditorStore.setState((s) => ({ assets: { ...s.assets, videos: { ...s.assets.videos } } }));
  }
}
