import { NextResponse } from 'next/server';
import { z } from 'zod';

import { readMp3Header } from '@/lib/audio/mp3';
import { isR2Configured, r2 } from '@/lib/r2/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * Admin management of the music library (/admin/music). The audio file is
 * uploaded first — transcoded to 128 kbps MP3 in the admin's browser, PUT to
 * the public bucket via /api/storage/upload (kind 'music-library') — then
 * POSTed here with its metadata. This route re-checks the stored file
 * (really an MP3, 128–160 kbps) and refuses a track without its licence
 * details: we redistribute these files to every user who picks one.
 */

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const Meta = z.object({
  title: text(1, 80),
  artist: text(1, 80),
  mood: text(1, 40),
  genre: text(1, 40),
  bpm: z.number().int().min(20).max(300),
  licenceType: z.enum(['original', 'cc0', 'licensed']),
  licenceSource: text(3, 300),
  licenceNotes: text(10, 2000),
  proOnly: z.boolean(),
});
const Create = Meta.extend({
  path: z.string().regex(/^[0-9a-f-]{36}\.mp3$/),
  duration: z.number().positive().max(60 * 30),
  peaks: z.array(z.number().min(0).max(1)).min(32).max(400),
});
const Patch = z.object({ id: z.string().min(1), active: z.boolean().optional(), proOnly: z.boolean().optional(), move: z.union([z.literal(-1), z.literal(1)]).optional(), meta: Meta.partial().optional() });

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  return profile?.role === 'admin' ? user : null;
}
const denied = () => NextResponse.json({ error: 'Admins only.' }, { status: 403 });
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'track';
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return denied();
  if (!isR2Configured()) return bad("File storage isn't set up on this server.", 503);
  const parsed = Create.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    return bad(`Every field is required — check: ${missing}.`);
  }
  const t = parsed.data;

  // The file must be there, and must be the MP3 we asked for.
  const store = r2();
  const bucket = store.bucketName('public');
  const key = `music-library/${t.path}`;
  const head = await store.head(bucket, key);
  if (!head) return bad('The audio file was not uploaded — try again.');
  const res = await fetch(await store.signGet(bucket, key, 120), { headers: { Range: 'bytes=0-131071' } });
  const info = readMp3Header(new Uint8Array(await res.arrayBuffer()));
  const effective = (head.size * 8) / t.duration / 1000;
  if (!info) return bad('That file is not an MP3.', 422);
  if (info.bitrateKbps < 128 || info.bitrateKbps > 160 || effective < 110 || effective > 175)
    return bad(`Library tracks must be 128–160 kbps MP3s (this one is ${info.bitrateKbps} kbps, ${effective.toFixed(0)} kbps on average).`, 422);

  // Each upload has its own key, so the file can be cached for a year —
  // repeat previews and uses cost nothing.
  await store.setHeaders(bucket, key, 'audio/mpeg', 'public, max-age=31536000, immutable');

  const admin = createAdminClient();
  const { data: last } = await admin.from('music_tracks').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle();
  const id = `${slug(t.title)}-${t.path.slice(0, 6)}`;
  const { error } = await admin.from('music_tracks').insert({
    id,
    name: t.title,
    artist: t.artist,
    author: t.artist,
    mood: t.mood,
    category: t.mood,
    genre: t.genre,
    bpm: t.bpm,
    duration_seconds: Math.round(t.duration * 100) / 100,
    storage_path: t.path,
    license: t.licenceType,
    license_note: t.licenceNotes,
    licence_source: t.licenceSource,
    licence_notes: t.licenceNotes,
    pro_only: t.proOnly,
    active: true,
    sort_order: (last?.sort_order ?? 0) + 1,
    peaks: t.peaks.map((p) => Math.round(p * 1000) / 1000),
    bytes: head.size,
    bitrate_kbps: info.bitrateKbps,
  });
  if (error) return bad(`Couldn't save the track: ${error.message}`, 500);
  return NextResponse.json({ ok: true, id });
}

export async function PATCH(request: Request) {
  if (!(await requireAdmin())) return denied();
  const parsed = Patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return bad('Invalid request.');
  const { id, active, proOnly, move, meta } = parsed.data;
  const admin = createAdminClient();
  const update: Record<string, unknown> = {};
  if (active !== undefined) update.active = active;
  if (proOnly !== undefined) update.pro_only = proOnly;
  if (meta) {
    if (meta.title) update.name = meta.title;
    if (meta.artist) update.artist = update.author = meta.artist;
    if (meta.mood) update.mood = update.category = meta.mood;
    if (meta.genre) update.genre = meta.genre;
    if (meta.bpm) update.bpm = meta.bpm;
    if (meta.licenceType) update.license = meta.licenceType;
    if (meta.licenceSource) update.licence_source = meta.licenceSource;
    if (meta.licenceNotes) update.licence_notes = update.license_note = meta.licenceNotes;
  }
  if (Object.keys(update).length) {
    const { error } = await admin.from('music_tracks').update(update).eq('id', id);
    if (error) return bad(error.message, 500);
  }
  if (move) {
    // Swap places with the neighbour in that direction.
    const { data: all } = await admin.from('music_tracks').select('id, sort_order').order('sort_order').order('created_at');
    const list = all ?? [];
    const i = list.findIndex((r) => r.id === id);
    const j = i + move;
    if (i >= 0 && j >= 0 && j < list.length) {
      const order = list.map((r) => r.id);
      [order[i], order[j]] = [order[j], order[i]];
      await Promise.all(order.map((rid, k) => admin.from('music_tracks').update({ sort_order: k }).eq('id', rid)));
    }
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!(await requireAdmin())) return denied();
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return bad('Missing id.');
  const admin = createAdminClient();
  const { data: track } = await admin.from('music_tracks').select('storage_path').eq('id', id).maybeSingle();
  if (!track) return bad('Track not found.', 404);
  const { error } = await admin.from('music_tracks').delete().eq('id', id);
  if (error) return bad(error.message, 500);
  if (isR2Configured()) await r2().delete(r2().bucketName('public'), `music-library/${track.storage_path}`);
  return NextResponse.json({ ok: true });
}
