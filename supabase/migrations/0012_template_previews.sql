-- Public bucket for rendered template preview videos (gallery card loop +
-- landing page), same public-bucket-plus-public-table-read shape as
-- 0006/0007's music-library (this content is equally non-sensitive —
-- procedurally-generated sample screens, not user data). Uploaded by
-- scripts/render-template-previews.mjs using the service-role key; there
-- is no end-user write path.
--
-- URLs live here rather than in code (src/engine/templates/*.ts) because
-- they're rendered/uploaded artifacts, not template content — keeps
-- TemplateDef free of anything that isn't pure, code-defined data, and
-- lets a preview be re-rendered/re-pointed without a deploy, matching why
-- 0008_templates.sql put enabled/sort_order here instead of in code.
insert into storage.buckets (id, name, public)
values ('template-previews', 'template-previews', true)
on conflict (id) do nothing;

create policy "Anyone can read template preview videos"
  on storage.objects for select
  using (bucket_id = 'template-previews');

alter table public.templates
  add column if not exists preview_video_9x16_url text,
  add column if not exists preview_video_16x9_url text;
