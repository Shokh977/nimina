/**
 * 'lottie' layer renderer — plays a Lottie/Bodymovin JSON animation into an
 * offscreen canvas via lottie-web's canvas renderer, wrapped as a
 * CanvasTexture. `data` is always pre-parsed JSON baked into a template at
 * build time (never fetched mid-render — see LottieProps), so the only
 * async step is lottie-web's own animation setup (`DOMLoaded`); once that
 * resolves, `seekTo()` is fully synchronous (`goToAndStop(frame, true)`),
 * so playback stays a pure function of time like every other layer.
 */
import lottie, { type AnimationItem } from 'lottie-web';
import * as THREE from 'three';

import type { LottieProps } from './types';

export interface LottieLayer {
  texture: THREE.CanvasTexture;
  /** Resolves once the animation has parsed and rendered its first frame —
   * export must await every layer's `ready` before capturing any frame. */
  ready: Promise<void>;
  /** Deterministic seek — same t always shows the same frame. */
  seekTo(localT: number): void;
  dispose(): void;
}

export function createLottieLayer(props: LottieProps): LottieLayer {
  // lottie-web's canvas renderer creates its own internal <canvas> inside
  // this container; kept attached (off-screen, invisible) rather than
  // detached, since some of its internal sizing logic reads layout — and
  // that layout size is what it actually renders the canvas AT (confirmed
  // by testing: an earlier version of this container was sized 1x1px "just
  // to be invisible," which silently rendered every lottie layer's canvas
  // at 1x1 too — degenerate output, no crash, so nothing caught it). Sized
  // from the animation's own declared w/h so it renders at native
  // resolution; a size this file has no opinion on (any nonzero w/h) falls
  // back to a reasonable default rather than collapsing to nothing.
  const animSize = props.data as { w?: number; h?: number };
  const w = animSize.w && animSize.w > 0 ? animSize.w : 512;
  const h = animSize.h && animSize.h > 0 ? animSize.h : 512;
  const container = document.createElement('div');
  container.style.cssText = `position:fixed;left:-99999px;top:-99999px;width:${w}px;height:${h}px;overflow:hidden;pointer-events:none;`;
  document.body.appendChild(container);

  const anim: AnimationItem = lottie.loadAnimation({
    container,
    renderer: 'canvas',
    loop: props.loop ?? true,
    autoplay: false,
    animationData: props.data,
    rendererSettings: { canvas: { clearCanvas: true } } as never,
  });

  let resolveReady!: () => void;
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });
  anim.addEventListener('DOMLoaded', () => {
    anim.goToAndStop(0, true);
    resolveReady();
  });
  anim.addEventListener('data_failed', () => resolveReady());

  const internalCanvas = (): HTMLCanvasElement | null => container.querySelector('canvas');

  // A 1x1 placeholder texture until the internal canvas exists — swapped
  // for the real one the moment it's available (still before `ready`
  // resolves in practice, but harmless either way).
  const texture = new THREE.CanvasTexture(document.createElement('canvas'));
  texture.colorSpace = THREE.SRGBColorSpace;

  function attachRealCanvasIfNeeded(): void {
    const c = internalCanvas();
    if (c && texture.image !== c) {
      texture.image = c;
      texture.needsUpdate = true;
    }
  }
  ready.then(attachRealCanvasIfNeeded);

  function seekTo(localT: number): void {
    if (!anim.isLoaded) return;
    attachRealCanvasIfNeeded();
    const frame = THREE.MathUtils.clamp(localT * anim.frameRate, 0, anim.totalFrames - 1 || 0);
    anim.goToAndStop(frame, true);
    texture.needsUpdate = true;
  }

  function dispose(): void {
    anim.destroy();
    container.remove();
    texture.dispose();
  }

  return { texture, ready, seekTo, dispose };
}
