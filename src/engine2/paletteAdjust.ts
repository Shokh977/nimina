/**
 * Applies a MotionStyle's `contrastBoost` to a resolved Palette — Bold's
 * "high contrast" and Calm's slightly desaturated "soft gradients" are the
 * same mechanism at opposite signs, not two different features.
 */
import type { Palette } from './palettes';
import type { MotionStyle } from './styles';

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Pushes each channel's distance from mid-gray outward (positive
 * `amount`, more contrast/punch) or inward (negative, softer/desaturated)
 * — a simple, fast contrast move, not a full color-management pipeline. */
function boost(hex: string, amount: number): string {
  if (amount === 0) return hex;
  const [r, g, b] = hexToRgb(hex);
  const mid = 127.5;
  const k = 1 + amount;
  return rgbToHex(mid + (r - mid) * k, mid + (g - mid) * k, mid + (b - mid) * k);
}

export function adjustPaletteForStyle(palette: Palette, style: MotionStyle): Palette {
  if (!style.contrastBoost) return palette;
  const amount = style.contrastBoost;
  return {
    ...palette,
    accent: boost(palette.accent, amount),
    ui: boost(palette.ui, amount),
    b: palette.b.map((c) => boost(c, amount)) as Palette['b'],
  };
}
