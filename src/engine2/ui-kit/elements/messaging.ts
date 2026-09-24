/**
 * Chat bubble (incoming/outgoing, typing indicator, text-types-in).
 * Notification banner/toast/badge/bell live in notification.ts — this file
 * is bubbles specifically since they share the tail-corner shape + text
 * layout code.
 */
import { anticipatePop, elevationShadow, clearShadow, idleFloat, roundRectVariablePath, typedText, wrapLines } from '../draw';
import { registerElement } from '../registry';
import { fontStr } from '../theme';
import type { UIElementDef } from '../types';

export interface ChatBubbleProps {
  direction: 'incoming' | 'outgoing';
  text: string;
  typing: boolean;
  typeIn: boolean;
  charsPerSecond: number;
}

const bubbleCorners = (dir: ChatBubbleProps['direction']): [number, number, number, number] => (dir === 'incoming' ? [10, 26, 26, 26] : [26, 10, 26, 26]);

function drawTypingDots(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number, color: string): void {
  const dotR = 5;
  for (let i = 0; i < 3; i++) {
    const phase = t * 5 - i * 0.9;
    const bounce = Math.max(0, Math.sin(phase)) ** 1.5;
    ctx.beginPath();
    ctx.arc(cx + (i - 1) * dotR * 3, cy - bounce * 6, dotR, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.45 + 0.55 * bounce;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

const chatBubble: UIElementDef<ChatBubbleProps> = {
  id: 'chatBubble',
  label: 'Chat bubble',
  category: 'Messaging',
  defaultProps: { direction: 'incoming', text: 'Did you see the update? 👀', typing: false, typeIn: true, charsPerSecond: 22 },
  propsSchema: [
    { key: 'direction', kind: 'select', label: 'Direction', options: [{ value: 'incoming', label: 'Incoming' }, { value: 'outgoing', label: 'Outgoing' }] },
    { key: 'text', kind: 'string', label: 'Text', maxLength: 140 },
    { key: 'typing', kind: 'boolean', label: 'Typing indicator' },
    { key: 'typeIn', kind: 'boolean', label: 'Type text in' },
    { key: 'charsPerSecond', kind: 'number', label: 'Type speed (chars/s)', min: 4, max: 60, step: 1 },
  ],
  naturalSize: { w: 360, h: 140 },
  draw(ctx, w, h, t, props, theme) {
    const pop = anticipatePop(t, 0.05);
    const scale = Math.max(0.001, pop);
    const isOut = props.direction === 'outgoing';
    ctx.save();
    ctx.translate(w / 2, h / 2 + idleFloat(t, 1.4, 3.6, isOut ? 1.1 : 0));
    ctx.scale(scale, scale);
    ctx.translate(-w / 2, -h / 2);

    const bw = w - 20,
      bh = h - 20,
      bx = isOut ? 20 : 0,
      by = 10;
    elevationShadow(ctx, 0.12);
    roundRectVariablePath(ctx, bx, by, bw, bh, bubbleCorners(props.direction));
    ctx.fillStyle = isOut ? theme.primary : theme.surface;
    ctx.fill();
    clearShadow(ctx);

    ctx.fillStyle = isOut ? theme.onPrimary : theme.text;
    if (props.typing) {
      drawTypingDots(ctx, bx + bw / 2, by + bh / 2, t, isOut ? theme.onPrimary : theme.textMuted);
    } else {
      const shown = props.typeIn ? typedText(t, props.text, 0.15, props.charsPerSecond) : props.text;
      ctx.font = fontStr(500, 18, theme.font);
      const lines = wrapLines(ctx, shown, bw - 32, 4);
      const lh = 24;
      const startY = by + bh / 2 - ((lines.length - 1) * lh) / 2;
      ctx.textBaseline = 'middle';
      lines.forEach((line, i) => ctx.fillText(line, bx + 16, startY + i * lh));
      ctx.textBaseline = 'alphabetic';
    }
    ctx.restore();
  },
};

registerElement(chatBubble);
