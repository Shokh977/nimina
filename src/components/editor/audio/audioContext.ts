let shared: AudioContext | null = null;

/** One AudioContext for decoding picked/uploaded music files in the editor. */
export function getAudioContext(): AudioContext {
  if (!shared) shared = new AudioContext();
  return shared;
}
