/**
 * Story action coordinates are normalized 0-1 relative to the full
 * screenshot image (so a point still lands correctly on a tall, scrolled
 * screenshot). These resolve such a point/rect to actual on-screen pixels
 * within the device's screen box, reusing the same cover-fit + scroll
 * math as everywhere else in the engine (src/engine/devices.ts imgRect).
 */
import { imgRect } from '../devices';
import type { ImageAsset, Point, ScreenBox } from '../types';

export function screenPoint(x: number, y: number, img: ImageAsset, sb: ScreenBox, scroll: number): Point {
  const r = imgRect(img, sb, scroll);
  return { x: sb.x + r.x + x * r.w, y: sb.y + r.y + y * r.h };
}

export function screenRect(x: number, y: number, w: number, h: number, img: ImageAsset, sb: ScreenBox, scroll: number) {
  const r = imgRect(img, sb, scroll);
  return { x: sb.x + r.x + x * r.w, y: sb.y + r.y + y * r.h, w: w * r.w, h: h * r.h };
}
