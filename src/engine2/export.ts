/**
 * Offline video export for Engine v2 — same approach as the classic
 * engine's WebCodecs exporter (src/engine/export/webcodecsExporter.ts):
 * render every frame on a detached canvas, encode with VideoEncoder (via
 * Mediabunny's CanvasSource, which already reuses the app's existing MP4
 * muxing) and AudioEncoder, mux into MP4. Audio reuses the classic
 * engine's OfflineAudioContext mixdown (src/engine/audio/mix.ts) — Engine
 * v2 has no per-action SFX system yet, so this just loops/fades a single
 * music track, the same shape renderProjectAudio already supports with an
 * empty SFX event list.
 *
 * Motion blur ("High quality"): renders `subframes` samples per output
 * frame across a 180-degree shutter window (half the frame interval — the
 * cinematography-standard shutter angle, not the full frame) and averages
 * them. Averaging happens entirely on the GPU: each subframe's fully
 * composited (bloom/DOF/grain included) result is additively blended, at
 * weight 1/subframes, into a floating-point accumulation render target —
 * never read back to the CPU until the single final blit to the canvas
 * Mediabunny reads from. The first version of this did the accumulation by
 * reading every subframe back to a 2D canvas (`ctx.drawImage`), which forces
 * a GPU-CPU sync on every subframe; at 6 subframes that's 6x the sync cost
 * per output frame, which is what made it impractically slow. Preview
 * playback never calls this file at all, so it's unaffected either way.
 */
import { AudioBufferSource, BufferTarget, CanvasSource, Mp4OutputFormat, Output, Quality } from 'mediabunny';
import * as THREE from 'three';

import { renderProjectAudio } from '../engine/audio/mix';
import { DEFAULT_FORMAT, FORMAT_STAGE_DIMS } from './camera';
// Side-effect import — see registerAllContent.ts's doc comment. Export can
// run on a project whose editor session already registered everything via
// Stage2.tsx, but that's not guaranteed for every future caller of this
// function, so it doesn't rely on that.
import './registerAllContent';
import { buildEngineV2Scene } from './sceneBuilder';
import type { ImageAsset, SceneProjectV2 } from './types';

export type ExportV2Resolution = '720p' | '1080p' | '4k';

export interface ExportV2Options {
  resolution: ExportV2Resolution;
  /** Frames per second. Defaults to 30. */
  fps?: number;
  /** "High quality" motion blur toggle — off (the default) renders one
   * sample per frame, no accumulation pass at all. On, renders `subframeCount`
   * samples across a 180-degree shutter and averages them. */
  motionBlur?: boolean;
  /** Samples per frame when motionBlur is on. Defaults to 6. */
  subframeCount?: number;
  /** 0-1, defaults to 0.8 (Engine v2's SceneProjectV2 doesn't carry volume
   * itself yet — this is a caller-supplied mix setting, same default the
   * classic engine's Project.volume starts at). */
  musicVolume?: number;
  /** Infrastructure merge — free-plan watermark (see watermark.ts). Caller
   * derives this from the signed-in user's plan (editorV2Store's `plan`
   * field); never trusted from project data itself. */
  watermark?: boolean;
  /** Real user screenshots/sticker PNGs ('screenshot' and image-sticker
   * content, plus cutout's `sourceSlotId`), keyed by slot id — same shape
   * and purpose as EngineV2SceneOptions.assets. Caller passes
   * editorV2Store's `assets` field. Without this, every 'screenshot'/
   * image-sticker layer (and any device frame drawn around one — Tier 1
   * must-have #1) exports with no image at all, since the export canvas is
   * a fresh, detached renderer with no access to the editor's live state. */
  assets?: Record<string, ImageAsset>;
}

export interface ExportV2Result {
  blob: Blob;
  url: string;
  sizeBytes: number;
  seconds: number;
}

const SCALE: Record<ExportV2Resolution, number> = { '720p': 720 / 1080, '1080p': 1, '4k': 2160 / 1080 };
const VIDEO_BITRATE: Record<ExportV2Resolution, number> = { '720p': 6_000_000, '1080p': 12_000_000, '4k': 40_000_000 };
const AUDIO_BITRATE = 192_000;
/** 180-degree shutter: the exposure window is half the frame interval, not
 * the whole thing — the standard convention for natural-looking motion
 * blur (a full-frame-duration window produces noticeably more smear). */
const SHUTTER_FRACTION = 0.5;

const ACCUM_VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const ACCUM_FRAGMENT_SHADER = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uWeight;
void main() {
  gl_FragColor = vec4(texture2D(uTex, vUv).rgb * uWeight, 1.0);
}`;

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

export async function exportEngine2Video(
  project: SceneProjectV2,
  musicBuffer: AudioBuffer | null,
  options: ExportV2Options,
  signal: AbortSignal,
  onProgress?: (framesRendered: number, totalFrames: number) => void,
): Promise<ExportV2Result> {
  const stageDims = FORMAT_STAGE_DIMS[project.format ?? DEFAULT_FORMAT];
  const scale = SCALE[options.resolution];
  const width = Math.round((stageDims.w * scale) / 2) * 2;
  const height = Math.round((stageDims.h * scale) / 2) * 2;
  const fps = options.fps ?? 30;
  const motionBlur = options.motionBlur ?? false;
  const subframeCount = motionBlur ? Math.max(1, options.subframeCount ?? 6) : 1;

  const renderCanvas = document.createElement('canvas');
  renderCanvas.width = width;
  renderCanvas.height = height;
  const renderer = new THREE.WebGLRenderer({ canvas: renderCanvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  // previewPlayback: false — a video layer must stay paused, driven only by
  // this file's explicit per-(sub)frame seeks, so its own real-time clock
  // can't race them (see sceneBuilder.ts's EngineV2SceneOptions).
  const engineScene = buildEngineV2Scene(renderer, project, width, height, { previewPlayback: false, watermark: options.watermark, assets: options.assets });
  // Every exported frame must be deterministic — wait for every lottie/
  // video layer's first frame before capturing anything (see
  // EngineV2Scene.ready's doc comment).
  await engineScene.ready;
  // We drive the composer's output into an offscreen target ourselves
  // (below) rather than letting it blit to the screen every subframe.
  engineScene.setRenderToScreen(false);

  // GPU-side accumulation: a floating-point target (avoids 8-bit banding
  // across up to 6 summed samples) plus a tiny full-screen-quad scene that
  // additively blends each subframe into it at weight 1/subframeCount.
  const accumTarget = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType });
  const accumScene = new THREE.Scene();
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const accumMaterial = new THREE.ShaderMaterial({
    uniforms: { uTex: { value: null }, uWeight: { value: 1 } },
    vertexShader: ACCUM_VERTEX_SHADER,
    fragmentShader: ACCUM_FRAGMENT_SHADER,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    depthTest: false,
    depthWrite: false,
  });
  accumScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), accumMaterial));
  const resolveMaterial = new THREE.ShaderMaterial({
    uniforms: { uTex: { value: accumTarget.texture } },
    vertexShader: ACCUM_VERTEX_SHADER,
    fragmentShader: `precision highp float; varying vec2 vUv; uniform sampler2D uTex; void main() { gl_FragColor = texture2D(uTex, vUv); }`,
    depthTest: false,
    depthWrite: false,
  });
  const resolveScene = new THREE.Scene();
  resolveScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), resolveMaterial));

  const bufferTarget = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: bufferTarget });

  const videoSource = new CanvasSource(renderCanvas, { codec: 'avc', quality: new Quality({ bitrate: VIDEO_BITRATE[options.resolution] }) });
  output.addVideoTrack(videoSource, { frameRate: fps });

  let audioSource: AudioBufferSource | null = null;
  if (musicBuffer) {
    audioSource = new AudioBufferSource({ codec: 'aac', quality: new Quality({ bitrate: AUDIO_BITRATE }) });
    output.addAudioTrack(audioSource);
  }

  await output.start();

  const totalFrames = Math.max(1, Math.ceil(project.duration * fps));
  const frameDur = 1 / fps;
  const shutterDur = frameDur * SHUTTER_FRACTION;

  try {
    for (let i = 0; i < totalFrames; i++) {
      if (signal.aborted) throw new DOMException('Export canceled', 'AbortError');
      const frameStart = i / fps;

      if (subframeCount === 1) {
        // No motion blur: render straight to the canvas, no accumulation pass.
        engineScene.setRenderToScreen(true);
        const subT = Math.min(project.duration, frameStart);
        engineScene.update(subT);
        await engineScene.awaitFrame(subT);
        engineScene.render();
        engineScene.setRenderToScreen(false);
      } else {
        renderer.setRenderTarget(accumTarget);
        renderer.autoClear = true;
        renderer.clear();
        renderer.autoClear = false;
        for (let s = 0; s < subframeCount; s++) {
          const subT = Math.min(project.duration, frameStart + ((s + 0.5) / subframeCount) * shutterDur);
          engineScene.update(subT);
          await engineScene.awaitFrame(subT);
          engineScene.render(); // writes into the composer's offscreen buffer, GPU-side only
          accumMaterial.uniforms.uTex.value = engineScene.getComposedTexture();
          accumMaterial.uniforms.uWeight.value = 1 / subframeCount;
          renderer.setRenderTarget(accumTarget);
          renderer.render(accumScene, quadCamera);
        }
        renderer.autoClear = true;
        // Single blit of the averaged result to the visible canvas — this
        // is the only GPU->canvas step per output frame, motion blur or not.
        renderer.setRenderTarget(null);
        renderer.render(resolveScene, quadCamera);
      }

      await videoSource.add(i / fps, frameDur);
      onProgress?.(i + 1, totalFrames);
      await nextFrame();
    }
    videoSource.close();

    if (audioSource && musicBuffer) {
      if (signal.aborted) throw new DOMException('Export canceled', 'AbortError');
      const rendered = await renderProjectAudio({ totalSeconds: project.duration, musicBuffer, volume: options.musicVolume ?? 0.8, ducking: false, sfxEvents: [] });
      if (rendered) await audioSource.add(rendered);
      audioSource.close();
    }

    if (signal.aborted) throw new DOMException('Export canceled', 'AbortError');
    await output.finalize();
  } catch (err) {
    await output.cancel().catch(() => {});
    throw err;
  } finally {
    accumTarget.dispose();
    accumMaterial.dispose();
    resolveMaterial.dispose();
    engineScene.dispose();
  }

  const buffer = bufferTarget.buffer;
  if (!buffer) throw new Error('Export finished without producing a file.');
  const blob = new Blob([buffer], { type: 'video/mp4' });
  return { blob, url: URL.createObjectURL(blob), sizeBytes: blob.size, seconds: project.duration };
}
