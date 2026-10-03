/**
 * Real-time MediaRecorder export — the original approach from
 * legacy/promo-studio.html, kept as a fallback for browsers that can't do
 * WebCodecs export (see support.ts). Unlike the WebCodecs path, this plays
 * the whole video once in real time while recording, since MediaRecorder
 * has no offline/faster-than-real-time mode.
 */
import { getSfxEvents, playableClips, playSfx, scheduleClip, type AudioBuffers } from '../audio';
import { getTimeline, render } from '../render';
import type { AssetMap, Project } from '../types';
import { outputDimensions } from './resolution';
import { cloneVideoSources, pauseVideos, syncVideos } from './videoPlayback';
import { EXPORT_ABORT_ERROR_NAME, type ExportOptions, type ExportResult } from './types';

function pickMime(): string {
  const list = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  for (const m of list) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      // keep trying
    }
  }
  return '';
}

export async function exportVideoMediaRecorder(
  project: Project,
  images: AssetMap,
  audio: AudioBuffers,
  options: ExportOptions,
  signal: AbortSignal,
  onProgress?: (framesRendered: number, totalFrames: number) => void,
): Promise<ExportResult> {
  const { total, list } = getTimeline(project);
  if (!total) throw new Error('Add at least one slide before exporting.');
  if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) {
    throw new Error("This browser can't record video. Open the page in Chrome, Edge or Safari.");
  }
  try {
    await document.fonts.ready;
  } catch {
    // proceed regardless
  }

  const { width, height, scale } = outputDimensions(project, options.resolution);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create a 2D canvas context.');
  render(ctx, project, images, 0, scale, { watermark: options.watermark });

  const videos = options.videos && Object.keys(options.videos).length ? await cloneVideoSources(options.videos) : null;
  const stream = canvas.captureStream(30);
  const sfxEvents = getSfxEvents(project);
  const clips = playableClips(project, audio);
  const audioSrcs: AudioScheduledSourceNode[] = [];
  let audioCtx: AudioContext | null = null;
  if (clips.length || sfxEvents.length) {
    audioCtx = new AudioContext();
    await audioCtx.resume();
    const dest = audioCtx.createMediaStreamDestination();
    const now = audioCtx.currentTime;

    // A silent source for the whole video keeps the recorded audio track as
    // long as the video when the music stops before the end.
    const bed = audioCtx.createConstantSource();
    bed.offset.value = 0;
    bed.connect(dest);
    bed.start(now);
    bed.stop(now + total);
    audioSrcs.push(bed);

    const duckUnder = project.ducking ? sfxEvents : [];
    for (const { clip, buffer } of clips) {
      const src = scheduleClip(audioCtx, dest, clip, buffer, { total, from: 0, at: (t) => now + t, duckUnder });
      if (src) audioSrcs.push(src);
    }
    if (sfxEvents.length) {
      const sfxGain = audioCtx.createGain();
      sfxGain.gain.value = 0.9;
      sfxGain.connect(dest);
      for (const e of sfxEvents) {
        if (e.time >= total) continue;
        playSfx(audioCtx, sfxGain, e.id, now + e.time);
      }
    }
    dest.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
  }

  const mime = pickMime();
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: scale >= 1 ? 12e6 : 6e6 } : undefined);
  } catch {
    throw new Error("Recording couldn't start in this browser. Try Chrome, Edge or Safari.");
  }
  const ext: ExportResult['ext'] = (recorder.mimeType || mime).includes('mp4') ? 'mp4' : 'webm';
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size) chunks.push(ev.data);
  };

  const done = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });
  recorder.start(250);
  const t0 = performance.now();
  const totalFrames = Math.max(1, Math.ceil(total * 30));
  let canceled = false;

  await new Promise<void>((resolve) => {
    const step = (now: number) => {
      if (signal.aborted) {
        canceled = true;
        resolve();
        return;
      }
      const et = (now - t0) / 1000;
      const frameAssets = videos ? syncVideos(project, list, videos, images, Math.min(et, total), true) : images;
      render(ctx, project, frameAssets, Math.min(et, total), scale, { watermark: options.watermark });
      onProgress?.(Math.min(totalFrames, Math.round((et / total) * totalFrames)), totalFrames);
      if (et >= total + 0.15) {
        resolve();
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });

  recorder.stop();
  if (videos) pauseVideos(videos);
  for (const src of audioSrcs) {
    try {
      src.stop();
    } catch {
      // already stopped
    }
  }
  await done;
  stream.getTracks().forEach((t) => t.stop());
  await audioCtx?.close().catch(() => {});

  if (canceled) throw new DOMException('Export canceled', EXPORT_ABORT_ERROR_NAME);

  const blob = new Blob(chunks, { type: ext === 'mp4' ? 'video/mp4' : 'video/webm' });
  return {
    blob,
    url: URL.createObjectURL(blob),
    ext,
    sizeBytes: blob.size,
    seconds: total,
    method: 'mediarecorder',
  };
}
