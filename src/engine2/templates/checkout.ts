/**
 * "Checkout" — food delivery template, ported from the reference's
 * TEMPLATES.checkout the same way reactions.ts is: layers + keyframe
 * tracks, no per-frame template code. Two simplifications vs. the
 * reference, noted for /dev/compare's gap list: the loading spinner is a
 * static glyph crossfade rather than a continuously-rotating ring, and the
 * success checkmark pops in rather than stroke-drawing — both trade a
 * little motion fidelity for staying inside the same declarative
 * layer/keyframe model everything else uses (see docs/MOTION_GUIDE.md's
 * "continuous rotation" exception, which a real spin would fall under, but
 * needs render-loop-driven continuous rotation this data model doesn't
 * carry yet).
 */
import { buildCameraTrack } from '../camera';
import { registerRecipe } from '../sceneBuilder';
import { drawCard, drawStatusBar, roundRect } from '../texture';
import type { BuildContext, LayerDef, ParticleBurstDef, TemplateRecipeV2 } from '../types';

const SCREEN_W = 524;
const SCREEN_H = 1144;

function drawPizza(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const g = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#FAD06A');
  g.addColorStop(0.57, '#FAD06A');
  g.addColorStop(0.66, '#F2A65A');
  g.addColorStop(1, '#C8702F');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  const peps = [[-0.35, -0.4], [0.1, -0.55], [-0.45, 0.05], [0.15, 0.1], [-0.1, 0.45], [0.35, 0.3], [0.42, -0.15]];
  peps.forEach(([dx, dy]) => {
    ctx.fillStyle = '#B5361C';
    ctx.beginPath();
    ctx.arc(cx + dx * r, cy + dy * r, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#EF6A45';
    ctx.beginPath();
    ctx.arc(cx + dx * r - r * 0.03, cy + dy * r - r * 0.03, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
  });
}

registerRecipe('checkout-chrome', (ctx, w, h) => {
  ctx.fillStyle = '#FBF6F2';
  ctx.fillRect(0, 0, w, h);
  drawStatusBar(ctx, w, '#15161B');
  ctx.fillStyle = '#15161B';
  ctx.font = '800 46px "Bricolage Grotesque", Figtree, sans-serif';
  ctx.fillText('Your order', 36, 130);
  const rows: [string, string][] = [
    ['Subtotal', '$16.90'],
    ['Delivery', '$1.50'],
  ];
  ctx.font = '500 27px Figtree, sans-serif';
  ctx.fillStyle = '#4A4D58';
  let y = h - 340;
  rows.forEach(([label, val]) => {
    ctx.fillText(label, 36, y);
    ctx.textAlign = 'right';
    ctx.fillText(val, w - 36, y);
    ctx.textAlign = 'left';
    y += 52;
  });
  ctx.font = '800 27px Figtree, sans-serif';
  ctx.fillStyle = '#15161B';
  ctx.fillText('Total', 36, y);
  ctx.textAlign = 'right';
  ctx.fillText('$18.40', w - 36, y);
  ctx.textAlign = 'left';
});

registerRecipe('checkout-card', (ctx, w, h) => {
  drawCard(ctx, 0, 0, w, h, 40, '#FFFFFF');
  drawPizza(ctx, w / 2, h * 0.32, h * 0.3);
  ctx.fillStyle = '#15161B';
  ctx.font = '700 34px Figtree, sans-serif';
  ctx.fillText('Pepperoni', 30, h * 0.72);
  ctx.fillStyle = '#6B6F7D';
  ctx.font = '500 23px Figtree, sans-serif';
  ctx.fillText('Large, 12in, stone baked', 30, h * 0.72 + 40);
});

interface PayProps {
  state: 'idle' | 'loading' | 'success';
}
registerRecipe('checkout-pay', (ctx, w, h, props, palette) => {
  const { state } = props as unknown as PayProps;
  roundRect(ctx, 0, 0, w, h, h / 2, state === 'success' ? '#16B364' : palette.ui);
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (state === 'loading') {
    ctx.font = '700 34px Figtree, sans-serif';
    ctx.fillText('◌', w / 2, h / 2);
  } else if (state === 'success') {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(w / 2 - 26, h / 2);
    ctx.lineTo(w / 2 - 6, h / 2 + 20);
    ctx.lineTo(w / 2 + 30, h / 2 - 22);
    ctx.stroke();
  } else {
    ctx.font = '800 34px Figtree, sans-serif';
    ctx.fillText('Pay $18.40', w / 2, h / 2 + 2);
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
});

registerRecipe('checkout-sticker', (ctx, w, h, props) => {
  const { text, accent } = props as unknown as { text: string; accent?: boolean };
  roundRect(ctx, 0, 0, w, h, h / 2, accent ? '#FF4F2E' : '#FFFFFF');
  ctx.fillStyle = accent ? '#FFFFFF' : '#15161B';
  ctx.font = '700 26px Figtree, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 1);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
});

registerRecipe('checkout-notif', (ctx, w, h) => {
  roundRect(ctx, 0, 0, w, h, h / 2, 'rgba(255,255,255,0.97)');
  ctx.fillStyle = '#FF4F2E';
  const ic = h * 0.7;
  roundRect(ctx, 18, (h - ic) / 2, ic, ic, ic * 0.3, '#FF4F2E');
  ctx.font = `${ic * 0.55}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🛵', 18 + ic / 2, h / 2);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#15161B';
  ctx.font = '700 26px Figtree, sans-serif';
  ctx.fillText('Your pizza is on the way', 18 + ic + 18, h / 2 - 12);
  ctx.fillStyle = '#5E6372';
  ctx.font = '500 22px Figtree, sans-serif';
  ctx.fillText('Arriving in 18 min', 18 + ic + 18, h / 2 + 18);
  ctx.textBaseline = 'alphabetic';
});

// y: CSS-down convention (negative = above screen center), scattered
// around the pizza card (y=-150).
const STICKERS: Array<{ id: string; text: string; accent?: boolean; x: number; y: number; z: number }> = [
  { id: 'st0', text: '🔥 Most ordered', x: -260, y: -330, z: -70 },
  { id: 'st1', text: '⭐ 4.9', accent: true, x: 90, y: -280, z: 170 },
  { id: 'st2', text: '+ Extra cheese', x: -30, y: -50, z: 90 },
];

function makeLayers(ctx: BuildContext): { layers: LayerDef[]; particles: ParticleBurstDef[] } {
  const layers: LayerDef[] = [
    { id: 'chrome', label: 'Order chrome', plane: 'device', content: { kind: 'ui-element', recipe: 'checkout-chrome', props: {} }, width: SCREEN_W, height: SCREEN_H, overrides: {},
      transform: { x: { base: ctx.sign * 900, steps: [{ at: 0.2, to: 0, spring: 'snappy' }] } } },
    { id: 'card', label: 'Pizza card', plane: 'device', content: { kind: 'ui-element', recipe: 'checkout-card', props: {} }, width: 480, height: 430, overrides: {},
      transform: {
        x: { base: 0, steps: [] }, y: { base: -150, steps: [] },
        z: { base: 0, steps: [{ at: 1.6, to: 250, spring: 'wobbly' }, { at: 3.5, to: 0, spring: 'snappy' }] },
        scale: { base: 1, steps: [{ at: 1.6, to: 1.08, spring: 'wobbly' }, { at: 3.5, to: 1, spring: 'snappy' }] },
        ry: { base: 0, steps: [{ at: 1.6, to: 13 * ctx.sign, spring: 'wobbly', scaleBy: 'R' }, { at: 3.5, to: 0, spring: 'snappy' }] },
      } },
    { id: 'pay', label: 'Pay button', plane: 'device', content: { kind: 'ui-element', recipe: 'checkout-pay', props: { state: 'idle' } }, width: 480, height: 112, overrides: {},
      transform: { x: { base: 0, steps: [] }, y: { base: 420, steps: [] }, scale: { base: 1, steps: [{ at: 4.72, to: 0.95, spring: 'snappy' }, { at: 4.88, to: 1, spring: 'wobbly' }] } } },
    { id: 'payLoading', label: 'Pay button (loading)', plane: 'device', content: { kind: 'ui-element', recipe: 'checkout-pay', props: { state: 'loading' } }, width: 480, height: 112, overrides: {},
      transform: { x: { base: 0, steps: [] }, y: { base: 420, steps: [] }, opacity: { base: 0, steps: [{ at: 4.95, to: 1, spring: 'snappy' }, { at: 5.6, to: 0, spring: 'snappy' }] } } },
    { id: 'paySuccess', label: 'Pay button (success)', plane: 'device', content: { kind: 'ui-element', recipe: 'checkout-pay', props: { state: 'success' } }, width: 480, height: 112, overrides: {},
      transform: { x: { base: 0, steps: [] }, y: { base: 420, steps: [] }, opacity: { base: 0, steps: [{ at: 5.6, to: 1, spring: 'snappy' }] } } },
  ];
  STICKERS.forEach((s, i) => {
    layers.push({
      id: s.id, label: `Sticker ${i + 1}`, plane: 'popout', content: { kind: 'ui-element', recipe: 'checkout-sticker', props: { text: s.text, accent: s.accent } },
      width: 260, height: 76, overrides: {},
      transform: {
        x: { base: s.x, steps: [] }, y: { base: s.y, steps: [] }, z: { base: s.z, steps: [] },
        scale: { base: 0, steps: [{ at: 2.2 + i * 0.12, to: 1, spring: 'wobbly', scaleBy: 'stag' }] },
        rz: { base: (i - 1) * 5, steps: [], float: { amp: 2, period: 1.8, phase: i } },
        opacity: { base: 0, steps: [{ at: 2.2 + i * 0.12, to: 1, spring: 'snappy', scaleBy: 'stag' }, { at: 3.2 + i * 0.04, to: 0, spring: 'snappy' }] },
      },
    });
  });
  layers.push({
    id: 'notif', label: 'Delivery notification', plane: 'popout', content: { kind: 'ui-element', recipe: 'checkout-notif', props: {} }, width: 488, height: 144, overrides: {},
    transform: {
      x: { base: 0, steps: [] }, y: { base: -650, steps: [{ at: 6.1, to: -480, spring: 'wobbly' }] }, z: { base: 70, steps: [] },
      opacity: { base: 0, steps: [{ at: 6.1, to: 1, spring: 'snappy' }, { at: 8.1, to: 0, spring: 'snappy' }] },
    },
  });
  const particles: ParticleBurstDef[] = [
    { id: 'confetti', at: 5.7, count: 30, kind: 'confetti', originLayerId: 'pay', dir: -Math.PI / 2, spread: 2.2, speed: 700, gravity: 1200, life: 1.9, seedOffset: 3 + ctx.seed },
  ];
  return { layers, particles };
}

export const checkoutTemplate: TemplateRecipeV2 = {
  id: 'checkout',
  label: 'Checkout',
  icon: '🍕',
  sub: 'Food delivery',
  defaultPalette: 'sunset',
  duration: 8.6,
  ctaAt: 6.9,
  beats: [[0.15, 3.55], [6.05, 99]],
  defaultTexts: ['Checkout in *one tap*', 'Arrives in *18 min*', 'Order now'],
  build(ctx) {
    const { layers, particles } = makeLayers(ctx);
    const camera = buildCameraTrack({
      zoom: { base: 1, steps: [{ at: 1.5, to: 1.06, spring: 'gentle' }, { at: 3.8, to: 1.3, spring: 'gentle' }, { at: 5.85, to: 1.0, spring: 'soft' }] },
      x: { base: 0, steps: [{ at: 3.8, to: 20 * ctx.sign, spring: 'gentle' }, { at: 5.85, to: 0, spring: 'soft' }] },
      y: { base: 0, steps: [{ at: 3.8, to: -560, spring: 'gentle' }, { at: 5.85, to: 0, spring: 'soft' }] },
      rx: { base: 0, steps: [{ at: 3.8, to: 5, spring: 'gentle' }, { at: 5.85, to: 0, spring: 'soft' }] },
    });
    return { layers, particles, camera };
  },
};
