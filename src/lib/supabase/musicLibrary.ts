import type { SupabaseClient } from '@supabase/supabase-js';

import { publicFileUrl } from '@/lib/storage/assets';

/** A curated background-music track (see supabase/migrations/0006_music_library.sql).
 * The files live in the public R2 bucket under music-library/ (unlike private user uploads) — these
 * are shared, non-sensitive catalog assets — so tracks are fetched by plain
 * public URL, no signing needed. */
export interface MusicLibraryTrack {
  id: string;
  name: string;
  storagePath: string;
  bpm: number;
  durationSeconds: number;
  category: string;
  /** 'original' | 'cc0' | 'licensed' — see supabase/migrations/0011_music_license.sql. */
  license: string;
  licenseNote: string | null;
  author: string | null;
}

export async function listMusicLibrary(supabase: SupabaseClient): Promise<MusicLibraryTrack[]> {
  const { data, error } = await supabase.from('music_tracks').select('id, name, storage_path, bpm, duration_seconds, category, license, license_note, author').order('category').order('name');
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    storagePath: row.storage_path as string,
    bpm: row.bpm as number,
    durationSeconds: row.duration_seconds as number,
    category: row.category as string,
    license: row.license as string,
    licenseNote: row.license_note as string | null,
    author: row.author as string | null,
  }));
}

export function getMusicLibraryUrl(storagePath: string): string {
  return publicFileUrl(`music-library/${storagePath}`);
}
