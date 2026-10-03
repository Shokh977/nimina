import MusicManager, { type AdminTrack } from '@/components/admin/MusicManager';
import { createClient } from '@/lib/supabase/server';

export default async function AdminMusicPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('music_tracks')
    .select('id, name, artist, mood, genre, bpm, duration_seconds, storage_path, license, licence_source, licence_notes, active, pro_only, sort_order, peaks, bytes, bitrate_kbps')
    .order('sort_order')
    .order('created_at');

  return (
    <div>
      <h1 className="text-2xl font-bold">Music library</h1>
      <p className="mt-1 text-[13.5px] text-neutral-500 dark:text-neutral-400">
        Tracks every user can pick in the editor. Uploads are converted to 128 kbps MP3 (about 1 MB per minute) in your browser. Every track needs its licence source and notes — we redistribute these files to users.
      </p>
      <MusicManager tracks={(data ?? []) as AdminTrack[]} publicBase={(process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? '').replace(/\/+$/, '')} />
    </div>
  );
}
