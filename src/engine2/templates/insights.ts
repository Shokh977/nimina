/**
 * "Insights" — stats/health template, ported from the reference's
 * TEMPLATES.insights the same way reactions.ts/checkout.ts are.
 */
import { buildCameraTrack } from '../camera';
import { registerRecipe } from '../sceneBuilder';
import { drawCard, drawStatusBar, roundRect } from '../texture';
import type { BuildContext, LayerDef, TemplateRecipeV2 } from '../types';

const SCREEN_W = 524;
const SCREEN_H = 1144;
const BAR_VALS = [0.55, 0.78, 0.62, 0.95, 0.7, 0.42, 0.86];
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

registerRecipe('insights-chrome', (ctx, w, h) => {
  ctx.fillStyle = '#F1F6F4';
  ctx.fillRect(0, 0, w, h);
  drawStatusBar(ctx, w, '#15161B');
  ctx.fillStyle = '#15161B';
  ctx.font = '800 46px "Bricolage Grotesque", Figtree, sans-serif';
  ctx.fillText('This week', 36, 130);
  const grad = ctx.createLinearGradient(w - 100, 60, w - 40, 120);
  grad.addColorStop(0, '#6EE7B7');
  grad.addColorStop(1, '#3B82F6');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(w - 70, 90, 33, 0, Math.PI * 2);
  ctx.fill();
});

registerRecipe('insights-summary', (ctx, w, h) => {
  drawCard(ctx, 0, 0, w, h, 30, '#FFFFFF');
  ctx.fillStyle = '#15161B';
  ctx.font = '800 58px "Bricolage Grotesque", Figtree, sans-serif';
  ctx.fillText('8,432', 30, h * 0.5);
  ctx.fillStyle = '#6B6F7D';
  ctx.font = '500 22px Figtree, sans-serif';
  ctx.fillText('average steps a day', 32, h * 0.5 + 38);
  roundRect(ctx, w - 130, 20, 110, 44, 22, '#DCF5EA');
  ctx.fillStyle = '#0B7A55';
  ctx.font = '800 22px Figtree, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('+24%', w - 75, 46);
  ctx.textAlign = 'left';
});

registerRecipe('insights-chart', (ctx, w, h, _props, palette) => {
  drawCard(ctx, 0, 0, w, h, 36, '#FFFFFF');
  ctx.fillStyle = '#15161B';
  ctx.font = '700 28px Figtree, sans-serif';
  ctx.fillText('Daily steps', 32, 44);
  ctx.fillStyle = '#6B6F7D';
  ctx.font = '500 21px Figtree, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('This week', w - 32, 46);
  ctx.textAlign = 'left';
  const baseY = h - 60;
  BAR_VALS.forEach((v, i) => {
    const bw = 40, bx = 40 + i * ((w - 80) / 7), bh = v * (h - 180);
    ctx.fillStyle = i === 3 ? palette.ui : '#DDE7E3';
    roundRect(ctx, bx, baseY - bh, bw, bh, 14, ctx.fillStyle as string);
    ctx.fillStyle = '#8A8E9B';
    ctx.font = '600 20px Figtree, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(DAYS[i], bx + bw / 2, h - 24);
    ctx.textAlign = 'left';
  });
  ctx.strokeStyle = '#15161B';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  BAR_VALS.forEach((v, i) => {
    const bx = 40 + i * ((w - 80) / 7) + 20;
    const y = baseY - v * (h - 180) - 20;
    if (i === 0) ctx.moveTo(bx, y);
    else ctx.lineTo(bx, y);
  });
  ctx.stroke();
});

registerRecipe('insights-ring', (ctx, w, h, _props, palette) => {
  drawCard(ctx, 0, 0, w, h, 30, '#FFFFFF');
  const cx = 110, cy = h / 2, r = 62;
  ctx.strokeStyle = '#E3ECE8';
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = palette.ui;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + 0.78 * Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#15161B';
  ctx.font = '800 52px "Bricolage Grotesque", Figtree, sans-serif';
  ctx.fillText('78%', cx + 100, cy - 8);
  ctx.fillStyle = '#6B6F7D';
  ctx.font = '500 22px Figtree, sans-serif';
  ctx.fillText('of weekly goal', cx + 100, cy + 28);
});

registerRecipe('insights-statcard', (ctx, w, h, props) => {
  const { emoji, big, small } = props as unknown as { emoji: string; big: string; small: string };
  drawCard(ctx, 0, 0, w, h, 34, 'rgba(255,255,255,0.96)');
  ctx.font = '44px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
  ctx.fillText(emoji, 28, 60);
  ctx.fillStyle = '#15161B';
  ctx.font = '800 52px "Bricolage Grotesque", Figtree, sans-serif';
  ctx.fillText(big, 28, h - 60);
  ctx.fillStyle = '#5E6372';
  ctx.font = '500 22px Figtree, sans-serif';
  ctx.fillText(small, 28, h - 24);
});

// y: CSS-down convention, same as everywhere else in this file.
const STAT_CARDS: Array<{ id: string; emoji: string; big: string; small: string; x: number; y: number; z: number }> = [
  { id: 'sc0', emoji: '📈', big: '+24%', small: 'vs last week', x: -170, y: -240, z: 150 },
  { id: 'sc1', emoji: '🔥', big: '12', small: 'day streak', x: 210, y: -80, z: 90 },
  { id: 'sc2', emoji: '🏆', big: 'Sat', small: 'best day, 11,204', x: -150, y: 370, z: 190 },
];

function makeLayers(ctx: BuildContext): { layers: LayerDef[] } {
  const layers: LayerDef[] = [
    { id: 'chrome', label: 'Header', plane: 'device', content: { kind: 'ui-element', recipe: 'insights-chrome', props: {} }, width: SCREEN_W, height: SCREEN_H, overrides: {}, transform: {} },
    { id: 'summary', label: 'Summary card', plane: 'device', content: { kind: 'ui-element', recipe: 'insights-summary', props: {} }, width: 480, height: 132, overrides: {},
      transform: { y: { base: -320, steps: [] } } },
    { id: 'chart', label: 'Steps chart', plane: 'device', content: { kind: 'ui-element', recipe: 'insights-chart', props: {} }, width: 480, height: 400, overrides: {},
      transform: {
        y: { base: -30, steps: [] },
        z: { base: 0, steps: [{ at: 2.4, to: 330, spring: 'wobbly' }, { at: 5.9, to: 0, spring: 'snappy' }] },
        ry: { base: 0, steps: [{ at: 2.4, to: -11 * ctx.sign, spring: 'wobbly', scaleBy: 'R' }, { at: 5.9, to: 0, spring: 'snappy' }] },
        rx: { base: 0, steps: [{ at: 2.4, to: -6, spring: 'wobbly', scaleBy: 'R' }, { at: 5.9, to: 0, spring: 'snappy' }] },
        scale: { base: 1, steps: [{ at: 2.4, to: 1.12, spring: 'wobbly' }, { at: 5.9, to: 1, spring: 'snappy' }] },
      } },
    { id: 'ring', label: 'Goal ring', plane: 'device', content: { kind: 'ui-element', recipe: 'insights-ring', props: {} }, width: 480, height: 200, overrides: {},
      transform: { y: { base: 290, steps: [] } } },
  ];
  STAT_CARDS.forEach((s, i) => {
    const left = ctx.sign > 0 ? s.x : -s.x;
    layers.push({
      id: s.id, label: `Stat card ${i + 1}`, plane: 'popout', content: { kind: 'ui-element', recipe: 'insights-statcard', props: { emoji: s.emoji, big: s.big, small: s.small } },
      width: 300, height: 190, overrides: {},
      transform: {
        x: { base: left, steps: [] }, y: { base: s.y, steps: [] }, z: { base: s.z, steps: [] },
        scale: { base: 0.6, steps: [{ at: 3.3 + i * 0.16, to: 1, spring: 'wobbly', scaleBy: 'stag' }] },
        rz: { base: (i - 1) * 5 * ctx.sign, steps: [] },
        ry: { base: -ctx.sign * 8, steps: [] },
        opacity: { base: 0, steps: [{ at: 3.3 + i * 0.16, to: 1, spring: 'snappy', scaleBy: 'stag' }, { at: 6.1 + i * 0.05, to: 0, spring: 'snappy' }] },
      },
    });
  });
  return { layers };
}

export const insightsTemplate: TemplateRecipeV2 = {
  id: 'insights',
  label: 'Insights',
  icon: '📈',
  sub: 'Stats & health',
  defaultPalette: 'mint',
  duration: 8.2,
  ctaAt: 6.6,
  beats: [[0.15, 4.4], [4.75, 99]],
  defaultTexts: ['Your week, *beautifully clear*', 'Stay on *streak* 🔥', 'Try it free'],
  build(ctx) {
    const { layers } = makeLayers(ctx);
    const camera = buildCameraTrack({
      zoom: { base: 1, steps: [{ at: 2.3, to: 1.1, spring: 'gentle' }, { at: 5.9, to: 1.0, spring: 'soft' }] },
      y: { base: 0, steps: [{ at: 2.3, to: -20, spring: 'gentle' }, { at: 5.9, to: 0, spring: 'soft' }] },
      rx: { base: 0, steps: [{ at: 3.2, to: -3, spring: 'soft' }, { at: 6.0, to: 0, spring: 'soft' }] },
      ry: { base: 0, steps: [{ at: 3.2, to: 7 * ctx.sign, spring: 'soft' }, { at: 5.4, to: -5 * ctx.sign, spring: 'soft' }, { at: 7.0, to: 0, spring: 'soft' }] },
    });
    return { layers, particles: [], camera };
  },
};
