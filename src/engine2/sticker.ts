/**
 * 'sticker' layer renderer — a single emoji/glyph stamped as large as the
 * layer's box, no card or background (that's 'ui-element'). Distinct from
 * texture.ts's `wrapEmojiRow`, which lays out several small emoji in a
 * row for a reaction bar — a sticker is one big emoji, its own layer.
 *
 * Only the emoji path lives here — an uploaded-PNG sticker (`imageSlotId`)
 * needs the `assets` map to resolve pixels, which this function doesn't
 * have; sceneBuilder.ts's buildLayerMesh checks for `imageSlotId` first
 * and cover-fits the real image directly (same helper 'screenshot'
 * content uses), falling back to this only when it's an emoji sticker.
 */
import type { StickerProps } from './types';

export function drawSticker(ctx: CanvasRenderingContext2D, w: number, h: number, props: StickerProps): void {
  if (!props.emoji) return;
  const size = Math.min(w, h) * 0.82;
  ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(props.emoji, w / 2, h / 2 + size * 0.04);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}
