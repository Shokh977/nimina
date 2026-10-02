-- Accounts: auth rate limiting, active-session listing, and account
-- deletion that keeps billing records.
--
-- 1. Rate limiting for sign-in, code requests, password resets etc. —
--    counted per email and per IP (both stored only as SHA-256 hashes),
--    in fixed windows, through one atomic function the server calls with
--    the service role. Nothing here is readable by users.
-- 2. my_sessions() / revoke_my_session() — the signed-in user's own rows of
--    auth.sessions (device, IP, last used), for /account.
-- 3. Account deletion: subscriptions / purchases / customers referenced
--    auth.users ON DELETE CASCADE, so deleting a user would have deleted
--    their billing records — which must be kept (CLAUDE.md: "live
--    fulfillment state — never delete"; also invoices/tax). They now keep
--    the row and clear user_id. template_versions.created_by,
--    site_content.updated_by and pricing_config.created_by had no ON DELETE
--    rule at all, so deleting an admin would have failed outright; they
--    also become SET NULL.

-- ---------- 1. rate limits ----------

create table public.auth_rate_limits (
  key text not null,                 -- sha256 hex of "<action>:<email|ip>:<value>"
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);

alter table public.auth_rate_limits enable row level security;
-- No policies: only the service role (which bypasses RLS) touches it.

create index auth_rate_limits_window_idx on public.auth_rate_limits (window_start);

/** Records one hit for `p_key` in the current `p_window_seconds` window and
 * returns the hit count, so the caller can compare it with its limit and
 * compute Retry-After from the window. Old windows are swept as it goes. */
create or replace function public.hit_rate_limit(p_key text, p_window_seconds integer)
returns table (hits integer, window_start timestamptz)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
begin
  insert into public.auth_rate_limits as r (key, window_start, hits)
  values (p_key, w, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning r.hits, r.window_start into hits, window_start;

  -- Cheap opportunistic cleanup: anything older than a day is irrelevant.
  if random() < 0.02 then
    delete from public.auth_rate_limits where auth_rate_limits.window_start < now() - interval '1 day';
  end if;
  return next;
end;
$$;

revoke all on function public.hit_rate_limit(text, integer) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer) to service_role;

-- ---------- 2. sessions ----------

create or replace function public.my_sessions()
returns table (
  id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  refreshed_at timestamp,
  user_agent text,
  ip text,
  is_current boolean
)
language sql
stable
security definer
set search_path = auth, public
as $$
  select s.id, s.created_at, s.updated_at, s.refreshed_at, s.user_agent, host(s.ip),
         s.id::text = coalesce(auth.jwt() ->> 'session_id', '')
  from auth.sessions s
  where s.user_id = auth.uid()
    and (s.not_after is null or s.not_after > now())
  order by coalesce(s.refreshed_at::timestamptz, s.updated_at, s.created_at) desc;
$$;

revoke all on function public.my_sessions() from public, anon;
grant execute on function public.my_sessions() to authenticated;

/** Signs out one of the caller's OTHER sessions (deleting it revokes its
 * refresh tokens; its current access token lapses within the hour). */
create or replace function public.revoke_my_session(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = auth, public
as $$
declare
  n integer;
begin
  delete from auth.sessions
  where id = p_session_id
    and user_id = auth.uid()
    and id::text <> coalesce(auth.jwt() ->> 'session_id', '');
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

revoke all on function public.revoke_my_session(uuid) from public, anon;
grant execute on function public.revoke_my_session(uuid) to authenticated;

-- ---------- 3. deletion keeps billing records ----------

/** Replaces the foreign key on `tbl.col` -> auth.users(id) with one that
 * sets the column to NULL when the user is deleted. */
create or replace function pg_temp.fk_set_null(tbl text, col text)
returns void
language plpgsql
as $$
declare
  c text;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
    where con.contype = 'f'
      and con.conrelid = ('public.' || tbl)::regclass
      and con.confrelid = 'auth.users'::regclass
      and att.attname = col
  loop
    execute format('alter table public.%I drop constraint %I', tbl, c);
  end loop;
  execute format('alter table public.%I alter column %I drop not null', tbl, col);
  execute format(
    'alter table public.%I add constraint %I foreign key (%I) references auth.users (id) on delete set null',
    tbl, tbl || '_' || col || '_fkey', col
  );
end;
$$;

select pg_temp.fk_set_null('subscriptions', 'user_id');
select pg_temp.fk_set_null('purchases', 'user_id');
select pg_temp.fk_set_null('customers', 'user_id');
select pg_temp.fk_set_null('template_versions', 'created_by');
select pg_temp.fk_set_null('site_content', 'updated_by');
select pg_temp.fk_set_null('pricing_config', 'created_by');
