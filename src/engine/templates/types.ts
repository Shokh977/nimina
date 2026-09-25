/**
 * Shared types for every template in src/engine/templates/ — the starter
 * set (starter.ts) and the Nimina Template Pack (docs/TEMPLATE_PACK.md).
 */
import type { Project } from '../types';

/** Where one uploaded image lands. Most slots have exactly one target; a
 * few (e.g. Fitness's `workout-detail`, shown mid-story via `showScreen`
 * and then again as its own close-up slide) have two — uploading once
 * fills every target for that slot. */
export interface TemplateSlotTarget {
  sceneId: number;
  /** Present only when this target is a StorySlide's screen
   * (StoryScreen.id, resolved to StoryScreen.assetId) rather than an
   * ImageSlide's own imgAssetId. */
  screenId?: string;
}

export interface TemplateSlot {
  /** Stable key matching the named slot in docs/TEMPLATE_PACK.md (e.g.
   * 'workout-detail') — identifies the slot across every place it's used,
   * not just one scene. */
  key: string;
  label: string;
  hint: string;
  targets: TemplateSlotTarget[];
}

export interface TemplateBuildOptions {
  /** 'short' omits every slide the template marks optional — see each
   * template file's own comments for which ones. Defaults to 'full'. */
  variant?: 'full' | 'short';
  /** Partial override of the template's own `Strings` shape (each
   * template file exports its own, e.g. `FitnessStrings`) — merged over
   * that template's `DEFAULT_*_STRINGS`. Translating a template means
   * passing a different strings object in; the scene list itself never
   * changes. Loosely typed here (each template's shape differs) — every
   * template's own build() merges and narrows it. */
  strings?: Record<string, string>;
}

export interface TemplateDef {
  id: string;
  name: string;
  description: string;
  category: string;
  /** Card gradient for the template gallery — always present as a fallback,
   * shown while a preview video is loading or for templates that don't
   * have one yet. */
  swatch: [string, string];
  /** Full-variant duration in seconds, shown in the gallery entry. */
  durationSeconds: number;
  /** Public paths to the rendered 10s preview loop, used for the gallery
   * card's live animated preview and the landing page. Undefined until
   * that template's preview has actually been rendered (see
   * docs/TEMPLATE_PACK.md's asset plan) — the gallery falls back to the
   * static swatch until then. */
  previewVideo9x16?: string;
  previewVideo16x9?: string;
  build: (opts?: TemplateBuildOptions) => { project: Project; slots: TemplateSlot[] };
}
