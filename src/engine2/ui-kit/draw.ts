/**
 * Small drawing/motion helpers shared across ui-kit/elements/*.ts — kept
 * here instead of duplicated per element. Builds on spring.ts and
 * texture.ts (roundRect etc.), nothing new conceptually, just glue.
 */
import { float, SP, spr, tr, type SpringParams } from '../spring';
import { roundRectPath } from '../texture';

/** MOTION_GUIDE.md's elevation shadow formula — blur/offset grow with `z`
 * (0-1), tinted (never pure black), opacity 0.12-0.28. */
export function elevationShadow(ctx: CanvasRenderingContext2D, z: number): void {
  ctx.shadowColor = `rgba(20,18,32,${0.12 + 0.16 * z})`;
  ctx.shadowBlur = 8 + z * 40;
  ctx.shadowOffsetY = 4 + z * 20;
}

export function clearShadow(ctx: CanvasRenderingContext2D): void {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

/** "Nothing is fully static" — 1-3px idle drift, 3-5s period. Every
 * resting element in this kit calls this for its own position. */
export function idleFloat(t: number, amp = 1.6, period = 4, phase = 0): number {
  return float(t, amp, period, phase);
}

/**
 * Anticipation + pop, as one spring-composited curve (MOTION_GUIDE.md:
 * "before a pop or tap, scale down 3-6% for 80-120ms... it's what makes a
 * tap feel like it landed"): rest at 1 before `at - lead`, squashes down to
 * `1-squash` approaching `at`, then springs past 1 and settles — a single
 * `tr()` call does the whole thing because spring steps are superposed
 * (the second step's spring starts from wherever the first has moved to,
 * not from a hard reset).
 */
export function anticipatePop(t: number, at: number, squash = 0.05, lead = 0.1, spring: SpringParams = SP.bouncy): number {
  return 1 + tr(t, 0, [
    [at - lead, -squash, SP.snappy],
    [at, 0, spring],
  ]);
}

/** 0→1 spring-in at `at`, held at 1 forever after (a plain entrance, no
 * anticipation) — the common case for "this thing appears". */
export function enterAt(t: number, at: number, spring: SpringParams = SP.bouncy): number {
  return spr(t - at, spring);
}

/** Deterministic per-index stagger delay (MOTION_GUIDE.md: 40-70ms between
 * siblings). */
export function stagger(index: number, ms = 55): number {
  return (index * ms) / 1000;
}

export function clipRounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.clip();
}

/** Per-corner radius rounded rect path (chat bubble's tail-side corner is
 * sharper than the other three) — caller fills/strokes/clips it. */
export function roundRectVariablePath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: [number, number, number, number]): void {
  ctx.beginPath();
  ctx.moveTo(x + r[0], y);
  ctx.lineTo(x + w - r[1], y);
  ctx.arcTo(x + w, y, x + w, y + r[1], r[1]);
  ctx.lineTo(x + w, y + h - r[2]);
  ctx.arcTo(x + w, y + h, x + w - r[2], y + h, r[2]);
  ctx.lineTo(x + r[3], y + h);
  ctx.arcTo(x, y + h, x, y + h - r[3], r[3]);
  ctx.lineTo(x, y + r[0]);
  ctx.arcTo(x, y, x + r[0], y, r[0]);
  ctx.closePath();
}

/** Substring of `text` visible at time `t` — chars appear at a steady rate
 * starting `at`, held complete afterward. Deterministic (a pure function of
 * t), so scrubbing/export sample it exactly like everything else here. */
export function typedText(t: number, text: string, at: number, charsPerSecond: number): string {
  const n = Math.max(0, Math.min(text.length, Math.floor((t - at) * charsPerSecond)));
  return text.slice(0, n);
}

/** Greedy word-wrap into lines no wider than `maxWidth` (ctx.font already
 * set by the caller) — shared by every element that lays out body copy. */
export function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 4): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let lo = 0,
    hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(text.slice(0, mid) + '…').width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo) + '…';
}

/** Mixes two hex colors — used for tint/shade one-offs (avatar rings,
 * skeleton shimmer bands) without pulling in a full color library. */
export function mixHex(a: string, b: string, t: number): string {
  const pa = hexToRgb(a),
    pb = hexToRgb(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t),
    g = Math.round(pa[1] + (pb[1] - pa[1]) * t),
    bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
