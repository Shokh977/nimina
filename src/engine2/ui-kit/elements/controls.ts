/** Button (press squish + ripple), toggle switch, checkbox, slider, segmented control. */
import { clamp01, easeInOut, spr, SP } from '../../spring';
import { anticipatePop, clearShadow, elevationShadow, idleFloat, mixHex } from '../draw';
import { registerElement } from '../registry';
import { fontStr } from '../theme';
import { roundRectPath } from '../../texture';
import type { UIElementDef } from '../types';

/* ---------- button ---------- */

export interface ButtonProps {
  label: string;
  loopSeconds: number;
}

const button: UIElementDef<ButtonProps> = {
  id: 'button',
  label: 'Button',
  category: 'Controls',
  defaultProps: { label: 'Get started', loopSeconds: 1.8 },
  propsSchema: [
    { key: 'label', kind: 'string', label: 'Label', maxLength: 24 },
    { key: 'loopSeconds', kind: 'number', label: 'Press every (s)', min: 0.8, max: 4, step: 0.1 },
  ],
  naturalSize: { w: 220, h: 64 },
  draw(ctx, w, h, t, props, theme) {
    const local = t % props.loopSeconds;
    const pressAt = props.loopSeconds * 0.5;
    const squish = anticipatePop(local, pressAt, 0.07, 0.08, SP.snappy);
    const rippleP = clamp01((local - pressAt) / 0.6);
    ctx.save();
    ctx.translate(w / 2, h / 2 + idleFloat(t, 1, 3.4));
    ctx.scale(1, Math.max(0.001, squish));
    elevationShadow(ctx, 0.16);
    roundRectPath(ctx, -w / 2, -h / 2, w, h, h / 2);
    ctx.fillStyle = theme.primary;
    ctx.fill();
    clearShadow(ctx);
    if (rippleP < 1) {
      ctx.save();
      roundRectPath(ctx, -w / 2, -h / 2, w, h, h / 2);
      ctx.clip();
      ctx.beginPath();
      ctx.arc(0, 0, rippleP * w * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${0.32 * (1 - rippleP)})`;
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = theme.onPrimary;
    ctx.font = fontStr(700, 19, theme.font);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(props.label, 0, 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  },
};

/* ---------- toggle switch ---------- */

export interface ToggleProps {
  loopSeconds: number;
}

const toggle: UIElementDef<ToggleProps> = {
  id: 'toggle',
  label: 'Toggle switch',
  category: 'Controls',
  defaultProps: { loopSeconds: 2 },
  propsSchema: [{ key: 'loopSeconds', kind: 'number', label: 'Flip every (s)', min: 0.6, max: 4, step: 0.1 }],
  naturalSize: { w: 100, h: 52 },
  draw(ctx, w, h, t, props, theme) {
    const local = t % props.loopSeconds;
    const on = Math.floor(t / props.loopSeconds) % 2 === 1;
    const flipT = local > props.loopSeconds - 0.5 ? props.loopSeconds - local < 0.5 ? 1 - (props.loopSeconds - local) / 0.5 : 0 : 0;
    const p = clamp01(on ? spr(flipT, SP.bouncy) : 1 - spr(flipT, SP.bouncy));
    ctx.save();
    ctx.translate(0, idleFloat(t, 1, 3.2));
    const r = h / 2;
    roundRectPath(ctx, 0, 0, w, h, r);
    ctx.fillStyle = mixHex(theme.surfaceAlt, theme.primary, p);
    ctx.fill();
    const knobR = r - 5;
    const knobX = 5 + knobR + (w - h) * p;
    elevationShadow(ctx, 0.14);
    ctx.beginPath();
    ctx.arc(knobX, r, knobR, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    clearShadow(ctx);
    ctx.restore();
  },
};

/* ---------- checkbox ---------- */

export interface CheckboxProps {
  label: string;
  loopSeconds: number;
}

const checkbox: UIElementDef<CheckboxProps> = {
  id: 'checkbox',
  label: 'Checkbox',
  category: 'Controls',
  defaultProps: { label: 'Remember me', loopSeconds: 2.2 },
  propsSchema: [
    { key: 'label', kind: 'string', label: 'Label', maxLength: 30 },
    { key: 'loopSeconds', kind: 'number', label: 'Check every (s)', min: 0.6, max: 4, step: 0.1 },
  ],
  naturalSize: { w: 220, h: 48 },
  draw(ctx, w, h, t, props, theme) {
    const local = t % props.loopSeconds;
    const checked = local > props.loopSeconds * 0.35 && local < props.loopSeconds * 0.9;
    const since = checked ? local - props.loopSeconds * 0.35 : 0;
    const p = checked ? spr(since, SP.bouncy) : 0;
    const box = h * 0.68;
    ctx.save();
    ctx.translate(0, idleFloat(t, 1, 3.6));
    roundRectPath(ctx, 0, (h - box) / 2, box, box, box * 0.26);
    ctx.fillStyle = p > 0.02 ? mixHex(theme.surfaceAlt, theme.primary, clamp01(p)) : theme.surfaceAlt;
    ctx.fill();
    if (p > 0.02) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = box * 0.14;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const cx = box / 2,
        cy = h / 2;
      const seg = clamp01(p * 1.3);
      ctx.beginPath();
      const p1 = [cx - box * 0.22, cy];
      const p2 = [cx - box * 0.05, cy + box * 0.18];
      const p3 = [cx + box * 0.26, cy - box * 0.2];
      if (seg < 0.5) {
        const u = seg / 0.5;
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p1[0] + (p2[0] - p1[0]) * u, p1[1] + (p2[1] - p1[1]) * u);
      } else {
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
        const u = (seg - 0.5) / 0.5;
        ctx.lineTo(p2[0] + (p3[0] - p2[0]) * u, p2[1] + (p3[1] - p2[1]) * u);
      }
      ctx.stroke();
    }
    ctx.fillStyle = theme.text;
    ctx.font = fontStr(500, 17, theme.font);
    ctx.textBaseline = 'middle';
    ctx.fillText(props.label, box + 14, h / 2 + 1);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  },
};

/* ---------- slider ---------- */

export interface SliderProps {
  loopSeconds: number;
}

const slider: UIElementDef<SliderProps> = {
  id: 'slider',
  label: 'Slider',
  category: 'Controls',
  defaultProps: { loopSeconds: 2.4 },
  propsSchema: [{ key: 'loopSeconds', kind: 'number', label: 'Sweep every (s)', min: 0.8, max: 5, step: 0.1 }],
  naturalSize: { w: 260, h: 40 },
  draw(ctx, w, h, t, props, theme) {
    const local = t % props.loopSeconds;
    const p = clamp01(easeInOut(clamp01(local / (props.loopSeconds * 0.7))));
    const cy = h / 2 + idleFloat(t, 1, 3.4);
    const trackY = cy,
      r = 4;
    roundRectPath(ctx, 0, trackY - r, w, r * 2, r);
    ctx.fillStyle = theme.surfaceAlt;
    ctx.fill();
    roundRectPath(ctx, 0, trackY - r, w * p, r * 2, r);
    ctx.fillStyle = theme.primary;
    ctx.fill();
    const knobX = w * p;
    elevationShadow(ctx, 0.18);
    ctx.beginPath();
    ctx.arc(knobX, trackY, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    clearShadow(ctx);
    ctx.strokeStyle = theme.primary;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(knobX, trackY, 9, 0, Math.PI * 2);
    ctx.stroke();
  },
};

/* ---------- segmented control ---------- */

export interface SegmentedProps {
  segments: string;
  loopSeconds: number;
}

const segmented: UIElementDef<SegmentedProps> = {
  id: 'segmentedControl',
  label: 'Segmented control',
  category: 'Controls',
  defaultProps: { segments: 'Day,Week,Month', loopSeconds: 1.8 },
  propsSchema: [
    { key: 'segments', kind: 'string', label: 'Segments (comma-separated)', maxLength: 60 },
    { key: 'loopSeconds', kind: 'number', label: 'Cycle every (s)', min: 0.6, max: 4, step: 0.1 },
  ],
  naturalSize: { w: 280, h: 48 },
  draw(ctx, w, h, t, props, theme) {
    const segs = props.segments.split(',').map((s) => s.trim()).filter(Boolean);
    if (!segs.length) return;
    const active = Math.floor(t / props.loopSeconds) % segs.length;
    const local = t % props.loopSeconds;
    const settle = clamp01(spr(Math.min(local, props.loopSeconds - 0.05), SP.snappy));
    const prevActive = (active - 1 + segs.length) % segs.length;
    const pillX = ((prevActive + (active - prevActive) * settle) / segs.length) * w;

    ctx.save();
    ctx.translate(0, idleFloat(t, 1, 3.6));
    roundRectPath(ctx, 0, 0, w, h, h / 2);
    ctx.fillStyle = theme.surfaceAlt;
    ctx.fill();
    const segW = w / segs.length;
    elevationShadow(ctx, 0.1);
    roundRectPath(ctx, pillX + 3, 3, segW - 6, h - 6, (h - 6) / 2);
    ctx.fillStyle = theme.surface;
    ctx.fill();
    clearShadow(ctx);
    ctx.font = fontStr(600, 15, theme.font);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    segs.forEach((s, i) => {
      ctx.fillStyle = i === active ? theme.text : theme.textMuted;
      ctx.fillText(s, segW * i + segW / 2, h / 2 + 1);
    });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  },
};

registerElement(button);
registerElement(toggle);
registerElement(checkbox);
registerElement(slider);
registerElement(segmented);
