/** Mini line chart (draws on), bar chart (bars grow), number counter. */
import { clamp01, easeInOut, spr, SP } from '../../spring';
import { idleFloat, stagger } from '../draw';
import { registerElement } from '../registry';
import { fontStr } from '../theme';
import { roundRectPath } from '../../texture';
import type { UIElementDef } from '../types';

/* ---------- line chart ---------- */

export interface LineChartProps {
  points: string;
  drawSeconds: number;
}

function parsePoints(csv: string): number[] {
  return csv
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
}

const lineChart: UIElementDef<LineChartProps> = {
  id: 'lineChart',
  label: 'Line chart',
  category: 'Charts',
  defaultProps: { points: '0.3,0.5,0.35,0.8,0.6,0.9,0.75', drawSeconds: 1.1 },
  propsSchema: [
    { key: 'points', kind: 'string', label: 'Values 0-1 (comma-separated)', maxLength: 80 },
    { key: 'drawSeconds', kind: 'number', label: 'Draw-on over (s)', min: 0.3, max: 3, step: 0.1 },
  ],
  naturalSize: { w: 280, h: 140 },
  draw(ctx, w, h, t, props, theme) {
    const vals = parsePoints(props.points);
    if (vals.length < 2) return;
    const pad = 14;
    const pts = vals.map((v, i) => [pad + (i / (vals.length - 1)) * (w - pad * 2), h - pad - v * (h - pad * 2)] as [number, number]);
    const p = clamp01(easeInOut(clamp01(t / props.drawSeconds)));
    const totalSegs = vals.length - 1;
    const segFloat = p * totalSegs;
    ctx.save();
    ctx.translate(0, idleFloat(t, 1, 3.6));
    ctx.strokeStyle = theme.primary;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < totalSegs; i++) {
      const segP = clamp01(segFloat - i);
      if (segP <= 0) break;
      const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * segP;
      const y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * segP;
      ctx.lineTo(x, y);
      if (segP < 1) break;
    }
    ctx.stroke();
    if (p >= 1) {
      const last = pts[pts.length - 1];
      const pop = clamp01(spr(t - props.drawSeconds, SP.bouncy));
      ctx.beginPath();
      ctx.arc(last[0], last[1], 5 * pop, 0, Math.PI * 2);
      ctx.fillStyle = theme.accent;
      ctx.fill();
    }
    ctx.restore();
  },
};

/* ---------- bar chart ---------- */

export interface BarChartProps {
  values: string;
}

const barChart: UIElementDef<BarChartProps> = {
  id: 'barChart',
  label: 'Bar chart',
  category: 'Charts',
  defaultProps: { values: '0.55,0.78,0.62,0.95,0.7,0.42,0.86' },
  propsSchema: [{ key: 'values', kind: 'string', label: 'Values 0-1 (comma-separated)', maxLength: 80 }],
  naturalSize: { w: 260, h: 140 },
  draw(ctx, w, h, t, props, theme) {
    const vals = parsePoints(props.values);
    if (!vals.length) return;
    const gap = 8;
    const bw = (w - gap * (vals.length - 1)) / vals.length;
    vals.forEach((v, i) => {
      const at = stagger(i, 60);
      const p = clamp01(spr(t - at, SP.bouncy));
      const bh = v * (h - 20) * p;
      const x = i * (bw + gap);
      roundRectPath(ctx, x, h - bh + idleFloat(t, 0.8, 3.2, i), bw, Math.max(2, bh), bw * 0.3);
      ctx.fillStyle = i === vals.length - 1 ? theme.accent : theme.primary;
      ctx.fill();
    });
  },
};

/* ---------- number counter ---------- */

export interface NumberCounterProps {
  from: number;
  to: number;
  durationSeconds: number;
  prefix: string;
  suffix: string;
}

const numberCounter: UIElementDef<NumberCounterProps> = {
  id: 'numberCounter',
  label: 'Number counter',
  category: 'Charts',
  defaultProps: { from: 0, to: 8432, durationSeconds: 1.1, prefix: '', suffix: '' },
  propsSchema: [
    { key: 'from', kind: 'number', label: 'From', min: -100000, max: 100000, step: 1 },
    { key: 'to', kind: 'number', label: 'To', min: -100000, max: 100000, step: 1 },
    { key: 'durationSeconds', kind: 'number', label: 'Over (s)', min: 0.2, max: 4, step: 0.1 },
    { key: 'prefix', kind: 'string', label: 'Prefix', maxLength: 6 },
    { key: 'suffix', kind: 'string', label: 'Suffix', maxLength: 6 },
  ],
  naturalSize: { w: 240, h: 90 },
  draw(ctx, w, h, t, props, theme) {
    const p = clamp01(easeInOut(clamp01(t / props.durationSeconds)));
    const value = Math.round(props.from + (props.to - props.from) * p);
    const pop = 1 + 0.06 * Math.max(0, 1 - t / 0.3) * (1 - p < 0.05 ? 0 : 1);
    ctx.save();
    ctx.translate(w / 2, h / 2 + idleFloat(t, 1.2, 3.6));
    ctx.scale(pop, pop);
    ctx.fillStyle = theme.text;
    ctx.font = fontStr(800, h * 0.6, theme.fontDisplay);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${props.prefix}${value.toLocaleString()}${props.suffix}`, 0, h * 0.02);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  },
};

registerElement(lineChart);
registerElement(barChart);
registerElement(numberCounter);
