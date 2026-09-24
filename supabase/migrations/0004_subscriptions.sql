-- Subscriptions: one row per Paddle subscription, kept in sync by the
-- webhook at /api/webhooks/paddle. Only the webhook (using the service role
-- key, which bypasses RLS) ever writes here — regular users can only read
-- their own row, matching how profiles.plan is also webhook-managed.
create table public.subscriptions (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references auth.users (id) on delete cascade,
  paddle_subscription_id text not null unique,
  paddle_customer_id text not null,
  status text not null, -- Paddle SubscriptionStatus: active | canceled | past_due | paused | trialing
  price_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_user_id_idx on public.subscriptions (user_id);
create index subscriptions_customer_id_idx on public.subscriptions (paddle_customer_id);

alter table public.subscriptions enable row level security;

create policy "Users can view own subscription"
  on public.subscriptions for select
  using (auth.uid () = user_id);

-- Reuses the set_updated_at() function created in 0002_projects.sql.
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row
  execute procedure public.set_updated_at ();
