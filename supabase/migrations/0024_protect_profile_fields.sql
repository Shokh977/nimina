-- SECURITY FIX: users could make themselves Pro and admin.
--
-- profiles has an "update your own row" policy (auth.uid() = id), and the
-- authenticated role may update every column — so any signed-in user could
-- run `supabase.from('profiles').update({ plan: 'pro', role: 'admin' })`
-- from the browser console. Confirmed with a throwaway account before this
-- migration.
--
-- Only these may change plan, role, id or email:
--   - the server (service role: the Paddle webhook, account routes),
--   - direct database access (migrations, the SQL editor),
--   - an admin (the /admin/users table).
-- Everyone else gets an error; their other columns are unaffected (profiles
-- has no other user-editable columns today).

create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
-- Invoker rights on purpose: current_user must be the real caller.
set search_path = public
as $$
begin
  if (new.plan is distinct from old.plan
      or new.role is distinct from old.role
      or new.id is distinct from old.id
      or new.email is distinct from old.email)
     and coalesce(auth.role(), '') <> 'service_role'
     and current_user not in ('postgres', 'supabase_admin', 'supabase_auth_admin', 'service_role')
     and not public.is_admin()
  then
    raise exception 'Only an administrator can change plan, role or email on a profile'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_fields on public.profiles;
create trigger profiles_protect_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

revoke all on function public.protect_profile_fields() from public, anon, authenticated;
