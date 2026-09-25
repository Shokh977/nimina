import type { SupabaseClient } from '@supabase/supabase-js';

import { TEMPLATES, type TemplateDef } from '@/engine/templates';

/** TemplateDef plus the two columns that only exist in the `templates`
 * table (see 0012_template_previews.sql) — rendered/uploaded artifacts,
 * not code-defined template content, so they're not on TemplateDef
 * itself. Undefined until scripts/render-template-previews.mjs has
 * uploaded that template's preview at least once. */
export interface TemplateWithPreview extends TemplateDef {
  previewVideo9x16?: string;
  previewVideo16x9?: string;
}

/** A template with no row in `templates` is enabled by default (and has no
 * preview video yet) — the table is an override/annotation layer an admin
 * or the render script uses, not a required allowlist, so the gallery
 * works even before anyone's touched either. */
export async function listEnabledTemplates(supabase: SupabaseClient): Promise<TemplateWithPreview[]> {
  const { data } = await supabase.from('templates').select('id, enabled, preview_video_9x16_url, preview_video_16x9_url').in(
    'id',
    TEMPLATES.map((t) => t.id),
  );
  const rows = new Map((data ?? []).map((row) => [row.id as string, row]));
  return TEMPLATES.filter((t) => rows.get(t.id)?.enabled !== false).map((t) => {
    const row = rows.get(t.id);
    return { ...t, previewVideo9x16: row?.preview_video_9x16_url ?? undefined, previewVideo16x9: row?.preview_video_16x9_url ?? undefined };
  });
}
