/**
 * Scene recipes (Prompt 6) — structures, not fixed designs. A recipe is a
 * pure function of (user content, style, palette, seed) -> SceneProjectV2,
 * built from the exact same LayerDef/CameraLayerDef/ParticleBurstDef model
 * every hand-authored template (templates/reactions.ts etc.) already uses
 * — a recipe is just a *generative* template: it decides its own layout,
 * camera path, secondary decoration and timing from the seed instead of
 * having them hand-tuned, and reads the chosen MotionStyle's parameters
 * (styles.ts) to make style-appropriate choices (how much decoration, how
 * fast the camera moves, whether cuts are hard, ...).
 *
 * Two different apps' screenshots through the *same* recipe should look
 * clearly different — the recipe never draws its own placeholder content,
 * it always composes from `ctx.content` (real screenshots/cutouts/text),
 * so the actual pixels already differ; seed-driven layout/camera/timing
 * choices and style-driven motion are what keep the two also *feeling*
 * different, not just showing different screenshots in an identical shell.
 */
import type { PaletteId } from './palettes';
import type { StyleId } from './styles';
import type { ImageAsset, SceneProjectV2 } from './types';

export interface RecipeScreenshot {
  /** Slot id — matches a LayerDef's 'screenshot' content.slotId or cutout's
   * sourceSlotId, and the key the caller must use in buildEngineV2Scene's
   * `assets` map to actually resolve it to pixels. */
  id: string;
  image: ImageAsset;
  /** 0-1 rects within this screenshot a recipe can use for a cutout
   * without having to guess where the interesting UI is — e.g. from the
   * Prompt 3 cutout picker, or an AI "Detect elements" suggestion. Recipes
   * fall back to sensible defaults when a screenshot has none. */
  cutouts?: Array<{ id: string; rect: [number, number, number, number] }>;
}

export interface RecipeContent {
  screenshots: RecipeScreenshot[];
  /** Freeform text lines a recipe pulls from in order — how many it uses
   * and what it uses each one for (hook, subhead, bullet, CTA, ...) is up
   * to the recipe. Recipes fill in sensible defaults for any it needs but
   * doesn't have. */
  texts: string[];
  appName?: string;
}

/** Prompt 6: "users can lock the parts they like ... and remix again." A
 * locked part is carried over from `previous` instead of re-rolled. */
export interface RemixLocks {
  palette?: boolean;
  motion?: boolean;
  layout?: boolean;
}

export interface RecipeContext {
  content: RecipeContent;
  styleId: StyleId;
  paletteId: PaletteId;
  seed: number;
}

export interface SceneRecipe {
  id: string;
  label: string;
  description: string;
  /** Screenshots a recipe needs at minimum — fewer than this and it
   * repeats/pads from what it has rather than failing outright. */
  minScreenshots: number;
  build(ctx: RecipeContext): SceneProjectV2;
}

const REGISTRY = new Map<string, SceneRecipe>();

export function registerRecipeV2(recipe: SceneRecipe): void {
  REGISTRY.set(recipe.id, recipe);
}
export function getRecipe(id: string): SceneRecipe | undefined {
  return REGISTRY.get(id);
}
export function listRecipes(): SceneRecipe[] {
  return [...REGISTRY.values()];
}
