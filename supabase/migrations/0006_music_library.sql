-- Curated background-music catalog, browsable from the editor's Motion
-- panel alongside a user's own uploaded track. Unlike the private per-user
-- "assets" bucket (0003_storage.sql), this content is shared and
-- non-sensitive, so both the table and the bucket are public-read.
-- Rows/objects are seeded by scripts/seed-music-library.ts using the
-- service-role key (bypasses RLS) — there is no end-user write path.

create table if not exists public.music_tracks (
  id text primary key,
  name text not null,
  storage_path text not null,
  bpm integer not null,
  duration_seconds numeric not null,
  category text not null,
  created_at timestamptz not null default now()
);

alter table public.music_tracks enable row level security;

create policy "Anyone signed in can browse the music library"
  on public.music_tracks for select
  to authenticated
  using (true);

insert into storage.buckets (id, name, public)
values ('music-library', 'music-library', true)
on conflict (id) do nothing;

create policy "Anyone can read music library files"
  on storage.objects for select
  using (bucket_id = 'music-library');
