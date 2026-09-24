/**
 * Turns a TemplateRecipeV2 (code, run once) + the user's chosen style/
 * palette/seed/texts into a SceneProjectV2 (pure data — see types.ts) that
 * evaluate.ts and sceneBuilder.ts can play. This is the one place that
 * calls a template's build() — everything downstream of it only ever reads
 * data, never calls template code again.
 */
import type { PaletteId } from './palettes';
import { rng } from './rng';
import { STYLES, type StyleId } from './styles';
import type { BuildContext, HeadlineBeat, SceneProjectV2, TemplateRecipeV2 } from './types';

export interface InstantiateOptions {
  styleId: StyleId;
  paletteId: PaletteId;
  seed: number;
  texts?: [string, string, string];
}

export function instantiateTemplate(recipe: TemplateRecipeV2, opts: InstantiateOptions): SceneProjectV2 {
  const r = rng(opts.seed * 7919 + 13);
  const sign: 1 | -1 = opts.seed === 1 ? 1 : r() < 0.5 ? 1 : -1;
  const align: 'center' | 'left' = opts.seed === 1 ? 'center' : r() < 0.5 ? 'center' : 'left';
  const v: [number, number] = [0.8 + r() * 0.5, 0.8 + r() * 0.5];
  const ctx: BuildContext = { seed: opts.seed, sign, align, v, paletteId: opts.paletteId };

  const { layers, particles, camera } = recipe.build(ctx);
  const textIds = ['t1', 't2', 't3'];
  const beats: HeadlineBeat[] = recipe.beats.map(([at, out], i) => ({ at, out, textId: textIds[i] ?? 't3' }));

  return {
    templateId: recipe.id,
    styleId: opts.styleId,
    paletteId: opts.paletteId,
    seed: opts.seed,
    texts: opts.texts ?? recipe.defaultTexts,
    duration: recipe.duration / STYLES[opts.styleId].speed,
    ctaAt: recipe.ctaAt,
    beats,
    layers,
    particles,
    camera,
    sign,
    align,
  };
}
