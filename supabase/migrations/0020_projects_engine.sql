-- projects.engine exists in production but was never on main: it came from
-- the paused Engine v2 branch's 0012_engine_v2_projects.sql (see
-- engine-v2-wip), which was run against the live database. The app relies
-- on it (src/lib/supabase/projects.ts lists `engine = 'classic'` rows), so
-- a database rebuilt from main's migrations — e.g. a backup restore —
-- would break without it. Found by the backup restore check (README
-- "Database backups"). Idempotent: a no-op where the column already exists.
alter table public.projects
  add column if not exists engine text not null default 'classic'
    constraint projects_engine_check check (engine in ('classic', 'v2'));

create index if not exists projects_engine_idx on public.projects (engine);
