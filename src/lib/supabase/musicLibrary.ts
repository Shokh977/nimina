import type { SupabaseClient } from '@supabase/supabase-js';

import { publicFileUrl } from '@/lib/storage/assets';

/** A curated background-music track (see supabase/migrations/0006_music_library.sql).
 * The files live in the public R2 bucket under music-library/ (unlike private user uploads) — these
 * are shared, non-sensitive catalog assets — so tracks are fetched by plain
 * public URL, no signing needed. */
export interface MusicLibraryTrack {
  id: string;
  name: string;
  artist: string;
  mood: string;
  genre: string;
  storagePath: string;
  bpm: number;
  durationSeconds: number;
  /** Library tracks are Pro unless an admin marks one free. */
  proOnly: boolean;
  /** 0–1 waveform for the preview (null for very old rows). */
  peaks: number[] | null;
  /** 'original' | 'cc0' | 'licensed' — see supabase/migrations/0011_music_license.sql. */
  license: string;
  licenceSource: string;
}

/** Active tracks in the admin's order (/admin/music). */
export async function listMusicLibrary(supabase: SupabaseClient): Promise<MusicLibraryTrack[]> {
  const { data, error } = await supabase.from('music_tracks').select('id, name, artist, mood, genre, storage_path, bpm, duration_seconds, pro_only, peaks, license, licence_source').eq('active', true).order('sort_order').order('created_at');
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    artist: row.artist as string,
    mood: row.mood as string,
    genre: row.genre as string,
    storagePath: row.storage_path as string,
    bpm: row.bpm as number,
    durationSeconds: Number(row.duration_seconds),
    proOnly: row.pro_only as boolean,
    peaks: (row.peaks as number[] | null) ?? null,
    license: row.license as string,
    licenceSource: row.licence_source as string,
  }));
}

export function getMusicLibraryUrl(storagePath: string): string {
  return publicFileUrl(`music-library/${storagePath}`);
}
