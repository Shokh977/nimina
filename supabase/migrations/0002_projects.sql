-- Projects: one row per saved promo video. `data` holds the serializable
-- engine Project (see src/engine/types.ts) as JSON — images/icon/music are
-- referenced there by asset id only, never embedded.
create table public.projects (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Untitled promo',
  data jsonb not null default '{}'::jsonb,
  thumbnail_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_user_id_idx on public.projects (user_id);

alter table public.projects enable row level security;

create policy "Users can view own projects"
  on public.projects for select
  using (auth.uid () = user_id);

create policy "Users can insert own projects"
  on public.projects for insert
  with check (auth.uid () = user_id);

create policy "Users can update own projects"
  on public.projects for update
  using (auth.uid () = user_id);

create policy "Users can delete own projects"
  on public.projects for delete
  using (auth.uid () = user_id);

create function public.set_updated_at () returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger projects_set_updated_at
  before update on public.projects
  for each row
  execute procedure public.set_updated_at ();
