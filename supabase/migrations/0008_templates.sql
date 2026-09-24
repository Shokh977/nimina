-- Template metadata only — the actual slide/Project structure for each
-- template lives in code (src/engine/templates.ts, keyed by the same text
-- id used here). This table just lets an admin hide or reorder a template
-- without a deploy (see the admin content page, 0009_admin.sql).
create table if not exists public.templates (
  id text primary key,
  enabled boolean not null default true,
  sort_order integer not null default 0
);

alter table public.templates enable row level security;

create policy "Anyone can see which templates are enabled"
  on public.templates for select
  using (true);
