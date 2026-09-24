/**
 * Side-effect-only import — every one of these modules calls
 * registerRecipe()/registerRecipeV2() at module top level, populating
 * sceneBuilder.ts's shared CONTENT_RECIPES map (for 'ui-element' content)
 * and recipes.ts's registry (for Remix). Nothing here is otherwise used;
 * this file exists purely to be imported for its side effects wherever a
 * SceneProjectV2 might get rendered.
 *
 * Real bug this fixes: before this existed, EditorV2Shell.tsx always
 * imported `reactionsTemplate` directly (hardcoded, no project picker),
 * which happened to also register every 'ui-element' recipe reactions.ts
 * defines, as an accidental side effect. Once Tier 1 replaced that with
 * loading an arbitrary saved project by id, EditorV2Shell.tsx stopped
 * importing any template file at all — so a *direct* load of /editor2/[id]
 * (a bookmark, a refresh, anything that isn't "click a template card in
 * ProjectGallery.tsx first") rendered every 'ui-element' layer as
 * completely blank (a transparent, undrawn canvas — no error, no console
 * warning, just invisible content), because renderRecipeTexture() silently
 * no-ops when CONTENT_RECIPES[recipe] isn't registered yet. Caught by
 * screenshot-testing a template's mid-timeline content, not by a type
 * error or thrown exception, since a missing recipe fails silently by
 * design (so a still-loading one doesn't crash a frame).
 */
import './builtInRecipes';
import './templates/checkout';
import './templates/insights';
import './templates/reactions';
import './templates/showcase';
