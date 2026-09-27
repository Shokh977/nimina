import TemplatesTable from '@/components/admin/TemplatesTable';
import { createClient } from '@/lib/supabase/server';

export default async function AdminTemplatesPage() {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from('templates')
    .select('id, slug, name, category, status, duration_seconds, slot_count, swatch_a, swatch_b, preview_video_9x16_url, sort_order')
    .is('deleted_at', null)
    .order('sort_order');

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Templates</h1>
      </div>
      <TemplatesTable initialTemplates={rows ?? []} />
    </div>
  );
}
