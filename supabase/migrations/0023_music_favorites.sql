-- Music favourites: tracks a user starred in the editor's music drawer,
-- kept on the account so they follow the user to every device.
--
-- Users write their own rows directly (nothing to validate beyond "it's
-- yours"); user_id defaults to the caller. Deleting the account or the
-- track removes the row.

create table public.music_favorites (
  user_id uuid not null default auth.uid () references auth.users (id) on delete cascade,
  track_id text not null references public.music_tracks (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, track_id)
);

alter table public.music_favorites enable row level security;

create policy "Users can see their own favourites"
  on public.music_favorites for select
  using (user_id = auth.uid ());

create policy "Users can add their own favourites"
  on public.music_favorites for insert
  with check (user_id = auth.uid ());

create policy "Users can remove their own favourites"
  on public.music_favorites for delete
  using (user_id = auth.uid ());
