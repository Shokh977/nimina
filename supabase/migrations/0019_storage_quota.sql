-- Per-user storage limits (Free 200 MB, Pro 5 GB — the numbers live in
-- src/lib/plan.ts and are passed in by the server).
--
-- Files live in Cloudflare R2, which can't count bytes per user, so every
-- private file is recorded here when the server approves its upload
-- (/api/storage/upload). reserve_storage() is the enforcement point: under
-- a per-user lock it sums what the user already stores (not counting files
-- being overwritten), refuses if the new files would pass the limit, and
-- otherwise records them — so two uploads at once can't both squeeze past
-- the limit. Deleting files/projects deletes the rows, freeing the space
-- immediately; a recount (src/lib/storage/usage.ts) re-syncs the rows with
-- what's really in R2.

create table public.storage_objects (
  key text primary key,                  -- R2 key: {user_id}/{project_id}/{file}
  user_id uuid not null references auth.users (id) on delete cascade,
  bytes bigint not null check (bytes >= 0),
  created_at timestamptz not null default now()
);

create index storage_objects_user_idx on public.storage_objects (user_id);

alter table public.storage_objects enable row level security;

create policy "Users can see their own stored files"
  on public.storage_objects for select
  using (user_id = auth.uid ());
-- No write policies: only the server (service role) records files.

/** Bytes the user currently stores. */
create or replace function public.storage_used(p_user_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(bytes), 0)::bigint from public.storage_objects where user_id = p_user_id;
$$;

/** Atomically records `p_keys` (with `p_bytes`) for the user if that keeps
 * them within `p_limit` bytes. Keys already recorded are being overwritten,
 * so their old size doesn't count. Returns (ok, used_before, needed). */
create or replace function public.reserve_storage(p_user_id uuid, p_keys text[], p_bytes bigint[], p_limit bigint)
returns table (ok boolean, used bigint, needed bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used bigint;
  v_needed bigint;
begin
  if array_length(p_keys, 1) is distinct from array_length(p_bytes, 1) then
    raise exception 'keys and sizes differ in length';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select coalesce(sum(o.bytes), 0) into v_used
  from public.storage_objects o
  where o.user_id = p_user_id and not (o.key = any (p_keys));

  select coalesce(sum(b), 0) into v_needed from unnest(p_bytes) as b;

  if v_used + v_needed > p_limit then
    return query select false, v_used, v_needed;
    return;
  end if;

  insert into public.storage_objects (key, user_id, bytes)
  select k, p_user_id, b from unnest(p_keys, p_bytes) as t (k, b)
  on conflict (key) do update set bytes = excluded.bytes, user_id = excluded.user_id, created_at = now();

  return query select true, v_used, v_needed;
end;
$$;

revoke all on function public.storage_used(uuid) from public, anon, authenticated;
revoke all on function public.reserve_storage(uuid, text[], bigint[], bigint) from public, anon, authenticated;
grant execute on function public.storage_used(uuid) to service_role;
grant execute on function public.reserve_storage(uuid, text[], bigint[], bigint) to service_role;
