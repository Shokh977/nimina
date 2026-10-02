/**
 * Small shared helpers used across the engine. Ported 1:1 from
 * legacy/promo-studio.html — pure functions, no framework/browser globals
 * beyond Canvas2D and (optionally) Intl.Segmenter.
 */
import { currentTextLocale } from './locales';
import type { ImageAsset } from './types';

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
export const easeInCubic = (x: number) => x * x * x;
export const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const easeOutBack = (x: number) => {
  const c1 = 1.70158,
    c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

export function hexRGB(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h,
    16,
  );
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexRGB(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export function shade(hex: string, amt: number): string {
  const f = (v: number) => Math.round(clamp(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt, 0, 255));
  return (
    '#' +
    hexRGB(hex)
      .map(f)
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  );
}

/** Builds a rounded-rect path on ctx (caller fills/strokes/clips it). */
export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** "background-size: cover" style fit of an iw x ih image into bw x bh, horizontally centered. */
export function cover(iw: number, ih: number, bw: number, bh: number) {
  const s = Math.max(bw / iw, bh / ih),
    w = iw * s,
    h = ih * s;
  return { x: (bw - w) / 2, y: 0, w, h };
}

export function imgW(img: ImageAsset): number {
  return 'naturalWidth' in img && img.naturalWidth ? img.naturalWidth : img.width;
}
export function imgH(img: ImageAsset): number {
  return 'naturalHeight' in img && img.naturalHeight ? img.naturalHeight : img.height;
}

/** Shared with Stage.tsx's DOM overlay (imported there as a CSS
 * font-family fallback list) so that if the project's chosen font fails
 * to load — slow network, blocked request, briefly on first paint — the
 * DOM overlay falls back to the exact same font the canvas does, instead
 * of each independently falling back to a different default and visibly
 * diverging. */
export const FONT_FALLBACK = 'Figtree, system-ui, sans-serif';

/** A ctx.font string: the project font, then (when rendering a non-Latin
 * language) that script's Noto font for the glyphs the project font lacks
 * (locales.ts), then the fallback chain. Unchanged for Latin projects. */
export const fontStr = (w: number, size: number, name: string) => {
  const script = currentTextLocale().scriptFamily;
  return `${w} ${size}px "${name}", ${script ? `"${script}", ` : ''}${FONT_FALLBACK}`;
};

export const slug = (s: string | null | undefined) =>
  (s || 'app')
    .replace(/\*/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'app';

/** Small deterministic PRNG (Park-Miller), used so effects/shapes look the
 * same on every render for a given seed instead of re-randomizing per frame. */
export function seeded(seed: number): () => number {
  let s = (Math.abs(seed | 0) * 9301 + 49297) % 2147483647 || 7;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export function graphemes(str: string): string[] {
  try {
    if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
      return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(str)].map((s) => s.segment);
    }
  } catch {
    // fall through to Array.from
  }
  return Array.from(str);
}
