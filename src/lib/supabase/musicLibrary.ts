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

const COLUMNS = 'id, name, artist, mood, genre, storage_path, bpm, duration_seconds, pro_only, peaks, license, licence_source';

function toTrack(row: Record<string, unknown>): MusicLibraryTrack {
  return {
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
  };
}

export type LibrarySort = 'featured' | 'newest' | 'title' | 'bpm' | 'shortest';
export const LIBRARY_SORTS: Array<[LibrarySort, string]> = [
  ['featured', 'Featured'],
  ['newest', 'Newest'],
  ['title', 'Title A–Z'],
  ['bpm', 'Slowest first'],
  ['shortest', 'Shortest first'],
];

export interface LibraryQuery {
  /** Matches title, artist, mood or genre. */
  search?: string;
  mood?: string;
  genre?: string;
  freeOnly?: boolean;
  sort: LibrarySort;
  offset: number;
  limit: number;
}

/** PostgREST's or=() filter syntax uses , ( ) and the ilike wildcards * %. */
function searchTerm(q: string): string {
  return q.replace(/[,()*%\\:."]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}

/** One page of active tracks, filtered and sorted in the database, plus the
 * total matching count — the drawer pages through hundreds of tracks
 * instead of downloading them all. */
export async function searchMusicLibrary(supabase: SupabaseClient, q: LibraryQuery): Promise<{ tracks: MusicLibraryTrack[]; total: number }> {
  let query = supabase.from('music_tracks').select(COLUMNS, { count: 'exact' }).eq('active', true);
  const term = q.search ? searchTerm(q.search) : '';
  if (term) query = query.or(['name', 'artist', 'mood', 'genre'].map((c) => `${c}.ilike.*${term}*`).join(','));
  if (q.mood) query = query.eq('mood', q.mood);
  if (q.genre) query = query.eq('genre', q.genre);
  if (q.freeOnly) query = query.eq('pro_only', false);
  if (q.sort === 'newest') query = query.order('created_at', { ascending: false });
  else if (q.sort === 'title') query = query.order('name');
  else if (q.sort === 'bpm') query = query.order('bpm');
  else if (q.sort === 'shortest') query = query.order('duration_seconds');
  else query = query.order('sort_order');
  // A stable tie-break, so paging never repeats or skips a row.
  query = query.order('id').range(q.offset, q.offset + q.limit - 1);
  const { data, error, count } = await query;
  if (error) throw error;
  return { tracks: (data ?? []).map(toTrack), total: count ?? 0 };
}

/** The moods and genres in use (for the filter chips), most common first. */
export async function musicLibraryFacets(supabase: SupabaseClient): Promise<{ moods: string[]; genres: string[] }> {
  const { data, error } = await supabase.from('music_tracks').select('mood, genre').eq('active', true);
  if (error) throw error;
  const rank = (key: 'mood' | 'genre') => {
    const counts = new Map<string, number>();
    for (const row of data ?? []) counts.set(row[key] as string, (counts.get(row[key] as string) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([v]) => v);
  };
  return { moods: rank('mood'), genres: rank('genre') };
}

/** Specific active tracks, in the order asked for (recently used). */
export async function getMusicTracks(supabase: SupabaseClient, ids: string[]): Promise<MusicLibraryTrack[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase.from('music_tracks').select(COLUMNS).eq('active', true).in('id', ids);
  if (error) throw error;
  const byId = new Map((data ?? []).map((r) => [r.id as string, toTrack(r)]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

export function getMusicLibraryUrl(storagePath: string): string {
  return publicFileUrl(`music-library/${storagePath}`);
}
