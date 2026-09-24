/** Cursor (moves along a path, clicks) and finger (tap/drag/swipe). */
import { clamp01, easeInOut } from '../../spring';
import { anticipatePop } from '../draw';
import { registerElement } from '../registry';
import type { UIElementDef } from '../types';

function parsePath(csv: string): [number, number][] {
  const nums = csv
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
  const pts: [number, number][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  return pts.length >= 2 ? pts : [[0.2, 0.7], [0.8, 0.3]];
}

function alongPath(pts: [number, number][], u: number): [number, number] {
  const segs = pts.length - 1;
  const f = clamp01(u) * segs;
  const i = Math.min(segs - 1, Math.floor(f));
  const local = f - i;
  const [x0, y0] = pts[i],
    [x1, y1] = pts[i + 1];
  return [x0 + (x1 - x0) * local, y0 + (y1 - y0) * local];
}

/* ---------- cursor ---------- */

export interface CursorProps {
  path: string;
  loopSeconds: number;
}

const cursor: UIElementDef<CursorProps> = {
  id: 'cursor',
  label: 'Cursor',
  category: 'Pointer',
  defaultProps: { path: '0.15,0.75,0.5,0.4,0.85,0.2', loopSeconds: 1.8 },
  propsSchema: [
    { key: 'path', kind: 'string', label: 'Path (x,y 0-1 pairs)', maxLength: 80 },
    { key: 'loopSeconds', kind: 'number', label: 'Travel over (s)', min: 0.4, max: 4, step: 0.1 },
  ],
  naturalSize: { w: 240, h: 200 },
  draw(ctx, w, h, t, props) {
    const pts = parsePath(props.path);
    const local = t % (props.loopSeconds + 0.4);
    const u = clamp01(easeInOut(clamp01(local / props.loopSeconds)));
    const [nx, ny] = alongPath(pts, u);
    const x = nx * w,
      y = ny * h;
    const clicked = local >= props.loopSeconds;
    const clickP = clicked ? clamp01((local - props.loopSeconds) / 0.4) : 0;

    if (clickP > 0) {
      ctx.save();
      ctx.globalAlpha = 1 - clickP;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, 6 + clickP * 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    const squeeze = anticipatePop(local, props.loopSeconds, 0.16, 0.15);

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(squeeze, squeeze);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 22);
    ctx.lineTo(5.5, 17.5);
    ctx.lineTo(9, 25.5);
    ctx.lineTo(12.5, 24);
    ctx.lineTo(9.2, 16.3);
    ctx.lineTo(16, 15.8);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.4;
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.stroke();
    ctx.restore();
  },
};

/* ---------- finger gesture ---------- */

export interface FingerGestureProps {
  mode: 'tap' | 'drag' | 'swipe';
  loopSeconds: number;
}

const fingerR = 22;

function finger(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, opacity: number, accent: string): void {
  if (opacity <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = fingerR * 0.5;
  ctx.shadowOffsetY = fingerR * 0.12;
  ctx.beginPath();
  ctx.arc(0, 0, fingerR, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = fingerR * 0.14;
  ctx.strokeStyle = accent;
  ctx.stroke();
  ctx.restore();
}

const fingerGesture: UIElementDef<FingerGestureProps> = {
  id: 'fingerGesture',
  label: 'Finger gesture',
  category: 'Pointer',
  defaultProps: { mode: 'tap', loopSeconds: 1.4 },
  propsSchema: [
    { key: 'mode', kind: 'select', label: 'Mode', options: [{ value: 'tap', label: 'Tap' }, { value: 'drag', label: 'Drag' }, { value: 'swipe', label: 'Swipe' }] },
    { key: 'loopSeconds', kind: 'number', label: 'Loop every (s)', min: 0.6, max: 3, step: 0.1 },
  ],
  naturalSize: { w: 220, h: 180 },
  draw(ctx, w, h, t, props, theme) {
    const local = t % props.loopSeconds;
    const p = clamp01(local / (props.loopSeconds * 0.85));
    const fadeOut = clamp01(1 - (local - props.loopSeconds * 0.85) / (props.loopSeconds * 0.15));

    if (props.mode === 'tap') {
      const cx = w / 2,
        cy = h / 2;
      const pressP = clamp01(p * 3);
      for (let k = 0; k < 2; k++) {
        const rp = clamp01(p * 1.4 - k * 0.2);
        if (rp <= 0 || rp >= 1) continue;
        ctx.save();
        ctx.globalAlpha = (1 - rp) * fadeOut;
        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, fingerR * (1 + rp * 2.4), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      finger(ctx, cx, cy, 1 - 0.15 * Math.sin(pressP * Math.PI), fadeOut, theme.accent);
    } else if (props.mode === 'drag' || props.mode === 'swipe') {
      const up = props.mode === 'swipe';
      const dist = up ? h * 0.32 : w * 0.5;
      const sx = up ? w / 2 : w * 0.25,
        sy = up ? h * 0.68 : h / 2;
      const cx = up ? sx : sx + dist * p,
        cy = up ? sy - dist * p : sy;
      if (p > 0.02) {
        const g = ctx.createLinearGradient(sx, sy, cx, cy);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(1, 'rgba(255,255,255,0.65)');
        ctx.save();
        ctx.globalAlpha = fadeOut;
        ctx.strokeStyle = g;
        ctx.lineWidth = fingerR * 0.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(cx, cy);
        ctx.stroke();
        ctx.restore();
      }
      finger(ctx, cx, cy, 1, fadeOut, theme.accent);
    }
  },
};

registerElement(cursor);
registerElement(fingerGesture);
