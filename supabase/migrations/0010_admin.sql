-- Adds a role to profiles and a reusable is_admin() check, then widens
-- read/write access for admins across the tables the admin panel
-- (/admin) needs: everyone's profiles (for the users page), all events
-- (for the dashboard), and the content-management tables (templates,
-- music_tracks). Nobody is an admin by default — promote yourself with:
--   update public.profiles set role = 'admin' where email = 'you@example.com';
-- run once in the SQL Editor after your first sign-in.
alter table public.profiles
  add column if not exists role text not null default 'user';

alter table public.profiles
  add constraint profiles_role_check check (role in ('user', 'admin'));

create or replace function public.is_admin () returns boolean as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable set search_path = public;

create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin ());

create policy "Admins can update any profile"
  on public.profiles for update
  using (public.is_admin ());

create policy "Admins can view all events"
  on public.events for select
  using (public.is_admin ());

create policy "Admins can manage templates"
  on public.templates for all
  using (public.is_admin ())
  with check (public.is_admin ());

create policy "Admins can manage the music library"
  on public.music_tracks for all
  using (public.is_admin ())
  with check (public.is_admin ());

create policy "Admins can view all projects"
  on public.projects for select
  using (public.is_admin ());
