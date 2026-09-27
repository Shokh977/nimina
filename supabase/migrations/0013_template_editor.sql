-- Moves templates from code-only definitions to admin-editable data (the
-- /admin/templates editor). The actual slide/Project structure — previously
-- only in src/engine/templates/*.ts — now also lives in `data jsonb` here;
-- the code files remain as the one-time seed source (scripts/
-- import-templates-to-db.ts) and as the source of `buildSampleAssets()` for
-- procedural placeholder/preview-render images, but are no longer read by
-- the live gallery/wizard once that script has been rewired to query this
-- table (see src/lib/supabase/templates.ts).
--
-- `enabled` is replaced by `status` ('draft'|'published') — same concept
-- (gallery visibility), avoiding two sources of truth. `swatch_a`/
-- `swatch_b` back the card gradient (src/components/templates/
-- TemplatesShell.tsx), which has no other DB-backed equivalent.
alter table public.templates
  add column if not exists slug text,
  add column if not exists name text,
  add column if not exists description text,
  add column if not exists category text,
  add column if not exists status text not null default 'draft',
  add column if not exists duration_seconds numeric,
  add column if not exists slot_count integer,
  add column if not exists data jsonb,
  add column if not exists sample_assets_source_id text,
  add column if not exists swatch_a text,
  add column if not exists swatch_b text,
  add column if not exists deleted_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.templates set status = case when enabled then 'published' else 'draft' end;

alter table public.templates
  add constraint templates_status_check check (status in ('draft', 'published'));

alter table public.templates drop column enabled;

create unique index if not exists templates_slug_key on public.templates (slug) where deleted_at is null;

-- Public/anon read must never see drafts or soft-deleted rows — replaces
-- 0008's unconditional read policy.
drop policy if exists "Anyone can see which templates are enabled" on public.templates;

create policy "Anyone can see published templates"
  on public.templates for select
  using (status = 'published' and deleted_at is null);

-- 0010_admin.sql's "Admins can manage templates" (for all, is_admin()) already
-- covers insert/update/delete of every column added here — no change needed.

create table public.template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id text not null references public.templates (id) on delete cascade,
  version integer not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create unique index template_versions_template_id_version_key on public.template_versions (template_id, version);

alter table public.template_versions enable row level security;

-- Admin-only — version history is never surfaced to end users.
create policy "Admins can manage template versions"
  on public.template_versions for all
  using (public.is_admin ())
  with check (public.is_admin ());

-- template-previews (0012) was written only by a service-role script until
-- now. Preview re-render runs client-side in the admin's own browser tab
-- (real canvas/MediaRecorder export, no server render infra), so an admin's
-- own session now needs write access too.
create policy "Admins can upload template preview videos"
  on storage.objects for insert
  with check (bucket_id = 'template-previews' and public.is_admin ());

create policy "Admins can overwrite template preview videos"
  on storage.objects for update
  using (bucket_id = 'template-previews' and public.is_admin ());
