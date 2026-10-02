import { ensureProjectFonts } from '../fonts';
import type { AssetMap, Project } from '../types';
import { exportVideoMediaRecorder } from './mediaRecorderExporter';
import { outputDimensions } from './resolution';
import { supportsWebCodecsExport } from './support';
import { EXPORT_ABORT_ERROR_NAME, type ExportOptions, type ExportResult } from './types';
import { exportVideoWebCodecs } from './webcodecsExporter';

export * from './types';
export { exportVideoWebCodecs } from './webcodecsExporter';
export { ensureProjectFonts } from '../fonts';
export { exportVideoMediaRecorder } from './mediaRecorderExporter';
export { supportsWebCodecsExport } from './support';
export { outputDimensions, qualityToResolution, resolutionToQuality } from './resolution';
export { STORE_PRESETS, CUSTOM_SIZE_MIN, CUSTOM_SIZE_MAX, type StorePreset, type StorePresetId } from './storePresets';
export {
  analyzeLocale,
  analyzeStill,
  layoutFamily,
  renderStill,
  renderStillBlob,
  settledTime,
  slideStillDuration,
  stillTimeFor,
  type StillFileFormat,
  type StillIssue,
  type LocaleIssue,
} from './stills';

export interface ExportOutcome extends ExportResult {
  /** Set when the WebCodecs path wasn't used — either unsupported or it
   * failed unexpectedly and this fell back to the MediaRecorder path. */
  fallbackReason?: string;
}

function isAbortError(err: unknown): err is DOMException {
  return err instanceof DOMException && err.name === EXPORT_ABORT_ERROR_NAME;
}

/**
 * Exports the project to MP4, preferring the fast offline WebCodecs path
 * and only falling back to the real-time MediaRecorder path when this
 * browser can't do WebCodecs export (or the WebCodecs path fails
 * unexpectedly partway through).
 */
export async function exportVideo(
  project: Project,
  images: AssetMap,
  musicBuffer: AudioBuffer | null,
  options: ExportOptions,
  signal: AbortSignal,
  onProgress?: (framesRendered: number, totalFrames: number) => void,
): Promise<ExportOutcome> {
  const { width, height } = outputDimensions(project, options.resolution);
  const fps = options.fps ?? 30;
  await ensureProjectFonts(project);

  const webCodecsOk = await supportsWebCodecsExport({
    width,
    height,
    fps,
    needsAudio: !!musicBuffer,
    audioChannels: musicBuffer?.numberOfChannels,
    audioSampleRate: musicBuffer?.sampleRate,
  });

  if (!webCodecsOk) {
    const result = await exportVideoMediaRecorder(project, images, musicBuffer, options, signal, onProgress);
    return { ...result, fallbackReason: "This browser doesn't support WebCodecs export (H.264/AAC), so a real-time recording was used instead." };
  }

  try {
    return await exportVideoWebCodecs(project, images, musicBuffer, options, signal, onProgress);
  } catch (err) {
    if (isAbortError(err)) throw err;
    const message = err instanceof Error ? err.message : String(err);
    const result = await exportVideoMediaRecorder(project, images, musicBuffer, options, signal, onProgress);
    return { ...result, fallbackReason: `The fast export failed (${message}), so a real-time recording was used instead.` };
  }
}
