-- Profiles: one row per auth user, auto-created on signup.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  plan text not null default 'free',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid () = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid () = id);

-- No insert policy for users: rows are created only by the trigger below
-- (security definer), so users can never create/impersonate another profile.

create function public.handle_new_user () returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user ();
