import type { VideoSource } from './videoPlayback';
/** Shared types for the video export pipeline (both the WebCodecs and
 * MediaRecorder-fallback implementations produce the same ExportResult). */

export type ExportResolution = '720p' | '1080p' | '4k';

export interface ExportOptions {
  resolution: ExportResolution;
  /** Frames per second for the WebCodecs path. Defaults to 30. Ignored by
   * the MediaRecorder fallback, which always records at 30fps in real time. */
  fps?: number;
  /** Free-plan watermark (see src/engine/overlays.ts drawWatermark). Plan
   * gating lives outside the engine — the caller decides this. */
  watermark?: boolean;
  /** Video slides' recordings, by asset id: the files for frame-accurate
   * decoding (WebCodecs path) and the live players (MediaRecorder path). */
  videos?: Record<string, VideoSource>;
}

export interface ExportResult {
  blob: Blob;
  /** Object URL for `blob`; caller is responsible for revoking it. */
  url: string;
  ext: 'mp4' | 'webm';
  sizeBytes: number;
  seconds: number;
  method: 'webcodecs' | 'mediarecorder';
}

/** Thrown (as a DOMException with this name) when an export is canceled mid-flight. */
export const EXPORT_ABORT_ERROR_NAME = 'AbortError';
