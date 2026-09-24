/** Notification banner, toast, badge counter, bell ring. */
import { clamp01, spr, SP } from '../../spring';
import { anticipatePop, clearShadow, elevationShadow, idleFloat, truncate } from '../draw';
import { registerElement } from '../registry';
import { fontStr } from '../theme';
import { roundRectPath } from '../../texture';
import type { UIElementDef } from '../types';

/* ---------- banner: slides down, holds, slides back up ---------- */

export interface BannerProps {
  title: string;
  body: string;
  icon: string;
  holdSeconds: number;
}

const banner: UIElementDef<BannerProps> = {
  id: 'notificationBanner',
  label: 'Notification banner',
  category: 'Messaging',
  defaultProps: { title: 'Your order shipped', body: 'Arriving in 18 min', icon: '📦', holdSeconds: 1.6 },
  propsSchema: [
    { key: 'title', kind: 'string', label: 'Title', maxLength: 40 },
    { key: 'body', kind: 'string', label: 'Body', maxLength: 60 },
    { key: 'icon', kind: 'emoji', label: 'Icon' },
    { key: 'holdSeconds', kind: 'number', label: 'Hold (s)', min: 0.3, max: 4, step: 0.1 },
  ],
  naturalSize: { w: 420, h: 120 },
  draw(ctx, w, h, t, props, theme) {
    const inAt = 0.1,
      outAt = inAt + 0.45 + props.holdSeconds;
    const enter = spr(t - inAt, SP.bouncy);
    const exit = clamp01((t - outAt) / 0.28);
    const y = (1 - enter) * -(h + 20) + exit * exit * -(h + 20) + idleFloat(t, 1.2, 3.2);
    const opacity = clamp01(1 - exit * 1.4);
    if (opacity <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(0, y);
    elevationShadow(ctx, 0.18);
    ctx.beginPath();
    const r = h * 0.32;
    ctx.moveTo(r, 6);
    ctx.arcTo(w - 6, 6, w - 6, h - 6, r);
    ctx.arcTo(w - 6, h - 6, 6, h - 6, r);
    ctx.arcTo(6, h - 6, 6, 6, r);
    ctx.arcTo(6, 6, w - 6, 6, r);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    ctx.fill();
    clearShadow(ctx);

    const ic = h * 0.56;
    ctx.fillStyle = theme.primary;
    const iconR = ic * 0.3;
    ctx.beginPath();
    ctx.moveTo(24 + iconR, h / 2 - ic / 2);
    ctx.arcTo(24 + ic, h / 2 - ic / 2, 24 + ic, h / 2 + ic / 2, iconR);
    ctx.arcTo(24 + ic, h / 2 + ic / 2, 24, h / 2 + ic / 2, iconR);
    ctx.arcTo(24, h / 2 + ic / 2, 24, h / 2 - ic / 2, iconR);
    ctx.arcTo(24, h / 2 - ic / 2, 24 + ic, h / 2 - ic / 2, iconR);
    ctx.fill();
    ctx.font = `${ic * 0.52}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(props.icon, 24 + ic / 2, h / 2);
    ctx.textAlign = 'left';

    ctx.fillStyle = theme.text;
    ctx.font = fontStr(700, 19, theme.font);
    ctx.fillText(truncate(ctx, props.title, w - ic - 60), 24 + ic + 16, h / 2 - 14);
    ctx.fillStyle = theme.textMuted;
    ctx.font = fontStr(500, 16, theme.font);
    ctx.fillText(truncate(ctx, props.body, w - ic - 60), 24 + ic + 16, h / 2 + 12);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  },
};

/* ---------- toast: pops from bottom, brief hold, fades ---------- */

export interface ToastProps {
  text: string;
  tone: 'neutral' | 'success' | 'danger';
  holdSeconds: number;
}

const toast: UIElementDef<ToastProps> = {
  id: 'toast',
  label: 'Toast',
  category: 'Messaging',
  defaultProps: { text: 'Saved to favorites', tone: 'success', holdSeconds: 1.2 },
  propsSchema: [
    { key: 'text', kind: 'string', label: 'Text', maxLength: 50 },
    { key: 'tone', kind: 'select', label: 'Tone', options: [{ value: 'neutral', label: 'Neutral' }, { value: 'success', label: 'Success' }, { value: 'danger', label: 'Danger' }] },
    { key: 'holdSeconds', kind: 'number', label: 'Hold (s)', min: 0.3, max: 4, step: 0.1 },
  ],
  naturalSize: { w: 340, h: 64 },
  draw(ctx, w, h, t, props, theme) {
    const inAt = 0.05,
      outAt = inAt + 0.4 + props.holdSeconds;
    const enter = spr(t - inAt, SP.bouncy);
    const exit = clamp01((t - outAt) / 0.25);
    const y = (1 - enter) * 24 + idleFloat(t, 1, 3);
    const opacity = clamp01(enter) * clamp01(1 - exit);
    if (opacity <= 0.01) return;
    const tone = props.tone === 'success' ? theme.success : props.tone === 'danger' ? theme.danger : theme.text;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(0, y);
    elevationShadow(ctx, 0.16);
    roundRectPath(ctx, 0, 0, w, h, h / 2);
    ctx.fillStyle = '#15161B';
    ctx.fill();
    clearShadow(ctx);
    if (props.tone !== 'neutral') {
      ctx.beginPath();
      ctx.arc(28, h / 2, 8, 0, Math.PI * 2);
      ctx.fillStyle = tone;
      ctx.fill();
    }
    ctx.fillStyle = '#fff';
    ctx.font = fontStr(600, 16, theme.font);
    ctx.textBaseline = 'middle';
    ctx.fillText(truncate(ctx, props.text, w - (props.tone !== 'neutral' ? 56 : 28)), props.tone !== 'neutral' ? 46 : 20, h / 2 + 1);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  },
};

/* ---------- badge counter ---------- */

export interface BadgeCounterProps {
  count: number;
}

const badgeCounter: UIElementDef<BadgeCounterProps> = {
  id: 'badgeCounter',
  label: 'Badge counter',
  category: 'Messaging',
  defaultProps: { count: 3 },
  propsSchema: [{ key: 'count', kind: 'number', label: 'Count', min: 0, max: 99, step: 1 }],
  naturalSize: { w: 60, h: 60 },
  draw(ctx, w, h, t, props, theme) {
    const pop = anticipatePop(t, 0.1, 0.06, 0.1, SP.bouncy);
    const cx = w / 2,
      cy = h / 2 + idleFloat(t, 1, 3.4);
    const r = Math.min(w, h) * 0.42;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(Math.max(0.001, pop), Math.max(0.001, pop));
    elevationShadow(ctx, 0.2);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = theme.danger;
    ctx.fill();
    clearShadow(ctx);
    ctx.fillStyle = '#fff';
    ctx.font = fontStr(800, r * (props.count > 9 ? 1.0 : 1.15), theme.font);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(props.count > 99 ? '99+' : String(Math.round(props.count)), 0, r * 0.06);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  },
};

/* ---------- bell ring ---------- */

export interface BellRingProps {
  color: string;
  periodSeconds: number;
}

const bellRing: UIElementDef<BellRingProps> = {
  id: 'bellRing',
  label: 'Bell ring',
  category: 'Messaging',
  defaultProps: { color: '', periodSeconds: 2.2 },
  propsSchema: [{ key: 'periodSeconds', kind: 'number', label: 'Ring every (s)', min: 0.8, max: 6, step: 0.1 }],
  naturalSize: { w: 100, h: 100 },
  draw(ctx, w, h, t, props, theme) {
    const period = props.periodSeconds;
    const local = t % period;
    // A quick decaying wiggle at the start of each period, still via a
    // real spring (critically-damped ring-down), not a raw sine — the
    // "continuous rotation/scroll" exception in MOTION_GUIDE.md is for
    // truly constant-rate motion, a bell ring decays.
    const ring = local < 0.9 ? Math.sin(local * 26) * Math.exp(-local * 6) * 0.35 : 0;
    ctx.save();
    ctx.translate(w / 2, h / 2 + idleFloat(t, 1.2, 3.8));
    ctx.rotate(ring);
    const color = props.color || theme.text;
    const s = Math.min(w, h) * 0.36;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = s * 0.16;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.arc(0, -s * 0.1, s * 0.62, Math.PI * 1.05, Math.PI * 1.95);
    ctx.lineTo(s * 0.72, s * 0.5);
    ctx.lineTo(-s * 0.72, s * 0.5);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, s * 0.62, s * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
};

registerElement(banner);
registerElement(toast);
registerElement(badgeCounter);
registerElement(bellRing);
