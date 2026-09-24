/** Progress bar, progress ring, loading skeleton shimmer, success/error state. */
import { clamp01, easeInOut, spr, SP } from '../../spring';
import { clearShadow, elevationShadow, idleFloat } from '../draw';
import { registerElement } from '../registry';
import { fontStr } from '../theme';
import { roundRectPath } from '../../texture';
import type { UIElementDef } from '../types';

/* ---------- progress bar ---------- */

export interface ProgressBarProps {
  value: number;
  loopSeconds: number;
}

const progressBar: UIElementDef<ProgressBarProps> = {
  id: 'progressBar',
  label: 'Progress bar',
  category: 'Status',
  defaultProps: { value: 0.72, loopSeconds: 2 },
  propsSchema: [
    { key: 'value', kind: 'number', label: 'Value (0-1)', min: 0, max: 1, step: 0.01 },
    { key: 'loopSeconds', kind: 'number', label: 'Fill over (s)', min: 0.4, max: 5, step: 0.1 },
  ],
  naturalSize: { w: 260, h: 20 },
  draw(ctx, w, h, t, props, theme) {
    const p = clamp01(easeInOut(clamp01(t / props.loopSeconds))) * props.value;
    const cy = h / 2 + idleFloat(t, 0.8, 3.2);
    roundRectPath(ctx, 0, cy - h / 2, w, h, h / 2);
    ctx.fillStyle = theme.surfaceAlt;
    ctx.fill();
    roundRectPath(ctx, 0, cy - h / 2, Math.max(h, w * p), h, h / 2);
    ctx.fillStyle = theme.primary;
    ctx.fill();
  },
};

/* ---------- progress ring ---------- */

export interface ProgressRingProps {
  value: number;
  loopSeconds: number;
}

const progressRing: UIElementDef<ProgressRingProps> = {
  id: 'progressRing',
  label: 'Progress ring',
  category: 'Status',
  defaultProps: { value: 0.78, loopSeconds: 2 },
  propsSchema: [
    { key: 'value', kind: 'number', label: 'Value (0-1)', min: 0, max: 1, step: 0.01 },
    { key: 'loopSeconds', kind: 'number', label: 'Fill over (s)', min: 0.4, max: 5, step: 0.1 },
  ],
  naturalSize: { w: 120, h: 120 },
  draw(ctx, w, h, t, props, theme) {
    const p = clamp01(easeInOut(clamp01(t / props.loopSeconds))) * props.value;
    const r = Math.min(w, h) / 2 - 10;
    const cx = w / 2,
      cy = h / 2 + idleFloat(t, 1, 3.6);
    ctx.lineWidth = r * 0.22;
    ctx.lineCap = 'round';
    ctx.strokeStyle = theme.surfaceAlt;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = theme.primary;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = theme.text;
    ctx.font = fontStr(800, r * 0.5, theme.fontDisplay);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(p * 100)}%`, cx, cy + r * 0.03);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  },
};

/* ---------- skeleton shimmer ---------- */

export interface SkeletonProps {
  lines: number;
  periodSeconds: number;
}

const skeleton: UIElementDef<SkeletonProps> = {
  id: 'skeletonShimmer',
  label: 'Loading skeleton',
  category: 'Status',
  defaultProps: { lines: 3, periodSeconds: 1.6 },
  propsSchema: [
    { key: 'lines', kind: 'number', label: 'Lines', min: 1, max: 5, step: 1 },
    { key: 'periodSeconds', kind: 'number', label: 'Sweep period (s)', min: 0.6, max: 4, step: 0.1 },
  ],
  naturalSize: { w: 300, h: 120 },
  draw(ctx, w, h, t, props, theme) {
    // Shimmer sweep is the "continuous scroll" exception MOTION_GUIDE.md
    // carves out for linear motion — a loading shimmer is expected to be a
    // constant-rate scan, not a spring.
    const sweep = (t % props.periodSeconds) / props.periodSeconds;
    const rowH = h / props.lines;
    ctx.save();
    for (let i = 0; i < props.lines; i++) {
      const rw = i === props.lines - 1 ? w * 0.6 : w;
      roundRectPath(ctx, 0, i * rowH + rowH * 0.18, rw, rowH * 0.64, rowH * 0.2);
      ctx.fillStyle = theme.surfaceAlt;
      ctx.fill();
    }
    roundRectPath(ctx, 0, 0, w, h, 0);
    ctx.clip();
    const bandX = -w * 0.4 + sweep * w * 1.8;
    const g = ctx.createLinearGradient(bandX - w * 0.2, 0, bandX + w * 0.2, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  },
};

/* ---------- success / error state ---------- */

export interface StateBadgeProps {
  tone: 'success' | 'danger';
}

const stateBadge: UIElementDef<StateBadgeProps> = {
  id: 'stateBadge',
  label: 'Success / error state',
  category: 'Status',
  defaultProps: { tone: 'success' },
  propsSchema: [{ key: 'tone', kind: 'select', label: 'Tone', options: [{ value: 'success', label: 'Success' }, { value: 'danger', label: 'Danger' }] }],
  naturalSize: { w: 110, h: 110 },
  draw(ctx, w, h, t, props, theme) {
    const p = clamp01(spr(t - 0.05, SP.bouncy));
    const cx = w / 2,
      cy = h / 2 + idleFloat(t, 1, 3.4);
    const r = (Math.min(w, h) / 2 - 6) * (0.5 + 0.5 * p);
    const color = props.tone === 'success' ? theme.success : theme.danger;
    ctx.save();
    ctx.translate(cx, cy);
    elevationShadow(ctx, 0.16);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    clearShadow(ctx);
    const markP = clamp01((t - 0.28) * 3.2);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = r * 0.16;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (props.tone === 'success') {
      const pts: [number, number][] = [
        [-r * 0.32, 0],
        [-r * 0.08, r * 0.28],
        [r * 0.36, -r * 0.28],
      ];
      ctx.beginPath();
      if (markP < 0.5) {
        const u = markP / 0.5;
        ctx.moveTo(...pts[0]);
        ctx.lineTo(pts[0][0] + (pts[1][0] - pts[0][0]) * u, pts[0][1] + (pts[1][1] - pts[0][1]) * u);
      } else {
        const u = (markP - 0.5) / 0.5;
        ctx.moveTo(...pts[0]);
        ctx.lineTo(...pts[1]);
        ctx.lineTo(pts[1][0] + (pts[2][0] - pts[1][0]) * u, pts[1][1] + (pts[2][1] - pts[1][1]) * u);
      }
      ctx.stroke();
    } else {
      const u = clamp01(markP);
      const d = r * 0.3;
      ctx.beginPath();
      ctx.moveTo(-d * u, -d * u);
      ctx.lineTo(d * u, d * u);
      ctx.moveTo(d * u, -d * u);
      ctx.lineTo(-d * u, d * u);
      ctx.stroke();
    }
    ctx.restore();
  },
};

registerElement(progressBar);
registerElement(progressRing);
registerElement(skeleton);
registerElement(stateBadge);
