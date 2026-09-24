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

/** Free-plan watermark, drawn last (on top of everything) in the bottom-right
 * corner. Plan gating itself lives outside the engine (src/lib/plan.ts) —
 * this just draws when told to. */
export function drawWatermark(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  const size = Math.min(W, H) * 0.028;
  const pad = size * 1.1;
  ctx.save();
  ctx.font = `600 ${size}px Figtree, system-ui, sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  const text = 'Made with Promo Studio';
  const metrics = ctx.measureText(text);
  const bx = W - pad,
    by = H - pad;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  rr(ctx, bx - metrics.width - size * 0.7, by - size * 1.5, metrics.width + size * 1.4, size * 1.9, size * 0.5);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText(text, bx - size * 0.35, by - size * 0.3);
  ctx.restore();
}
