/**
 * Remix (Prompt 6): generates a batch of variations from a base seed,
 * within the chosen recipe's structure. "Locking" a part (palette/motion/
 * layout) keeps it fixed across a remix round instead of re-rolling it —
 * "keep colors, remix motion" means paletteId stays put while styleId and
 * the seed driving layout/camera/positions/timing (see builtInRecipes.ts)
 * are free to change.
 */
import { PALS, type PaletteId } from './palettes';
import { getRecipe, type RecipeContent, type RemixLocks } from './recipes';
import { rng } from './rng';
import { STYLES, type StyleId } from './styles';
import type { SceneProjectV2 } from './types';

export interface RemixOptions {
  recipeId: string;
  content: RecipeContent;
  seed: number;
  paletteId: PaletteId;
  styleId: StyleId;
  locks: RemixLocks;
}

const PALETTE_IDS = Object.keys(PALS) as PaletteId[];
const STYLE_IDS = Object.keys(STYLES) as StyleId[];

function pick<T>(arr: T[], r: () => number): T {
  return arr[Math.floor(r() * arr.length) % arr.length];
}

export function remixOne(opts: RemixOptions, variantIndex: number): SceneProjectV2 {
  const recipe = getRecipe(opts.recipeId);
  if (!recipe) throw new Error(`Unknown recipe "${opts.recipeId}"`);
  const r = rng(opts.seed * 104729 + variantIndex * 7919 + 13);
  const paletteId = opts.locks.palette ? opts.paletteId : pick(PALETTE_IDS, r);
  const styleId = opts.locks.motion ? opts.styleId : pick(STYLE_IDS, r);
  const seed = opts.locks.layout ? opts.seed : Math.floor(r() * 1_000_000);
  return recipe.build({ content: opts.content, styleId, paletteId, seed });
}

/** The "show 4 variations side by side" batch. Variant 0 always reuses
 * `opts.seed`/`opts.paletteId`/`opts.styleId` exactly (so "Remix" never
 * throws away the state the user is currently looking at) — variants 1-3
 * are fresh rolls of whatever isn't locked. */
export function generateVariations(opts: RemixOptions, count = 4): SceneProjectV2[] {
  const recipe = getRecipe(opts.recipeId);
  if (!recipe) throw new Error(`Unknown recipe "${opts.recipeId}"`);
  const first = recipe.build({ content: opts.content, styleId: opts.styleId, paletteId: opts.paletteId, seed: opts.seed });
  const rest = Array.from({ length: Math.max(0, count - 1) }, (_, i) => remixOne(opts, i + 1));
  return [first, ...rest];
}
