/**
 * Shared types for every template in src/engine/templates/ — the starter
 * set (starter.ts) and the Nimina Template Pack (docs/TEMPLATE_PACK.md).
 */
import type { AssetMap, Project } from '../types';

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
  /** Card gradient for the template gallery — shown while a preview video
   * is loading, or as the permanent fallback for a template that doesn't
   * have one (the original starter set never gets one — see starter.ts). */
  swatch: [string, string];
  /** Full-variant duration in seconds, shown in the gallery entry. */
  durationSeconds: number;
  /** Rendered preview *videos* (as opposed to this data) are not part of
   * TemplateDef — they're uploaded artifacts, not code-defined template
   * content. See supabase/migrations/0012_template_previews.sql: their
   * URLs live in the `templates` table's preview_video_9x16_url/
   * preview_video_16x9_url columns, uploaded by
   * scripts/render-template-previews.mjs, and merged in by
   * src/lib/supabase/templates.ts's listEnabledTemplates(). */
  build: (opts?: TemplateBuildOptions) => { project: Project; slots: TemplateSlot[] };
  /** Procedural placeholder screens keyed by slot key — lets the template
   * render a real, working preview (dev tooling, gallery/landing preview
   * video) before anyone uploads anything. Optional: the original starter
   * set (starter.ts) has no per-slot art and relies on the gallery's
   * static swatch fallback instead — scripts/render-template-previews.mjs
   * skips any template without this. */
  buildSampleAssets?: () => AssetMap;
}
