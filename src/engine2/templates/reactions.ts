/**
 * "Reactions" — chat app template. Ported from the reference's
 * `TEMPLATES.reactions` (build()+update()) into data: every number here is
 * a LayerDef + keyframe track, evaluated generically by evaluate.ts — there
 * is no per-frame imperative code for this template, matching task 2.
 */
import { buildCameraTrack } from '../camera';
import { registerRecipe } from '../sceneBuilder';
import { drawCard, drawStatusBar, roundRect, wrapEmojiRow } from '../texture';
import type { BuildContext, LayerDef, ParticleBurstDef, TemplateRecipeV2 } from '../types';

const SCREEN_W = 524;
const SCREEN_H = 1144;

registerRecipe('reactions-chrome', (ctx, w, h, _props, palette) => {
  ctx.fillStyle = '#F4F3FB';
  ctx.fillRect(0, 0, w, h);
  drawStatusBar(ctx, w, '#15161B');
  ctx.fillStyle = '#6D6E7A';
  ctx.font = '700 44px Figtree, sans-serif';
  ctx.fillText('‹', 32, 130);
  const grad = ctx.createLinearGradient(96, 90, 160, 154);
  grad.addColorStop(0, '#FFB86B');
  grad.addColorStop(1, '#FF5E8A');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(128, 122, 32, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#15161B';
  ctx.font = '700 30px Figtree, sans-serif';
  ctx.fillText('Maya', 176, 114);
  ctx.fillStyle = '#10A36B';
  ctx.font = '500 22px Figtree, sans-serif';
  ctx.fillText('online', 176, 146);
  roundRect(ctx, 24, h - 136, w - 48, 92, 46, '#FFFFFF');
  ctx.fillStyle = '#9A9DAA';
  ctx.font = '500 28px Figtree, sans-serif';
  ctx.fillText('Message', 58, h - 78);
  ctx.fillStyle = palette.ui;
  ctx.beginPath();
  ctx.arc(w - 24 - 35, h - 90, 35, 0, Math.PI * 2);
  ctx.fill();
});

interface BubbleProps {
  side: 'in' | 'out';
  text: string;
}
registerRecipe('reactions-bubble', (ctx, w, h, props, palette) => {
  const { side, text } = props as unknown as BubbleProps;
  const r: [number, number, number, number] = side === 'in' ? [36, 36, 36, 10] : [36, 36, 10, 36];
  ctx.fillStyle = side === 'in' ? '#FFFFFF' : palette.ui;
  roundRectVariable(ctx, 4, 4, w - 8, h - 8, r);
  ctx.fill();
  ctx.fillStyle = side === 'in' ? '#15161B' : '#FFFFFF';
  ctx.font = '500 30px Figtree, sans-serif';
  wrapText(ctx, text, 30, h / 2, w - 60, 36);
});

function roundRectVariable(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: [number, number, number, number]): void {
  ctx.beginPath();
  ctx.moveTo(x + r[0], y);
  ctx.lineTo(x + w - r[1], y);
  ctx.arcTo(x + w, y, x + w, y + r[1], r[1]);
  ctx.lineTo(x + w, y + h - r[2]);
  ctx.arcTo(x + w, y + h, x + w - r[2], y + h, r[2]);
  ctx.lineTo(x + r[3], y + h);
  ctx.arcTo(x, y + h, x, y + h - r[3], r[3]);
  ctx.lineTo(x, y + r[0]);
  ctx.arcTo(x, y, x + r[0], y, r[0]);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, cy: number, maxWidth: number, lineHeight: number): void {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  const startY = cy - ((lines.length - 1) * lineHeight) / 2;
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, x, startY + i * lineHeight));
  ctx.textBaseline = 'alphabetic';
}

registerRecipe('reactions-hero', (ctx, w, h, props, palette) => {
  const { text } = props as unknown as BubbleProps;
  drawCard(ctx, 4, 160, w - 8, h - 260, 36, '#FFFFFF');
  ctx.fillStyle = '#15161B';
  ctx.font = '500 30px Figtree, sans-serif';
  wrapText(ctx, text, 30, 160 + (h - 260) / 2, w - 60, 36);
  // reaction bar
  const barY = 40, barH = 100;
  roundRect(ctx, 0, barY, w, barH, barH / 2, '#FFFFFF');
  wrapEmojiRow(ctx, ['❤️', '😂', '🔥', '👍', '😮'], w / 2, barY + barH / 2, 52, 12);
  // badge
  roundRect(ctx, w - 150, h - 120, 130, 56, 28, '#FFFFFF');
  ctx.fillStyle = '#15161B';
  ctx.font = '700 26px Figtree, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('❤️ 1', w - 150 + 65, h - 120 + 28);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  void palette;
});

registerRecipe('cta', (ctx, w, h, _props, palette, texts) => {
  roundRect(ctx, 0, 0, w, h, h / 2, palette.ink);
  ctx.fillStyle = palette.base;
  ctx.font = '800 44px "Bricolage Grotesque", Figtree, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(texts[2].replace(/\*/g, ''), w / 2, h / 2 + 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
});

// y follows the same CSS-down convention as the camera/particle tracks
// (more negative = higher on screen) — chronological chat order top to
// bottom, oldest message (b0) highest.
const BUBBLES: Array<{ id: string; side: 'in' | 'out'; x: number; y: number; w: number; h: number; text: string }> = [
  { id: 'b0', side: 'in', x: -180, y: -376, w: 340, h: 130, text: 'Are we still on for tonight? 🍕' },
  { id: 'b1', side: 'out', x: 18, y: -236, w: 318, h: 120, text: 'Yes! Table for two at 8 ✨' },
  { id: 'b2', side: 'in', x: -180, y: -96, w: 300, h: 120, text: 'Perfect. Can’t wait 😍' },
  { id: 'b3', side: 'out', x: 44, y: 44, w: 292, h: 120, text: 'Bring your good mood 😎' },
];

function makeLayers(ctx: BuildContext): { layers: LayerDef[]; particles: ParticleBurstDef[] } {
  const layers: LayerDef[] = [];
  layers.push({
    id: 'chrome', label: 'Chat chrome', plane: 'device', content: { kind: 'ui-element', recipe: 'reactions-chrome', props: {} },
    width: SCREEN_W, height: SCREEN_H, overrides: {},
    transform: { x: { base: ctx.sign * 40, steps: [{ at: 0.25, to: 0, spring: 'snappy' }] } },
  });
  BUBBLES.forEach((b, i) => {
    layers.push({
      id: b.id, label: `Bubble ${i + 1}`, plane: 'device',
      content: { kind: 'ui-element', recipe: 'reactions-bubble', props: { side: b.side, text: b.text } },
      width: b.w, height: b.h, overrides: {},
      transform: {
        x: { base: b.x, steps: [] },
        y: { base: b.y, steps: [] },
        scale: { base: 0.55, steps: [{ at: 1.0 + i * 0.15, to: 1, spring: 'wobbly', scaleBy: 'stag' }] },
        opacity: { base: 0, steps: [{ at: 1.0 + i * 0.15, to: 1, spring: 'snappy', scaleBy: 'stag' }] },
      },
    });
  });
  // hero lift — duplicate of bubble 1, pops toward camera with reaction bar + badge.
  layers.push({
    id: 'hero', label: 'Reaction moment', plane: 'popout', liftOf: 'b1',
    content: { kind: 'ui-element', recipe: 'reactions-hero', props: { text: BUBBLES[1].text } },
    width: 420, height: 420, overrides: {},
    transform: {
      x: { base: BUBBLES[1].x, steps: [{ at: 2.6, to: BUBBLES[1].x - 36 * ctx.sign, spring: 'wobbly', scaleBy: 'R' }, { at: 6.6, to: BUBBLES[1].x - 12 * ctx.sign, spring: 'gentle' }] },
      y: { base: BUBBLES[1].y, steps: [{ at: 2.6, to: BUBBLES[1].y - 40, spring: 'wobbly' }] },
      z: { base: 0, steps: [{ at: 2.6, to: 290, spring: 'wobbly' }, { at: 6.6, to: 90, spring: 'gentle' }] },
      ry: { base: 0, steps: [{ at: 2.6, to: 14, spring: 'wobbly', scaleBy: 'R' }, { at: 6.6, to: 4, spring: 'gentle' }] },
      rx: { base: 0, steps: [{ at: 2.6, to: -7, spring: 'wobbly', scaleBy: 'R' }] },
      scale: { base: 1, steps: [{ at: 2.6, to: 1.14, spring: 'wobbly' }, { at: 6.6, to: 1.04, spring: 'gentle' }] },
      opacity: { base: 0, steps: [{ at: 2.6, to: 1, spring: 'snappy' }, { at: 6.9, to: 0, spring: 'snappy' }] },
    },
  });

  const particles: ParticleBurstDef[] = [
    { id: 'hearts', at: 4.35, count: 24, kind: 'hearts', originLayerId: 'hero', dir: -Math.PI / 2, spread: 2.4, speed: 480, gravity: 420, life: 1.5, seedOffset: 7 + ctx.seed },
  ];
  return { layers, particles };
}

export const reactionsTemplate: TemplateRecipeV2 = {
  id: 'reactions',
  label: 'Reactions',
  icon: '💬',
  sub: 'Chat app',
  defaultPalette: 'aurora',
  duration: 8.4,
  ctaAt: 6.5,
  beats: [[0.15, 4.55], [4.85, 99]],
  defaultTexts: ['Say more with *reactions*', 'Tap, hold, *react.*', 'Update now'],
  build(ctx) {
    const { layers, particles } = makeLayers(ctx);
    const camera = buildCameraTrack({
      zoom: { base: 1, steps: [{ at: 2.4, to: 1.14, spring: 'gentle' }, { at: 6.5, to: 1.0, spring: 'soft' }] },
      y: { base: 0, steps: [{ at: 2.4, to: 110, spring: 'gentle' }, { at: 6.5, to: 0, spring: 'soft' }] },
      ry: { base: 0, steps: [{ at: 5.0, to: -4 * ctx.sign, spring: 'soft' }, { at: 6.8, to: 0, spring: 'soft' }] },
    });
    return { layers, particles, camera };
  },
};
