/**
 * Per-slide burst effects (confetti/sparkles/stickers) and camera drift.
 * Ported from legacy/promo-studio.html's drawEffect/applyCamera.
 */
import type { Camera, ClassicSlide, EffectBox, ResolvedStyle } from './types';
import { clamp, easeInOutCubic, easeOutBack, graphemes, seeded } from './utils';

export function drawEffect(ctx: CanvasRenderingContext2D, scene: ClassicSlide, local: number, W: number, H: number, box: EffectBox, style: ResolvedStyle): void {
  const fx = scene.effect;
  if (!fx || fx === 'none') return;
  const m = Math.min(W, H);
  if (fx === 'confetti') {
    const tt = local - 0.8;
    if (tt < 0 || tt > 2.8) return;
    const r = seeded(scene.id * 131),
      cols = [style.colors.accent, '#FFFFFF', style.colors.text, '#FF7EB6', '#2FE3A6', '#FFD23F'];
    const k = 1.8,
      ex = (1 - Math.exp(-k * tt)) / k,
      fade = 1 - clamp((tt - 2.0) / 0.8);
    for (let i = 0; i < 90; i++) {
      const ang = -Math.PI / 2 + (r() - 0.5) * 2.4,
        sp = m * (1.2 + r() * 1.6),
        sz = m * (0.01 + r() * 0.012),
        rot0 = r() * 6,
        spin = 3 + r() * 6,
        col = cols[i % cols.length];
      const x = box.cx + Math.cos(ang) * sp * ex + Math.sin(tt * 3 + i) * m * 0.01;
      const y = box.top + Math.sin(ang) * sp * ex + 0.5 * m * 0.9 * tt * tt;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(x, y);
      ctx.rotate(rot0 + tt * spin);
      ctx.scale(1, Math.cos(tt * 7 + i));
      ctx.fillStyle = col;
      ctx.fillRect(-sz / 2, -sz / 4, sz, sz / 2);
      ctx.restore();
    }
  } else if (fx === 'sparkles') {
    const r = seeded(scene.id * 77);
    for (let i = 0; i < 12; i++) {
      const x = box.cx + (r() - 0.5) * box.w * 1.5,
        y = box.cy + (r() - 0.5) * box.h * 1.15,
        ph = r() * 6.28,
        sz = m * (0.02 + r() * 0.03);
      const tw = Math.pow(Math.max(0, Math.sin(local * 2.6 + ph)), 2) * clamp((local - 0.4) / 0.5);
      if (tw <= 0.01) continue;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(local * 0.8 + ph);
      ctx.scale(tw, tw);
      ctx.fillStyle = i % 3 === 0 ? style.colors.accent : '#FFFFFF';
      ctx.shadowColor = 'rgba(255,255,255,.8)';
      ctx.shadowBlur = sz * 0.8;
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4,
          rad = k % 2 ? sz * 0.18 : sz * 0.6;
        ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  } else if (fx === 'stickers') {
    const list = graphemes(scene.stickers || '')
      .filter((g) => g.trim())
      .slice(0, 5);
    const spots: Array<[number, number]> = [
      [-0.62, -0.28],
      [0.62, -0.08],
      [-0.58, 0.26],
      [0.6, 0.34],
      [0.05, -0.6],
    ];
    list.forEach((g, i) => {
      const p = easeOutBack(clamp((local - 0.6 - i * 0.15) / 0.5));
      if (p <= 0) return;
      const [ox, oy] = spots[i];
      const x = box.cx + ox * box.w,
        y = box.cy + oy * box.h + Math.sin(local * 2 + i) * m * 0.012;
      const size = m * 0.1;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(local * 1.5 + i * 2) * 0.15 + (i % 2 ? 0.12 : -0.12));
      ctx.scale(p, p);
      ctx.shadowColor = 'rgba(0,0,0,.25)';
      ctx.shadowBlur = size * 0.2;
      ctx.shadowOffsetY = size * 0.06;
      ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(g, 0, 0);
      ctx.restore();
    });
    ctx.textAlign = 'left';
  }
}

export function applyCamera(ctx: CanvasRenderingContext2D, cam: Camera, local: number, dur: number, W: number, H: number): void {
  if (!cam || cam === 'none') return;
  const p = clamp(local / dur);
  let s = 1,
    dx = 0,
    dy = 0,
    r = 0;
  if (cam === 'push') s = 1 + 0.09 * easeInOutCubic(p);
  else if (cam === 'pull') s = 1.1 - 0.1 * easeInOutCubic(p);
  else if (cam === 'drift') {
    dx = (p - 0.5) * W * 0.07;
    s = 1.05;
  } else if (cam === 'shake') {
    dx = (Math.sin(local * 7.3) + Math.sin(local * 13.1) * 0.5) * W * 0.0035;
    dy = (Math.sin(local * 6.1 + 1) + Math.sin(local * 11.7) * 0.5) * H * 0.0035;
    r = Math.sin(local * 5.3) * 0.005;
    s = 1.03;
  }
  ctx.translate(W / 2 + dx, H / 2 + dy);
  ctx.rotate(r);
  ctx.scale(s, s);
  ctx.translate(-W / 2, -H / 2);
}
