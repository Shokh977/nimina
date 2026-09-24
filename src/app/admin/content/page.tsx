import { TEMPLATES } from '@/engine/templates';
import ContentManager from '@/components/admin/ContentManager';
import { createClient } from '@/lib/supabase/server';

export default async function AdminContentPage() {
  const supabase = await createClient();
  const [{ data: templateRows }, { data: tracks }] = await Promise.all([
    supabase.from('templates').select('id, enabled, sort_order'),
    supabase.from('music_tracks').select('id, name, category, bpm, duration_seconds').order('category').order('name'),
  ]);

  const disabled = new Set((templateRows ?? []).filter((r) => r.enabled === false).map((r) => r.id));
  const templates = TEMPLATES.map((t) => ({ id: t.id, name: t.name, category: t.category, enabled: !disabled.has(t.id) }));

  return (
    <div>
      <h1 className="text-2xl font-bold">Content</h1>
      <ContentManager initialTemplates={templates} initialTracks={tracks ?? []} />
    </div>
  );
}
