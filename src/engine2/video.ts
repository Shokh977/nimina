/**
 * 'video' layer renderer — decodes frames with WebCodecs via Mediabunny's
 * `Input`/`CanvasSink` (Prompt 7: "decode frames deterministically with
 * WebCodecs ... so export is frame-accurate"), not a native
 * HTMLVideoElement. `sink.getCanvas(sourceTime)` gives the exact decoded
 * frame at a given timestamp — no `currentTime`/`seeked`-event imprecision,
 * and (unlike the native-element version this replaces) preview and export
 * now use the literal same code path, so preview is frame-accurate too,
 * not just approximately in sync.
 *
 * Trim/speed/freeze (Prompt 7) all reduce to one function, `sourceTimeFor`,
 * mapping the layer's local scene time to a timestamp in the *source*
 * file — trim narrows the window that loops, speed scales how fast local
 * time crosses it, freeze pins it to one constant timestamp.
 */
import { ALL_FORMATS, CanvasSink, Input, UrlSource, type InputVideoTrack } from 'mediabunny';
import * as THREE from 'three';

import { makeCanvas, textureFromCanvas } from './texture';
import type { VideoProps } from './types';

export interface VideoLayer {
  texture: THREE.CanvasTexture;
  /** Resolves once the source is probed and the first frame decoded —
   * export must await every layer's `ready` before capturing any frame. */
  ready: Promise<void>;
  /** No-op here (kept so sceneBuilder.ts's dispatch is uniform across
   * content kinds) — there's no native playback clock to start/stop
   * anymore; every frame, preview or export, is an explicit `seekTo`. */
  setPreviewPlaying(playing: boolean): void;
  seekTo(localT: number): Promise<void>;
  dispose(): void;
}

function sourceTimeFor(localT: number, trimStart: number, trimEnd: number, speed: number, freezeAt: number | undefined): number {
  if (freezeAt !== undefined) return freezeAt;
  const span = Math.max(1 / 60, trimEnd - trimStart);
  let scaled = (localT * speed) % span;
  if (scaled < 0) scaled += span;
  return trimStart + scaled;
}

/** `targetWidth`/`targetHeight` are the layer's own declared pixel size
 * (LayerDef.width/height) — CanvasSink decodes directly to that fixed
 * size (`fit: 'cover'`, so aspect mismatches crop instead of stretching),
 * so the backing canvas is allocated once and never resized. Resizing a
 * live `<canvas>` underneath an existing THREE.CanvasTexture turns out to
 * corrupt the GPU-side upload (a real bug caught while verifying this:
 * Chrome logs `texImage3D`/`texSubImage2D` WebGL errors and the texture
 * stops updating) — allocating at a fixed size from the start avoids the
 * resize entirely rather than working around it. */
export function createVideoLayer(props: VideoProps, targetWidth: number, targetHeight: number): VideoLayer {
  const { canvas, ctx } = makeCanvas(targetWidth, targetHeight);
  const texture = textureFromCanvas(canvas);

  let input: Input<UrlSource> | null = null;
  let sink: CanvasSink | null = null;
  let sourceDuration = 0;
  let disposed = false;
  // requestSeq lets a newer seekTo() discard an older one that's still
  // decoding when it finally resolves — under load (many video layers,
  // decode slower than the preview frame rate) this drops stale frames
  // instead of the texture visibly lagging behind, and export never hits
  // it since it always awaits each call before starting the next.
  let requestSeq = 0;
  // The preview render loop calls update()/seekTo() unconditionally every
  // rAF tick (~60/s) even while the playhead is stationary. Decoding a
  // frame isn't instant, so without this guard every tick fires a fresh
  // getCanvas() call that immediately outraces (and via requestSeq,
  // discards) the previous one — the frame can starve forever if decode
  // latency exceeds one tick. Collapse repeat calls for the same target
  // onto the in-flight decode (or a no-op if it's already drawn) instead
  // of starting a redundant one; export's awaitFrame still gets a promise
  // that resolves only once the right frame is actually on screen.
  let lastDrawnTarget: number | null = null;
  let inFlight: { target: number; promise: Promise<void> } | null = null;

  let resolveReady!: () => void;
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });

  function draw(wrapped: { canvas: HTMLCanvasElement | OffscreenCanvas } | null): void {
    if (!wrapped) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(wrapped.canvas, 0, 0, canvas.width, canvas.height);
    texture.needsUpdate = true;
  }

  (async () => {
    try {
      const source = new UrlSource(props.src);
      input = new Input({ formats: ALL_FORMATS, source });
      const track: InputVideoTrack | null = await input.getPrimaryVideoTrack();
      if (!track || disposed) {
        resolveReady();
        return;
      }
      sourceDuration = await track.computeDuration();
      sink = new CanvasSink(track, { width: targetWidth, height: targetHeight, fit: 'cover' });
      const trimStart = props.trimStart ?? 0;
      const trimEnd = props.trimEnd ?? sourceDuration;
      const firstTarget = sourceTimeFor(0, trimStart, trimEnd, props.speed ?? 1, props.freezeAt);
      const first = await sink.getCanvas(firstTarget);
      if (!disposed) {
        if (first) lastDrawnTarget = firstTarget;
        draw(first);
      }
      resolveReady();
    } catch (err) {
      console.error('[engine2 video] failed to open source', props.src, err);
      resolveReady();
    }
  })();

  function setPreviewPlaying(): void {
    // Intentionally inert — see VideoLayer's doc comment.
  }

  function seekTo(localT: number): Promise<void> {
    if (!sink || disposed) return Promise.resolve();
    const trimStart = props.trimStart ?? 0;
    const trimEnd = props.trimEnd ?? sourceDuration;
    const target = sourceTimeFor(localT, trimStart, trimEnd, props.speed ?? 1, props.freezeAt);
    if (target === lastDrawnTarget) return Promise.resolve();
    if (inFlight && inFlight.target === target) return inFlight.promise;

    const myId = ++requestSeq;
    const promise = (async () => {
      // A malformed/non-seekable source file (e.g. a live MediaRecorder
      // capture with no Cues/seek index — confirmed via manual testing to
      // never resolve for a non-zero target) can leave getCanvas() pending
      // forever instead of rejecting. Bounded so one bad frame can't hang
      // export indefinitely; on timeout the previous frame just stays on
      // screen for this frame instead.
      const wrapped = await Promise.race([
        sink!.getCanvas(target),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
      ]).catch(() => null);
      if (inFlight?.target === target) inFlight = null;
      if (disposed || myId !== requestSeq) return;
      if (wrapped) lastDrawnTarget = target;
      draw(wrapped);
    })();
    inFlight = { target, promise };
    return promise;
  }

  function dispose(): void {
    disposed = true;
    input?.dispose();
    texture.dispose();
  }

  return { texture, ready, setPreviewPlaying, seekTo, dispose };
}
