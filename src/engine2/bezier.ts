/**
 * Cubic-bezier easing evaluation — the fixed-duration alternative to a
 * spring, for a KeyframeStep with `easing` set (see types.ts). Same
 * convention as CSS's `cubic-bezier()`: control points P1=(x1,y1),
 * P2=(x2,y2), with implicit P0=(0,0) and P3=(1,1). Solved by bisection on
 * the X component (simple and robust for any monotonic-in-x curve, which
 * x1/x2 in [0,1] guarantees) rather than a closed form, since a cubic
 * bezier's parameter isn't directly invertible.
 */
import type { CubicBezier } from './types';

function bezierComponent(t: number, p1: number, p2: number): number {
  const mt = 1 - t;
  return 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t;
}

/** `x` is normalized progress (0-1, already divided by the step's `dur`),
 * returns the eased 0-1 output. */
export function cubicBezier(x: number, [x1, y1, x2, y2]: CubicBezier): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let lo = 0,
    hi = 1,
    t = x;
  for (let i = 0; i < 24; i++) {
    const cx = bezierComponent(t, x1, x2);
    if (Math.abs(cx - x) < 1e-5) break;
    if (cx < x) lo = t;
    else hi = t;
    t = (lo + hi) / 2;
  }
  return bezierComponent(t, y1, y2);
}

/** Common named curves, offered alongside "custom" in the curve editor. */
export const BEZIER_PRESETS: Record<string, CubicBezier> = {
  linear: [0, 0, 1, 1],
  easeIn: [0.42, 0, 1, 1],
  easeOut: [0, 0, 0.58, 1],
  easeInOut: [0.42, 0, 0.58, 1],
};
