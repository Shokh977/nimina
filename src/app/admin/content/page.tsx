import ContentManager from '@/components/admin/ContentManager';
import { createClient } from '@/lib/supabase/server';

export default async function AdminContentPage() {
  const supabase = await createClient();
  const { data: tracks } = await supabase.from('music_tracks').select('id, name, category, bpm, duration_seconds').order('category').order('name');

  return (
    <div>
      <h1 className="text-2xl font-bold">Content</h1>
      <ContentManager initialTracks={tracks ?? []} />
    </div>
  );
}
