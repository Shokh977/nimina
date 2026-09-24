/**
 * /dev/engine2's showcase scene: a tilted phone on a mesh-gradient
 * background, a chat screenshot inside, three chat-bubble *cutouts*
 * (task's literal ask — rectangles cropped from the one screenshot, not
 * separately-drawn duplicates) lifting out one by one with bouncy springs
 * and parallax, a heart burst, camera push-in with growing DOF, and a
 * line-by-line kinetic headline. Built the same way every other template
 * is (LayerDef + keyframe tracks, evaluated generically) so it isn't a
 * special case — it's proof the cutout/mesh-gradient additions work.
 */
import { buildCameraTrack } from '../camera';
import { PULSE_SPARK_LOTTIE } from '../lottieSamples';
import { registerRecipe } from '../sceneBuilder';
import { drawCard, drawStatusBar, roundRect } from '../texture';
import type { BuildContext, LayerDef, ParticleBurstDef, TemplateRecipeV2 } from '../types';

const SOURCE_W = 524;
const SOURCE_H = 1144;

/** Bubble bounding boxes within the full chat screenshot — the same
 * numbers drive both the drawing and each cutout's rectUv, so the crop
 * always lines up exactly with what's drawn. */
const BUBBLE_RECTS = {
  a: { x: 24, y: 210, w: 344, h: 116 },
  b: { x: 168, y: 348, w: 300, h: 104 },
  c: { x: 24, y: 474, w: 296, h: 104 },
} as const;

function rectUv(r: { x: number; y: number; w: number; h: number }): [number, number, number, number] {
  return [r.x / SOURCE_W, r.y / SOURCE_H, r.w / SOURCE_W, r.h / SOURCE_H];
}

function bubble(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, side: 'in' | 'out', text: string, uiColor: string): void {
  ctx.fillStyle = side === 'in' ? '#FFFFFF' : uiColor;
  roundRect(ctx, r.x, r.y, r.w, r.h, 30, ctx.fillStyle as string);
  ctx.fillStyle = side === 'in' ? '#15161B' : '#FFFFFF';
  ctx.font = '500 28px Figtree, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, r.x + 28, r.y + r.h / 2);
  ctx.textBaseline = 'alphabetic';
}

registerRecipe('showcase-chat-full', (ctx, w, h, _props, palette) => {
  ctx.fillStyle = '#F4F3FB';
  ctx.fillRect(0, 0, w, h);
  drawStatusBar(ctx, w, '#15161B');
  ctx.fillStyle = '#15161B';
  ctx.font = '700 30px Figtree, sans-serif';
  ctx.fillText('Team chat', 32, 118);
  ctx.fillStyle = '#10A36B';
  ctx.font = '500 22px Figtree, sans-serif';
  ctx.fillText('3 people typing…', 32, 150);

  bubble(ctx, BUBBLE_RECTS.a, 'in', 'Did you see the update? 👀', palette.ui);
  bubble(ctx, BUBBLE_RECTS.b, 'out', "It's so good 😍", palette.ui);
  bubble(ctx, BUBBLE_RECTS.c, 'in', "Can't stop reacting", palette.ui);

  roundRect(ctx, 24, h - 128, w - 48, 88, 44, '#FFFFFF');
  ctx.fillStyle = '#9A9DAA';
  ctx.font = '500 26px Figtree, sans-serif';
  ctx.fillText('Message', 56, h - 76);
  ctx.fillStyle = palette.ui;
  ctx.beginPath();
  ctx.arc(w - 24 - 33, h - 84, 33, 0, Math.PI * 2);
  ctx.fill();
});

registerRecipe('showcase-veil', (ctx, w, h) => {
  ctx.fillStyle = '#050308';
  ctx.fillRect(0, 0, w, h);
});

registerRecipe('showcase-badge', (ctx, w, h, _props, palette) => {
  drawCard(ctx, 0, 0, w, h, h / 2, '#FFFFFF');
  ctx.font = `${h * 0.55}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('❤️', w / 2, h / 2);
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

function makeLayers(ctx: BuildContext): { layers: LayerDef[]; particles: ParticleBurstDef[] } {
  const layers: LayerDef[] = [
    {
      id: 'chat',
      label: 'Chat screenshot',
      plane: 'device',
      content: { kind: 'ui-element', recipe: 'showcase-chat-full', props: {} },
      width: SOURCE_W,
      height: SOURCE_H,
      overrides: {},
      transform: {
        y: { base: -1400, steps: [{ at: 0.15, to: 0, spring: 'snappy' }] },
        rz: { base: 3, steps: [] },
      },
    },
    // A dark veil over the screen while the bubbles are popped out — "one
    // focal point at a time; dim... everything else during a hero moment."
    {
      id: 'veil',
      label: 'Focus veil',
      plane: 'device',
      content: { kind: 'ui-element', recipe: 'showcase-veil', props: {} },
      width: SOURCE_W,
      height: SOURCE_H,
      overrides: {},
      transform: { z: { base: 6, steps: [] }, opacity: { base: 0, steps: [{ at: 1.6, to: 0.4, spring: 'gentle' }, { at: 6.8, to: 0, spring: 'snappy' }] } },
    },
  ];

  const bubbleDefs: Array<{ id: string; rect: { x: number; y: number; w: number; h: number }; at: number; dx: number; dy: number; z: number }> = [
    { id: 'cut-a', rect: BUBBLE_RECTS.a, at: 1.7, dx: -70, dy: -40, z: 220 },
    { id: 'cut-b', rect: BUBBLE_RECTS.b, at: 2.15, dx: 60, dy: 10, z: 300 },
    { id: 'cut-c', rect: BUBBLE_RECTS.c, at: 2.6, dx: -50, dy: 90, z: 260 },
  ];
  bubbleDefs.forEach((b, i) => {
    // Rest position: bubble's own center within the source, converted to
    // the same screen-centered CSS-down coordinate space every other layer
    // uses (source origin is top-left, SOURCE_W/H is the full screen).
    const restX = b.rect.x + b.rect.w / 2 - SOURCE_W / 2;
    const restY = b.rect.y + b.rect.h / 2 - SOURCE_H / 2;
    layers.push({
      id: b.id,
      label: `Bubble cutout ${i + 1}`,
      plane: 'popout',
      content: { kind: 'cutout', sourceRecipe: 'showcase-chat-full', sourceProps: {}, rectUv: rectUv(b.rect), radiusPx: 30 },
      width: b.rect.w,
      height: b.rect.h,
      overrides: {},
      transform: {
        x: { base: restX, steps: [{ at: b.at, to: restX + b.dx * ctx.sign, spring: 'bouncy', scaleBy: 'R' }] },
        y: { base: restY, steps: [{ at: b.at, to: restY + b.dy, spring: 'bouncy' }], float: { amp: 6, period: 3.4 + i * 0.4, phase: i * 2 } },
        z: { base: 0, steps: [{ at: b.at, to: b.z, spring: 'bouncy' }] },
        ry: { base: 0, steps: [{ at: b.at, to: 10 * ctx.sign * (i % 2 === 0 ? 1 : -1), spring: 'wobbly', scaleBy: 'R' }] },
        scale: { base: 0.001, steps: [{ at: b.at, to: 1, spring: 'bouncy' }] },
      },
    });
  });

  // Demonstrates the remaining new layer content kinds (task 2) — a
  // decorative vector 'shape', a single-emoji 'sticker', a 'lottie'
  // animation, and a 'particles' anchor layer (distinct from the hearts
  // burst above, which anchors to an existing cutout layer instead).
  layers.push({
    id: 'accentRing',
    label: 'Accent ring (shape)',
    plane: 'device',
    content: { kind: 'shape', props: { shape: 'ring', fill: 'none', stroke: 'accent', strokeWidth: 10, ringThickness: 0.14 } },
    width: 620,
    height: 620,
    overrides: {},
    transform: {
      y: { base: -260, steps: [] },
      z: { base: -260, steps: [] },
      opacity: { base: 0, steps: [{ at: 0.6, to: 0.28, spring: 'gentle' }] },
      rz: { base: 0, steps: [{ at: 0.6, to: 24, spring: 'soft' }], float: { amp: 3, period: 6, phase: 0 } },
    },
  });
  layers.push({
    id: 'sparkleSticker',
    label: 'Sparkle (sticker)',
    plane: 'popout',
    content: { kind: 'sticker', props: { emoji: '✨' } },
    width: 96,
    height: 96,
    overrides: {},
    transform: {
      x: { base: BUBBLE_RECTS.a.x - SOURCE_W / 2 - 70 * ctx.sign, steps: [] },
      y: { base: BUBBLE_RECTS.a.y + BUBBLE_RECTS.a.h / 2 - SOURCE_H / 2 - 90, steps: [] },
      z: { base: 240, steps: [] },
      scale: { base: 0.001, steps: [{ at: 4.2, to: 1, spring: 'bouncy' }] },
      opacity: { base: 0, steps: [{ at: 4.2, to: 1, spring: 'snappy' }, { at: 5.1, to: 0, spring: 'snappy' }] },
      rz: { base: -8, steps: [], float: { amp: 5, period: 2.6, phase: 1 } },
    },
  });
  layers.push({
    id: 'pulseLottie',
    label: 'Pulse (lottie)',
    plane: 'popout',
    content: { kind: 'lottie', props: { data: PULSE_SPARK_LOTTIE, loop: true } },
    width: 120,
    height: 120,
    overrides: {},
    transform: {
      x: { base: BUBBLE_RECTS.c.x + BUBBLE_RECTS.c.w - SOURCE_W / 2 + 40 * ctx.sign, steps: [] },
      y: { base: BUBBLE_RECTS.c.y + BUBBLE_RECTS.c.h / 2 - SOURCE_H / 2, steps: [] },
      z: { base: 210, steps: [] },
      scale: { base: 0.001, steps: [{ at: 5.6, to: 1, spring: 'bouncy' }] },
      opacity: { base: 0, steps: [{ at: 5.6, to: 1, spring: 'snappy' }, { at: 6.5, to: 0, spring: 'snappy' }] },
    },
  });
  layers.push({
    id: 'confettiAnchor',
    label: 'Confetti anchor',
    plane: 'popout',
    content: { kind: 'particles' },
    width: 4,
    height: 4,
    overrides: {},
    transform: { x: { base: 0, steps: [] }, y: { base: -SOURCE_H / 2 + 80, steps: [] }, z: { base: 160, steps: [] } },
  });

  const particles: ParticleBurstDef[] = [
    { id: 'hearts', at: 2.5, count: 26, kind: 'hearts', originLayerId: 'cut-b', dir: -Math.PI / 2, spread: 2.3, speed: 460, gravity: 380, life: 1.6, seedOffset: 11 + ctx.seed },
    { id: 'confetti', at: 5.3, count: 30, kind: 'confetti', originLayerId: 'confettiAnchor', dir: -Math.PI / 2, spread: 2.6, speed: 620, gravity: 900, life: 1.7, seedOffset: 23 + ctx.seed },
  ];

  return { layers, particles };
}

export const showcaseTemplate: TemplateRecipeV2 = {
  id: 'showcase',
  label: 'Reactions Showcase',
  icon: '✨',
  sub: 'Engine v2 feature demo',
  defaultPalette: 'aurora',
  duration: 8.0,
  ctaAt: 6.6,
  beats: [[0.35, 5.0]],
  defaultTexts: ['*Reactions* are here', '', 'Update now'],
  build(ctx) {
    const { layers, particles } = makeLayers(ctx);
    const camera = buildCameraTrack({
      zoom: { base: 1, steps: [{ at: 1.5, to: 1.22, spring: 'gentle' }, { at: 6.6, to: 1.0, spring: 'soft' }] },
      y: { base: 60, steps: [{ at: 1.5, to: -40, spring: 'gentle' }, { at: 6.6, to: 60, spring: 'soft' }] },
      ry: { base: 0, steps: [{ at: 3.0, to: 3 * ctx.sign, spring: 'soft' }, { at: 5.5, to: -3 * ctx.sign, spring: 'soft' }, { at: 6.6, to: 0, spring: 'soft' }] },
    });
    return { layers, particles, camera };
  },
};
