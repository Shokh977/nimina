-- Infrastructure merge: Engine v2 projects reuse the same `projects` table
-- as the classic engine (same RLS, same 1-project-free-plan limit from
-- 0005_project_limits.sql, which counts *all* rows regardless of engine —
-- "1 project" is meant to mean one project total, not one per engine).
-- `data` already holds arbitrary JSON (see 0002's comment); this column
-- just says how to interpret it and which editor opens it.
alter table public.projects
  add column engine text not null default 'classic' check (engine in ('classic', 'v2'));

create index projects_engine_idx on public.projects (engine);
