-- Lightweight product-analytics log, doubling as the AI Director's
-- per-month usage counter (see src/app/api/ai/director/route.ts, which
-- counts rows of type 'ai_director_used' since the start of the current
-- month rather than needing a separate counter table). Admins get a wider
-- read policy in 0010_admin.sql.
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  type text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists events_user_type_created_idx on public.events (user_id, type, created_at desc);

alter table public.events enable row level security;

create policy "Users can log their own events"
  on public.events for insert
  with check (auth.uid () = user_id);

create policy "Users can see their own events"
  on public.events for select
  using (auth.uid () = user_id);
