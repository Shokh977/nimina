/**
 * Cross-segment transitions (color wipe, flash, iris, blinds). Ported from
 * legacy/promo-studio.html's drawTransition.
 *
 * `styles[i]` must be the ResolvedStyle for `list[i]` (i.e. resolveStyle(project,
 * list[i].owner)) — the caller (render.ts) computes these once per frame so
 * this module never needs to know about Project or SlideStyle resolution.
 */
import type { ResolvedStyle, Segment } from './types';
import { clamp, easeInCubic, easeInOutCubic, easeOutCubic } from './utils';

const R = 0.32;

export function drawTransition(ctx: CanvasRenderingContext2D, t: number, W: number, H: number, list: Segment[], styles: ResolvedStyle[]): void {
  for (let i = 1; i < list.length; i++) {
    const d = t - list[i].start;
    if (Math.abs(d) > R) continue;
    const st = styles[i],
      mode = st.transition,
      c = st.colors;
    if (mode === 'none') continue;
    ctx.save();
    if (mode === 'flash') {
      ctx.fillStyle = `rgba(255,255,255,${Math.pow(1 - Math.abs(d) / R, 2) * 0.9})`;
      ctx.fillRect(0, 0, W, H);
    } else if (mode === 'wipe') {
      const sk = Math.min(W, H) * 0.35;
      const band = (col: string, lag: number) => {
        const dd = d - lag;
        if (Math.abs(dd) > R) return;
        ctx.fillStyle = col;
        ctx.beginPath();
        if (dd < 0) {
          const le = -sk + (W + 2 * sk) * easeInOutCubic((dd + R) / R);
          ctx.moveTo(-2 * sk, 0);
          ctx.lineTo(le, 0);
          ctx.lineTo(le - sk, H);
          ctx.lineTo(-2 * sk, H);
        } else {
          const te = -sk + (W + 2 * sk) * easeInOutCubic(dd / R);
          ctx.moveTo(te, 0);
          ctx.lineTo(W + 2 * sk, 0);
          ctx.lineTo(W + 2 * sk, H);
          ctx.lineTo(te - sk, H);
        }
        ctx.closePath();
        ctx.fill();
      };
      band(c.text, -0.05);
      band(c.accent, 0);
    } else if (mode === 'iris') {
      const maxR = Math.hypot(W, H) / 2 + 4;
      const r = d < 0 ? maxR * easeInCubic((d + R) / R) : maxR * (1 - easeOutCubic(d / R));
      ctx.fillStyle = c.accent;
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, Math.max(0, r), 0, Math.PI * 2);
      ctx.fill();
    } else if (mode === 'bars') {
      const n = 6,
        bh = H / n;
      for (let k = 0; k < n; k++) {
        const lag = k * 0.025,
          dd = d - lag + 0.06;
        const f = dd < 0 ? easeInOutCubic(clamp((dd + R) / R)) : 1 - easeInOutCubic(clamp(dd / R));
        if (f <= 0) continue;
        ctx.fillStyle = k % 2 ? c.accent : c.text;
        const w = W * f;
        ctx.fillRect(k % 2 ? W - w : 0, k * bh - 1, w, bh + 2);
      }
    }
    ctx.restore();
  }
}
