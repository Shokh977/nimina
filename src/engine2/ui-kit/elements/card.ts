/** Card (image + title), list item, avatar with online dot, story ring. */
import { clamp01, spr, SP } from '../../spring';
import { clearShadow, elevationShadow, idleFloat, mixHex, truncate } from '../draw';
import { registerElement } from '../registry';
import { fontStr } from '../theme';
import { roundRectPath } from '../../texture';
import type { UIElementDef } from '../types';

/* ---------- card ---------- */

export interface CardProps {
  title: string;
  subtitle: string;
}

const card: UIElementDef<CardProps> = {
  id: 'card',
  label: 'Card',
  category: 'Content',
  defaultProps: { title: 'Pepperoni', subtitle: 'Large, stone baked' },
  propsSchema: [
    { key: 'title', kind: 'string', label: 'Title', maxLength: 30 },
    { key: 'subtitle', kind: 'string', label: 'Subtitle', maxLength: 40 },
  ],
  naturalSize: { w: 240, h: 260 },
  draw(ctx, w, h, t, props, theme) {
    const p = spr(t - 0.1, SP.bouncy);
    const scale = 0.85 + 0.15 * clamp01(p);
    const rise = (1 - clamp01(p)) * 24;
    ctx.save();
    ctx.translate(w / 2, h / 2 + rise + idleFloat(t, 1.6, 4));
    ctx.scale(Math.max(0.001, scale), Math.max(0.001, scale));
    ctx.translate(-w / 2, -h / 2);
    elevationShadow(ctx, 0.16);
    roundRectPath(ctx, 0, 0, w, h, 24);
    ctx.fillStyle = theme.surface;
    ctx.fill();
    clearShadow(ctx);

    const imgH = h * 0.58;
    ctx.save();
    roundRectPath(ctx, 0, 0, w, h, 24);
    ctx.clip();
    const g = ctx.createLinearGradient(0, 0, w, imgH);
    g.addColorStop(0, theme.primary);
    g.addColorStop(1, mixHex(theme.primary, theme.accent, 0.6));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, imgH);
    ctx.restore();

    ctx.fillStyle = theme.text;
    ctx.font = fontStr(700, 20, theme.font);
    ctx.fillText(truncate(ctx, props.title, w - 36), 18, imgH + 34);
    ctx.fillStyle = theme.textMuted;
    ctx.font = fontStr(500, 15, theme.font);
    ctx.fillText(truncate(ctx, props.subtitle, w - 36), 18, imgH + 58);
    ctx.restore();
  },
};

/* ---------- list item ---------- */

export interface ListItemProps {
  emoji: string;
  title: string;
  subtitle: string;
  index: number;
}

const listItem: UIElementDef<ListItemProps> = {
  id: 'listItem',
  label: 'List item',
  category: 'Content',
  defaultProps: { emoji: '🔥', title: '12-day streak', subtitle: 'Morning walk', index: 0 },
  propsSchema: [
    { key: 'emoji', kind: 'emoji', label: 'Icon' },
    { key: 'title', kind: 'string', label: 'Title', maxLength: 30 },
    { key: 'subtitle', kind: 'string', label: 'Subtitle', maxLength: 40 },
    { key: 'index', kind: 'number', label: 'Stagger index', min: 0, max: 8, step: 1 },
  ],
  naturalSize: { w: 340, h: 76 },
  draw(ctx, w, h, t, props, theme) {
    const at = 0.05 + props.index * 0.06;
    const p = clamp01(spr(t - at, SP.bouncy));
    const x = (1 - p) * 40;
    const opacity = clamp01((t - at) * 6);
    if (opacity <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(x, idleFloat(t, 1, 3.4, props.index));
    elevationShadow(ctx, 0.08);
    roundRectPath(ctx, 0, 0, w, h, 20);
    ctx.fillStyle = theme.surface;
    ctx.fill();
    clearShadow(ctx);
    const ic = h * 0.62;
    ctx.beginPath();
    ctx.arc(16 + ic / 2, h / 2, ic / 2, 0, Math.PI * 2);
    ctx.fillStyle = theme.surfaceAlt;
    ctx.fill();
    ctx.font = `${ic * 0.5}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(props.emoji, 16 + ic / 2, h / 2);
    ctx.textAlign = 'left';
    ctx.fillStyle = theme.text;
    ctx.font = fontStr(700, 17, theme.font);
    ctx.fillText(truncate(ctx, props.title, w - ic - 50), 24 + ic, h / 2 - 10);
    ctx.fillStyle = theme.textMuted;
    ctx.font = fontStr(500, 14, theme.font);
    ctx.fillText(truncate(ctx, props.subtitle, w - ic - 50), 24 + ic, h / 2 + 12);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  },
};

/* ---------- avatar + online dot ---------- */

export interface AvatarProps {
  initial: string;
  online: boolean;
}

const avatar: UIElementDef<AvatarProps> = {
  id: 'avatar',
  label: 'Avatar',
  category: 'Content',
  defaultProps: { initial: 'M', online: true },
  propsSchema: [
    { key: 'initial', kind: 'string', label: 'Initial', maxLength: 2 },
    { key: 'online', kind: 'boolean', label: 'Online' },
  ],
  naturalSize: { w: 90, h: 90 },
  draw(ctx, w, h, t, props, theme) {
    const p = clamp01(spr(t - 0.05, SP.bouncy));
    const cx = w / 2,
      cy = h / 2 + idleFloat(t, 1.4, 3.6);
    const r = (Math.min(w, h) / 2 - 4) * (0.7 + 0.3 * p);
    ctx.save();
    ctx.translate(cx, cy);
    elevationShadow(ctx, 0.14);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    const g = ctx.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, theme.primary);
    g.addColorStop(1, mixHex(theme.primary, theme.accent, 0.7));
    ctx.fillStyle = g;
    ctx.fill();
    clearShadow(ctx);
    ctx.fillStyle = theme.onPrimary;
    ctx.font = fontStr(700, r * 0.9, theme.font);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(props.initial.slice(0, 2).toUpperCase(), 0, r * 0.06);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    if (props.online) {
      const dotP = clamp01(spr(t - 0.35, SP.bouncy));
      const pulse = 1 + 0.12 * Math.sin(t * 3.2);
      ctx.beginPath();
      ctx.arc(r * 0.7, r * 0.7, r * 0.24 * dotP * pulse, 0, Math.PI * 2);
      ctx.fillStyle = theme.surface;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(r * 0.7, r * 0.7, r * 0.16 * dotP * pulse, 0, Math.PI * 2);
      ctx.fillStyle = theme.success;
      ctx.fill();
    }
    ctx.restore();
  },
};

/* ---------- story ring ---------- */

export interface StoryRingProps {
  initial: string;
}

const storyRing: UIElementDef<StoryRingProps> = {
  id: 'storyRing',
  label: 'Story ring',
  category: 'Content',
  defaultProps: { initial: 'K' },
  propsSchema: [{ key: 'initial', kind: 'string', label: 'Initial', maxLength: 2 }],
  naturalSize: { w: 100, h: 100 },
  draw(ctx, w, h, t, props, theme) {
    const cx = w / 2,
      cy = h / 2 + idleFloat(t, 1.2, 3.8);
    const outerR = Math.min(w, h) / 2 - 4;
    const sweep = clamp01(spr(t, SP.gentle));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineWidth = outerR * 0.11;
    ctx.lineCap = 'round';
    const grad = ctx.createConicGradient ? ctx.createConicGradient(-Math.PI / 2, 0, 0) : null;
    if (grad) {
      grad.addColorStop(0, theme.accent);
      grad.addColorStop(0.5, theme.primary);
      grad.addColorStop(1, theme.accent);
      ctx.strokeStyle = grad;
    } else {
      ctx.strokeStyle = theme.accent;
    }
    ctx.beginPath();
    ctx.arc(0, 0, outerR, -Math.PI / 2, -Math.PI / 2 + sweep * Math.PI * 2);
    ctx.stroke();

    const avatarR = outerR * 0.8;
    ctx.beginPath();
    ctx.arc(0, 0, avatarR, 0, Math.PI * 2);
    ctx.fillStyle = theme.primary;
    ctx.fill();
    ctx.fillStyle = theme.onPrimary;
    ctx.font = fontStr(700, avatarR * 0.85, theme.font);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(props.initial.slice(0, 2).toUpperCase(), 0, avatarR * 0.06);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  },
};

registerElement(card);
registerElement(listItem);
registerElement(avatar);
registerElement(storyRing);
