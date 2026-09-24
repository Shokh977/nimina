/**
 * Slide background: gradient wash + optional pattern overlay + optional
 * floating shapes. Ported from legacy/promo-studio.html's
 * drawBg/drawPattern/drawShapes.
 */
import type { ResolvedStyle } from './types';
import { rgba, seeded } from './utils';

interface Shape {
  x: number;
  y: number;
  s: number;
  kind: 'ring' | 'dot' | 'plus' | 'squig' | 'tri';
  rs: number;
  sp: number;
  ph: number;
  col: number;
}

/** Fixed set of 16 shape placements/kinds, generated once from a fixed seed
 * so the "floating shapes" background is deterministic across renders. */
const SHAPES: Shape[] = (() => {
  const r = seeded(42);
  const kinds: Shape['kind'][] = ['ring', 'dot', 'plus', 'squig', 'tri', 'ring', 'dot', 'plus'];
  return Array.from({ length: 16 }, (_, i) => ({
    x: r(),
    y: r(),
    s: 0.014 + r() * 0.028,
    kind: kinds[i % kinds.length],
    rs: (r() - 0.5) * 1.4,
    sp: 0.4 + r() * 0.9,
    ph: r() * 6.28,
    col: i % 3,
  }));
})();

export function drawBg(ctx: CanvasRenderingContext2D, t: number, W: number, H: number, style: ResolvedStyle): void {
  const c = style.colors,
    R = Math.hypot(W, H) / 2,
    ang = 1.1 + Math.sin(t * 0.25) * 0.25;
  const g = ctx.createLinearGradient(W / 2 - Math.cos(ang) * R, H / 2 - Math.sin(ang) * R, W / 2 + Math.cos(ang) * R, H / 2 + Math.sin(ang) * R);
  g.addColorStop(0, c.a);
  g.addColorStop(1, c.b);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const m = Math.max(W, H);
  const blobs: Array<[number, number, number, string, number, number]> = [
    [0.18, 0.22, 0.55, c.accent, 0.2, 0.31],
    [0.88, 0.68, 0.6, '#FFFFFF', 0.12, 0.23],
    [0.45, 1.0, 0.5, c.a, 0.4, 0.17],
  ];
  for (const [bx, by, br, col, al, sp] of blobs) {
    const x = W * bx + Math.cos(t * sp * 2) * m * 0.06,
      y = H * by + Math.sin(t * sp * 2.4) * m * 0.06,
      r = m * br;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, rgba(col, al));
    rg.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  }
  drawPattern(ctx, t, W, H, style);
  if (style.shapes) drawShapes(ctx, t, W, H, style);
}

export function drawPattern(ctx: CanvasRenderingContext2D, t: number, W: number, H: number, style: ResolvedStyle): void {
  const c = style.colors,
    m = Math.max(W, H),
    p = style.bgPattern;
  if (p === 'glow') return;
  ctx.save();
  if (p === 'grid') {
    const s = m * 0.055,
      off = (t * s * 0.25) % s;
    ctx.strokeStyle = rgba(c.text, 0.09);
    ctx.lineWidth = m * 0.0015;
    ctx.beginPath();
    for (let x = -s + off; x < W + s; x += s) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    for (let y = -s + off; y < H + s; y += s) {
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();
  } else if (p === 'dots') {
    const s = m * 0.04,
      r = m * 0.0028,
      off = (t * s * 0.3) % s;
    ctx.fillStyle = rgba(c.text, 0.16);
    ctx.beginPath();
    for (let x = -s + off; x < W + s; x += s) for (let y = -s + off; y < H + s; y += s) {
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    ctx.fill();
  } else if (p === 'rays') {
    const cx = W / 2,
      cy = H * 0.42,
      n = 16,
      rot = t * 0.07;
    ctx.fillStyle = 'rgba(255,255,255,0.065)';
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a0 = rot + (i * Math.PI * 2) / n;
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, m * 1.2, a0, a0 + Math.PI / n);
      ctx.closePath();
    }
    ctx.fill();
  } else if (p === 'waves') {
    for (let k = 0; k < 4; k++) {
      const base = H * (0.52 + k * 0.12),
        amp = m * 0.022,
        wl = W * 0.8,
        ph = t * (0.6 + k * 0.2) + k;
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W + 10; x += W / 40) ctx.lineTo(x, base + Math.sin((x / wl) * Math.PI * 2 + ph) * amp);
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fill();
    }
  }
  ctx.restore();
}

export function drawShapes(ctx: CanvasRenderingContext2D, t: number, W: number, H: number, style: ResolvedStyle): void {
  const c = style.colors,
    mn = Math.min(W, H);
  const cols = [rgba(c.accent, 0.85), rgba(c.text, 0.35), 'rgba(255,255,255,0.5)'];
  for (const s of SHAPES) {
    const y = (((s.y - t * 0.02 * s.sp) % 1) + 1) % 1;
    const X = (s.x + Math.sin(t * 0.5 * s.sp + s.ph) * 0.02) * W,
      Y = y * H * 1.1 - H * 0.05;
    const sz = s.s * mn * 1.6;
    ctx.save();
    ctx.translate(X, Y);
    ctx.rotate(t * s.rs + s.ph);
    ctx.strokeStyle = ctx.fillStyle = cols[s.col];
    ctx.lineWidth = sz * 0.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    if (s.kind === 'ring') {
      ctx.arc(0, 0, sz * 0.5, 0, Math.PI * 2);
      ctx.stroke();
    } else if (s.kind === 'dot') {
      ctx.arc(0, 0, sz * 0.32, 0, Math.PI * 2);
      ctx.fill();
    } else if (s.kind === 'plus') {
      ctx.moveTo(-sz / 2, 0);
      ctx.lineTo(sz / 2, 0);
      ctx.moveTo(0, -sz / 2);
      ctx.lineTo(0, sz / 2);
      ctx.stroke();
    } else if (s.kind === 'tri') {
      ctx.moveTo(0, -sz / 2);
      ctx.lineTo(sz / 2, sz / 2.4);
      ctx.lineTo(-sz / 2, sz / 2.4);
      ctx.closePath();
      ctx.stroke();
    } else {
      for (let i = 0; i <= 12; i++) {
        const px = -sz + (i * sz) / 6,
          py = Math.sin((i / 12) * Math.PI * 3) * sz * 0.25;
        if (i) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}
