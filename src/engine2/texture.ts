/**
 * Screen/lift/free-floating layer *content* is drawn with Canvas2D (same
 * technique src/engine/ already uses for device chrome, gradients, text)
 * onto an offscreen canvas, then wrapped as a THREE.CanvasTexture and
 * mapped onto a plane — Three.js gives the 3D placement, lighting and
 * camera; Canvas2D gives the actual pixels. Shared drawing primitives live
 * here; per-template content builders live in templates/*.ts.
 */
import * as THREE from 'three';

export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string): void {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return { canvas, ctx };
}

/** Wraps a freshly-drawn canvas as a texture ready to map onto a plane —
 * `colorSpace` matches how the rest of the renderer's colors are managed
 * (sRGB), and `needsUpdate` is left true for callers that redraw the same
 * canvas on later frames (e.g. a live-updating counter or chart). */
export function textureFromCanvas(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function drawStatusBar(ctx: CanvasRenderingContext2D, w: number, color: string): void {
  ctx.fillStyle = color;
  ctx.font = '700 26px Figtree, system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('9:41', 52, 39);
  roundRect(ctx, w - 52 - 44, 28, 44, 21, 6, color);
  for (let i = 0; i < 4; i++) roundRect(ctx, w - 52 - 44 - 44 + i * 11, 58 - (i + 1) * 5 - 28, 7, (i + 1) * 5, 2, color);
  ctx.textBaseline = 'alphabetic';
}

/** A plain rounded card shadow-free base — most UI content in the
 * reference sits on one of these. */
export function drawCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill = '#FFFFFF'): void {
  roundRect(ctx, x, y, w, h, r, fill);
}

/** "background-size: cover" fit of an `iw x ih` image into `bw x bh`,
 * centered both axes (unlike the classic engine's utils.ts `cover()`,
 * which only centers horizontally — this one's for filling a fixed-size
 * layer box, not a scrollable device screen). */
export function coverFitDraw(ctx: CanvasRenderingContext2D, img: CanvasImageSource, iw: number, ih: number, bw: number, bh: number): void {
  const s = Math.max(bw / iw, bh / ih);
  const w = iw * s,
    h = ih * s;
  ctx.drawImage(img, (bw - w) / 2, (bh - h) / 2, w, h);
}

export function wrapEmojiRow(ctx: CanvasRenderingContext2D, emojis: string[], cx: number, cy: number, size: number, gap: number): void {
  const total = emojis.length * size + (emojis.length - 1) * gap;
  let x = cx - total / 2;
  ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const e of emojis) {
    ctx.fillText(e, x + size / 2, cy);
    x += size + gap;
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}
