-- Music library v2: tracks managed from /admin/music.
--
-- We redistribute these files to every user who picks one, so every track
-- must say where its licence comes from and what it allows — a track can't
-- be saved without licence_source and licence_notes (CHECK below, on top of
-- the form's own validation).
--
-- Files are MP3s at 128–160 kbps in the public R2 bucket under
-- music-library/ (transcoded in the admin's browser on upload, re-checked
-- by the server before the row is written). `peaks` is a short waveform
-- (0–1 values) for the editor's preview.

alter table public.music_tracks
  add column if not exists artist text,
  add column if not exists mood text,
  add column if not exists genre text,
  add column if not exists licence_source text,
  add column if not exists licence_notes text,
  add column if not exists active boolean not null default true,
  add column if not exists pro_only boolean not null default true,
  add column if not exists sort_order integer not null default 0,
  add column if not exists peaks jsonb,
  add column if not exists bytes integer,
  add column if not exists bitrate_kbps integer;

-- The tracks seeded so far are procedurally generated placeholders we made
-- ourselves (scripts/seed-music-library.ts).
update public.music_tracks
set artist = coalesce(artist, author, 'Nimina'),
    mood = coalesce(mood, category),
    genre = coalesce(genre, 'Electronic'),
    licence_source = coalesce(licence_source, 'Original — made by Nimina'),
    licence_notes = coalesce(licence_notes, 'Procedurally generated placeholder (src/engine/audio/proceduralMusic.ts). We own it outright; no third-party rights.');

alter table public.music_tracks
  alter column artist set not null,
  alter column mood set not null,
  alter column genre set not null,
  alter column licence_source set not null,
  alter column licence_notes set not null;

alter table public.music_tracks
  add constraint music_tracks_required_text check (
    length(btrim(name)) > 0 and length(btrim(artist)) > 0 and length(btrim(mood)) > 0 and length(btrim(genre)) > 0
    and length(btrim(licence_source)) > 0 and length(btrim(licence_notes)) > 0
  ),
  add constraint music_tracks_positive check (bpm > 0 and duration_seconds > 0);

-- Users see active tracks only; admins (0010's policy) see and manage all.
drop policy if exists "Anyone can browse the music library" on public.music_tracks;
drop policy if exists "Anyone signed in can browse the music library" on public.music_tracks;
create policy "Anyone can browse active music"
  on public.music_tracks for select
  using (active or public.is_admin ());
