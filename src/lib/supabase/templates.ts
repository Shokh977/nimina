import type { SupabaseClient } from '@supabase/supabase-js';

import { TEMPLATES, type TemplateDef } from '@/engine/templates';

/** A template with no row in `templates` is enabled by default — the table
 * is an override an admin uses to hide one, not a required allowlist, so
 * the gallery works even before anyone's touched the admin panel. */
export async function listEnabledTemplates(supabase: SupabaseClient): Promise<TemplateDef[]> {
  const { data } = await supabase.from('templates').select('id, enabled').in(
    'id',
    TEMPLATES.map((t) => t.id),
  );
  const disabled = new Set((data ?? []).filter((row) => row.enabled === false).map((row) => row.id as string));
  return TEMPLATES.filter((t) => !disabled.has(t.id));
}
