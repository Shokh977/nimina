import type { Project } from '@/engine/types';

export interface ShortVariant {
  sceneIds: number[];
  introOn: boolean;
}

/** Every template's short cut is just a subset/reorder of the full variant's
 * `scenes` plus whether the intro is skipped — nothing else differs (see
 * scripts/import-templates-to-db.ts, which asserts this invariant at import
 * time). Shared by src/lib/supabase/templates.ts (the wizard/gallery's
 * `build({variant:'short'})` path) and TemplatePreviewRegenerator (which
 * renders the short cut for the preview video). */
export function applyShortVariant(project: Project, shortVariant: ShortVariant): Project {
  const byId = new Map(project.scenes.map((s) => [s.id, s]));
  return {
    ...project,
    scenes: shortVariant.sceneIds.map((id) => byId.get(id)).filter((s): s is Project['scenes'][number] => !!s),
    intro: { ...project.intro, on: shortVariant.introOn },
  };
}
