-- Enforces the free plan's 1-saved-project limit at the database level
-- (not just in the UI) by replacing 0002's plain "own row" insert policy
-- with one that also checks profiles.plan and the user's existing project
-- count. Pro users (profiles.plan = 'pro') are unlimited.
drop policy "Users can insert own projects" on public.projects;

create policy "Users can insert own projects within their plan limit"
  on public.projects for insert
  with check (
    auth.uid () = user_id
    and (
      exists (
        select 1
        from public.profiles
        where id = auth.uid ()
          and plan = 'pro'
      )
      or (
        select count(*)
        from public.projects
        where user_id = auth.uid ()
      ) < 1
    )
  );
