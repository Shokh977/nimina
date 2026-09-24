/** Search bar: query types in, then result rows pop in, staggered. */
import { clamp01, spr, SP } from '../../spring';
import { elevationShadow, clearShadow, idleFloat, stagger, truncate, typedText } from '../draw';
import { registerElement } from '../registry';
import { fontStr } from '../theme';
import { roundRectPath } from '../../texture';
import type { UIElementDef } from '../types';

export interface SearchBarProps {
  query: string;
  results: string;
  charsPerSecond: number;
}

const searchBar: UIElementDef<SearchBarProps> = {
  id: 'searchBar',
  label: 'Search bar',
  category: 'Controls',
  defaultProps: { query: 'sneakers', results: 'Running shoes,Trail sneakers,Court classics', charsPerSecond: 12 },
  propsSchema: [
    { key: 'query', kind: 'string', label: 'Query', maxLength: 30 },
    { key: 'results', kind: 'string', label: 'Results (comma-separated)', maxLength: 100 },
    { key: 'charsPerSecond', kind: 'number', label: 'Type speed (chars/s)', min: 3, max: 30, step: 1 },
  ],
  naturalSize: { w: 300, h: 220 },
  draw(ctx, w, h, t, props, theme) {
    const barH = 48;
    const shown = typedText(t, props.query, 0.1, props.charsPerSecond);
    const typedDoneAt = 0.1 + props.query.length / props.charsPerSecond;

    ctx.save();
    ctx.translate(0, idleFloat(t, 1, 3.6));
    elevationShadow(ctx, 0.1);
    roundRectPath(ctx, 0, 0, w, barH, barH / 2);
    ctx.fillStyle = theme.surface;
    ctx.fill();
    clearShadow(ctx);

    ctx.strokeStyle = theme.textMuted;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(28, barH / 2 - 2, 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(33, barH / 2 + 3);
    ctx.lineTo(38, barH / 2 + 8);
    ctx.stroke();

    ctx.fillStyle = theme.text;
    ctx.font = fontStr(500, 17, theme.font);
    ctx.textBaseline = 'middle';
    const caretOn = Math.floor(t * 2.4) % 2 === 0;
    const label = shown + (shown.length < props.query.length && caretOn ? '|' : '');
    ctx.fillText(truncate(ctx, label, w - 70), 52, barH / 2 + 1);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();

    const results = props.results.split(',').map((s) => s.trim()).filter(Boolean);
    const rowH = 44;
    results.forEach((r, i) => {
      const at = typedDoneAt + 0.1 + stagger(i, 60);
      const p = clamp01(spr(t - at, SP.bouncy));
      const opacity = clamp01((t - at) * 6);
      if (opacity <= 0.01) return;
      const y = barH + 14 + i * rowH + (1 - p) * 14;
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = theme.textMuted;
      ctx.font = `16px "Apple Color Emoji","Segoe UI Emoji",sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.fillText('🔍', 4, y + rowH / 2 - 6);
      ctx.fillStyle = theme.text;
      ctx.font = fontStr(500, 16, theme.font);
      ctx.fillText(truncate(ctx, r, w - 40), 32, y + rowH / 2 - 6);
      ctx.textBaseline = 'alphabetic';
      ctx.restore();
    });
  },
};

registerElement(searchBar);
