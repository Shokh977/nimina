/**
 * Wraps a running UI kit element instance as a THREE.CanvasTexture —
 * redrawn every `update(t)` call, same "dynamic layer" shape
 * sceneBuilder.ts's lottie/video content kinds already use (see
 * src/engine2/lottie.ts), so wiring a UI kit element in as a LayerDef
 * content kind later is a small, familiar addition rather than a new
 * pattern. Framework-light on purpose — importing three here (not
 * react-three-fiber or similar) matches every other file in this engine.
 */
import * as THREE from 'three';

import { makeCanvas, textureFromCanvas } from '../texture';
import { getElement } from './registry';
import type { UIKitTheme } from './theme';
import type { AnyProps } from './types';

export interface UIElementTextureHandle {
  texture: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
  update(t: number): void;
  dispose(): void;
}

export function createUIElementTexture(elementId: string, props: AnyProps, theme: UIKitTheme, size?: { w: number; h: number }): UIElementTextureHandle {
  const def = getElement(elementId);
  if (!def) throw new Error(`Unknown UI kit element "${elementId}"`);
  const w = size?.w ?? def.naturalSize.w;
  const h = size?.h ?? def.naturalSize.h;
  const { canvas, ctx } = makeCanvas(w, h);
  const texture = textureFromCanvas(canvas);

  function update(t: number): void {
    ctx.clearRect(0, 0, w, h);
    def!.draw(ctx, w, h, t, props, theme);
    texture.needsUpdate = true;
  }
  update(0);

  function dispose(): void {
    texture.dispose();
  }

  return { texture, canvas, update, dispose };
}
