/**
 * Shared builders every recipe in builtInRecipes.ts composes from — one
 * place for "a device layer showing screenshot N", "a cutout lifted from
 * screenshot N", "a CTA pill", etc., so each recipe file stays a short
 * description of *structure and variation*, not repeated plumbing.
 */
import { registerRecipe } from './sceneBuilder';
import { fontStr } from './ui-kit/theme';
import { roundRectPath } from './texture';
import type { HeadlineBeat, LayerDef, ParticleBurstDef, PropertyTrack } from './types';

export { registerRecipe };

registerRecipe('recipeCta', (ctx, w, h, _props, palette, texts) => {
  roundRectPath(ctx, 0, 0, w, h, h / 2);
  ctx.fillStyle = palette.ink;
  ctx.fill();
  ctx.fillStyle = palette.base;
  ctx.font = fontStr(800, 40, '"Bricolage Grotesque", Figtree, sans-serif');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((texts[2] || 'Update now').replace(/\*/g, ''), w / 2, h / 2 + 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
});

export const SOURCE_W = 524;
export const SOURCE_H = 1144;

export function screenLayer(id: string, label: string, slotId: string, transform: LayerDef['transform']): LayerDef {
  return { id, label, plane: 'device', content: { kind: 'screenshot', slotId }, width: SOURCE_W, height: SOURCE_H, overrides: {}, transform };
}

export function cutoutLayer(id: string, label: string, slotId: string, rectUv: [number, number, number, number], w: number, h: number, radiusPx: number, transform: LayerDef['transform']): LayerDef {
  return { id, label, plane: 'popout', content: { kind: 'cutout', sourceSlotId: slotId, rectUv, radiusPx }, width: w, height: h, overrides: {}, transform };
}

export function track(base: number, steps: PropertyTrack['steps'] = []): PropertyTrack {
  return { base, steps };
}

export function headline(at: number, out: number, textId: HeadlineBeat['textId']): HeadlineBeat {
  return { at, out, textId };
}

export function burst(id: string, at: number, originLayerId: string, kind: ParticleBurstDef['kind'], seedOffset: number, density: number): ParticleBurstDef {
  return { id, at, kind, originLayerId, count: Math.round(14 + 20 * density), dir: -Math.PI / 2, spread: 2.3, speed: 420 + 200 * density, gravity: 500, life: 1.5, seedOffset };
}

/** Every recipe's camera settles back to rest by the same fraction of
 * total duration — keeps the generated CTA-hold window consistent without
 * each recipe having to compute it itself. */
export function ctaHoldStart(duration: number): number {
  return Math.max(0.6, duration - 1.8);
}
