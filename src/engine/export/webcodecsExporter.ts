/**
 * Offline, non-real-time MP4 export via WebCodecs + Mediabunny. Renders
 * frames on a detached canvas at a fixed 30fps using the engine's
 * render(t), as fast as encoding backpressure allows, encodes video with
 * VideoEncoder (H.264/AVC) and — if the project has music — audio with
 * AudioEncoder (AAC), and muxes both into an MP4 via Mediabunny's Output.
 */
import { AudioBufferSource, BufferTarget, CanvasSource, Mp4OutputFormat, Output, Quality } from 'mediabunny';

import { getSfxEvents, playableClips, renderProjectAudio, type AudioBuffers } from '../audio';
import { VideoFrameFeeder } from './videoFrames';
import { getTimeline, render } from '../render';
import type { AssetMap, Project } from '../types';
import { outputDimensions } from './resolution';
import { EXPORT_ABORT_ERROR_NAME, type ExportOptions, type ExportResult } from './types';

const VIDEO_BITRATE_BY_RESOLUTION: Record<ExportOptions['resolution'], number> = {
  '720p': 6_000_000,
  '1080p': 12_000_000,
  '4k': 40_000_000,
};
const AUDIO_BITRATE = 192_000;

function checkAbort(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException('Export canceled', EXPORT_ABORT_ERROR_NAME);
}

/** Yields to the event loop so progress updates can paint and the abort
 * signal can be observed promptly, without capping encode throughput below
 * what a rAF-per-frame cadence allows (rendering + encoding a frame is
 * almost always slower than one frame interval anyway). */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

export async function exportVideoWebCodecs(
  project: Project,
  images: AssetMap,
  audio: AudioBuffers,
  options: ExportOptions,
  signal: AbortSignal,
  onProgress?: (framesRendered: number, totalFrames: number) => void,
): Promise<ExportResult> {
  const { total, list } = getTimeline(project);
  if (!total) throw new Error('Add at least one slide before exporting.');

  const fps = options.fps ?? 30;
  const { width, height, scale } = outputDimensions(project, options.resolution);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create a 2D canvas context.');

  const bufferTarget = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: bufferTarget });

  const videoSource = new CanvasSource(canvas, {
    codec: 'avc',
    quality: new Quality({ bitrate: VIDEO_BITRATE_BY_RESOLUTION[options.resolution] }),
  });
  output.addVideoTrack(videoSource, { frameRate: fps });

  const sfxEvents = getSfxEvents(project);
  const hasAudio = playableClips(project, audio).length > 0 || sfxEvents.length > 0;
  let audioSource: AudioBufferSource | null = null;
  if (hasAudio) {
    audioSource = new AudioBufferSource({ codec: 'aac', quality: new Quality({ bitrate: AUDIO_BITRATE }) });
    output.addAudioTrack(audioSource);
  }

  await output.start();

  const totalFrames = Math.max(1, Math.ceil(total * fps));

  const videos = options.videos ?? {};
  const feeder = Object.keys(videos).length ? new VideoFrameFeeder(Object.fromEntries(Object.entries(videos).map(([id, v]) => [id, v.blob]))) : null;

  try {
    for (let i = 0; i < totalFrames; i++) {
      checkAbort(signal);
      const t = Math.min(i / fps, total);
      const frameAssets = feeder ? await feeder.assetsAt(project, list, images, t) : images;
      render(ctx, project, frameAssets, t, scale, { watermark: options.watermark });
      await videoSource.add(i / fps, 1 / fps);
      onProgress?.(i + 1, totalFrames);
      await nextFrame();
    }
    videoSource.close();

    if (audioSource) {
      checkAbort(signal);
      const rendered = await renderProjectAudio({ totalSeconds: total, project, buffers: audio, sfxEvents });
      if (rendered) await audioSource.add(rendered);
      audioSource.close();
    }

    checkAbort(signal);
    await output.finalize();
  } catch (err) {
    await output.cancel().catch(() => {});
    throw err;
  } finally {
    await feeder?.close();
  }

  const buffer = bufferTarget.buffer;
  if (!buffer) throw new Error('Export finished without producing a file.');
  const blob = new Blob([buffer], { type: 'video/mp4' });
  return {
    blob,
    url: URL.createObjectURL(blob),
    ext: 'mp4',
    sizeBytes: blob.size,
    seconds: total,
    method: 'webcodecs',
  };
}
