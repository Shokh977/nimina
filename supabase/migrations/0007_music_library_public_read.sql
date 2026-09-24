-- 0006 gated music_tracks reads behind `to authenticated`, but its storage
-- policy already makes the audio files themselves public to anyone
-- (`using (bucket_id = 'music-library')`, no auth check) — the catalog
-- metadata is no more sensitive than the files it describes, and gating
-- just the table made the browser's anon-key client see an empty library
-- while a signed-in one saw the real tracks, for no real security benefit.
-- Widen it to match the bucket: public read, same as any other catalog.
drop policy if exists "Anyone signed in can browse the music library" on public.music_tracks;

create policy "Anyone can browse the music library"
  on public.music_tracks for select
  using (true);
