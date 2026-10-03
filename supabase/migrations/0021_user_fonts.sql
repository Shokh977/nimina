-- Custom font upload (Pro). One row per uploaded font file; the file itself
-- lives in the private R2 bucket at {user_id}/fonts/{id}.{ext} (and counts
-- toward the user's storage limit like any other upload).
--
-- We are not a font licensor: the uploader must state they have the right
-- to use the font commercially, and when they said so is recorded here
-- (rights_confirmed_at is required — no row without it).

create table public.user_fonts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Family name read from the font file itself (its name table).
  family text not null,
  -- usWeightClass from the file (100–900); variable fonts report their default.
  weight integer not null default 400,
  italic boolean not null default false,
  format text not null check (format in ('woff2', 'truetype', 'opentype')),
  file_key text not null,
  bytes integer not null check (bytes > 0 and bytes <= 2 * 1024 * 1024),
  -- Characters the font has glyphs for, as [start, end] code point ranges —
  -- lets the editor warn when a language needs letters the font lacks.
  coverage jsonb not null default '[]'::jsonb,
  rights_confirmed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index user_fonts_user_idx on public.user_fonts (user_id);

alter table public.user_fonts enable row level security;

create policy "Users can see their own fonts"
  on public.user_fonts for select
  using (user_id = auth.uid ());
-- No insert/update/delete policies: only the server (service role) writes,
-- after validating the file, the plan (Pro) and the 10-font limit.
