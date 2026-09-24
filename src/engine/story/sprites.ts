/**
 * Resolves a Sprite's position/rotation along its path at a given progress
 * (0-1) and draws it — either a user-uploaded image or a built-in vector
 * shape (src/engine/story/icons.ts).
 */
import type { AssetMap, ResolvedStyle, Sprite } from '../types';
import { imgH, imgW } from '../utils';
import { drawBuiltInSprite } from './icons';
import { evaluatePath, pathTangentAngle } from './paths';

/**
 * Draws `sprite` at path-progress `u` (0-1). `screen` is the on-screen
 * rect (in the same coordinate space `ctx` is currently drawing into) that
 * the sprite's normalized 0-1 path coordinates are relative to — the
 * device's screen box, matching every other story position field.
 */
export function drawSprite(ctx: CanvasRenderingContext2D, sprite: Sprite, u: number, screen: { x: number; y: number; w: number; h: number }, assets: AssetMap, style: ResolvedStyle): void {
  if (sprite.path.length === 0) return;
  const p = evaluatePath(sprite.path, u);
  const px = screen.x + p.x * screen.w;
  const py = screen.y + p.y * screen.h;
  const angle = sprite.rotateAlongPath ? pathTangentAngle(sprite.path, u) : 0;
  const size = sprite.size * Math.min(screen.w, screen.h);

  ctx.save();
  ctx.translate(px, py);
  if (sprite.rotateAlongPath) ctx.rotate(angle);
  ctx.shadowColor = 'rgba(0,0,0,.3)';
  ctx.shadowBlur = size * 0.25;
  ctx.shadowOffsetY = size * 0.08;

  if (sprite.source.kind === 'asset') {
    const asset = assets[sprite.source.assetId];
    if (asset) {
      const w = imgW(asset),
        h = imgH(asset);
      const scale = size / Math.max(w, h);
      ctx.drawImage(asset, (-w * scale) / 2, (-h * scale) / 2, w * scale, h * scale);
    }
  } else {
    drawBuiltInSprite(ctx, sprite.source.name, size, style.colors.accent);
  }
  ctx.restore();
}
