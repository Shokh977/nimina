/**
 * Full-frame overlays: vignette, film grain, story progress bars. Ported
 * from legacy/promo-studio.html's noise()/drawOverlays.
 */
import type { Project, ResolvedStyle, Segment } from './types';
import { clamp, rgba, rr } from './utils';

let noiseCv: HTMLCanvasElement | null = null;
function noise(): HTMLCanvasElement {
  if (noiseCv) return noiseCv;
  noiseCv = document.createElement('canvas');
  noiseCv.width = noiseCv.height = 160;
  const x = noiseCv.getContext('2d')!;
  const id = x.createImageData(160, 160);
  for (let i = 0; i < id.data.length; i += 4) {
    const v = Math.random() * 255;
    id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
    id.data[i + 3] = 255;
  }
  x.putImageData(id, 0, 0);
  return noiseCv;
}

/** Draws vignette/grain/story-bars for the currently active segment.
 * `style` is the resolved style of that segment (used for story bar color). */
export function drawOverlays(ctx: CanvasRenderingContext2D, t: number, W: number, H: number, list: Segment[], project: Project, style: ResolvedStyle): void {
  const c = style.colors;
  if (project.vignette) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.55);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  if (project.grain) {
    const f = Math.floor(t * 24),
      ox = (f * 53) % 160,
      oy = (f * 97) % 160;
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.globalCompositeOperation = 'overlay';
    ctx.translate(-ox, -oy);
    ctx.fillStyle = ctx.createPattern(noise(), 'repeat')!;
    ctx.fillRect(0, 0, W + 160, H + 160);
    ctx.restore();
  }
  if (project.storyBars && list.length) {
    const n = list.length,
      top = H * 0.028,
      pad = W * 0.04,
      gap = W * 0.008;
    const bw = (W - 2 * pad - gap * (n - 1)) / n,
      bh = Math.max(4, Math.min(W, H) * 0.0065);
    list.forEach((g, i) => {
      const x = pad + i * (bw + gap),
        p = clamp((t - g.start) / g.dur);
      rr(ctx, x, top, bw, bh, bh / 2);
      ctx.fillStyle = rgba(c.text, 0.3);
      ctx.fill();
      if (p > 0) {
        rr(ctx, x, top, Math.max(bh, bw * p), bh, bh / 2);
        ctx.fillStyle = rgba(c.text, 0.95);
        ctx.fill();
      }
    });
  }
}

// The Nimina mark, as a flat Path2D-able path — copied from
// public/brand/nimina-mark-path.json (source of truth; the pure-TS engine
// doesn't import from public/). Keep in sync if that file changes.
const MARK_PATH_D =
  'M30.5 3.84L71.41 34.93A1.5 1.5 0 0 1 72 36.12L72 71.32A1.5 1.5 0 0 1 69.59 72.51L32.82 44.56A3 3 0 0 0 28 46.95L28 72.7A14 14 0 0 1 14 86.7A14 14 0 0 1 0 72.7L0 18.96A19 19 0 0 1 30.5 3.84ZM91.64 2.46L126.77 25.88A11 11 0 0 1 126.77 44.19L80.44 75.07A3.5 3.5 0 0 1 75 72.16L75 11.36A10.7 10.7 0 0 1 91.64 2.46Z';
const MARK_W = 131.7;
const MARK_H = 86.7;

/** Free-plan watermark, drawn last (on top of everything) in the bottom-right
 * corner. Plan gating itself lives outside the engine (src/lib/plan.ts) —
 * this just draws when told to. The mark is drawn from vector path data via
 * Path2D (never rasterized from an SVG/image), so it stays crisp at 720p,
 * 1080p and 4K alike. Mark height is measured off the actual font metrics
 * (cap height), not a hardcoded ratio, so it visually matches the text's
 * capital letters at any font size. Layout math is a strict extension of
 * the old text-only pill: with markW+gap at 0 it reduces to exactly the
 * previous pixel layout. */
export function drawWatermark(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  const size = Math.min(W, H) * 0.028;
  const pad = size * 1.1;
  const gap = size * 0.5;
  ctx.save();
  ctx.font = `600 ${size}px Figtree, system-ui, sans-serif`;
  const text = 'Made with Nimina';
  const textWidth = ctx.measureText(text).width;
  const capHeight = ctx.measureText('M').actualBoundingBoxAscent || size * 0.72;
  const markScale = capHeight / MARK_H;
  const markWidth = MARK_W * markScale;
  const contentWidth = markWidth + gap + textWidth;

  const bx = W - pad,
    by = H - pad;
  const contentRight = bx - size * 0.35;
  const contentLeft = contentRight - contentWidth;

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  rr(ctx, contentLeft - size * 0.35, by - size * 1.5, contentWidth + size * 1.4, size * 1.9, size * 0.5);
  ctx.fill();

  ctx.save();
  ctx.translate(contentLeft, by - size * 0.3 - capHeight);
  ctx.scale(markScale, markScale);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fill(new Path2D(MARK_PATH_D), 'nonzero');
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, contentLeft + markWidth + gap, by - size * 0.3);
  ctx.restore();
}
