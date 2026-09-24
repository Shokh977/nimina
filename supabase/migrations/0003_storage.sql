-- Private "assets" bucket for uploaded screenshots, app icons and music.
-- Paths follow {user_id}/{project_id}/{asset_id}; RLS below enforces that a
-- user can only read/write objects under their own {user_id} prefix,
-- regardless of which project the object belongs to.
insert into storage.buckets (id, name, public)
values ('assets', 'assets', false)
on conflict (id) do nothing;

create policy "Users can read own assets"
  on storage.objects for select
  using (
    bucket_id = 'assets'
    and (storage.foldername (name)) [1] = auth.uid ()::text
  );

create policy "Users can upload own assets"
  on storage.objects for insert
  with check (
    bucket_id = 'assets'
    and (storage.foldername (name)) [1] = auth.uid ()::text
  );

create policy "Users can update own assets"
  on storage.objects for update
  using (
    bucket_id = 'assets'
    and (storage.foldername (name)) [1] = auth.uid ()::text
  );

create policy "Users can delete own assets"
  on storage.objects for delete
  using (
    bucket_id = 'assets'
    and (storage.foldername (name)) [1] = auth.uid ()::text
  );
