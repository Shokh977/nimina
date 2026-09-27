-- One-time "Lifetime Pro" purchases: one row per completed Paddle
-- transaction for the lifetime price, kept in sync by the webhook at
-- /api/webhooks/paddle (transaction.completed). Deliberately NOT a new
-- profiles.plan value — a lifetime purchase just sets plan = 'pro' (same
-- as an active subscription), so every existing plan check in the app
-- (editor page, projects page, AI Director/element-detect routes,
-- PLAN_LIMITS) keeps working unchanged. This table exists purely so the
-- webhook can tell "does this user have a lifetime purchase" before ever
-- downgrading them back to 'free' when an unrelated subscription cancels,
-- and so the pricing page can show "Lifetime access" instead of a
-- subscription-billed state.
create table public.purchases (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references auth.users (id) on delete cascade,
  paddle_transaction_id text not null unique,
  paddle_customer_id text not null,
  price_id text,
  amount text,
  currency text,
  purchased_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index purchases_user_id_idx on public.purchases (user_id);

alter table public.purchases enable row level security;

create policy "Users can view own purchases"
  on public.purchases for select
  using (auth.uid () = user_id);

-- Same shape as "Admins can view all events"/"Admins can view all
-- projects" (0010_admin.sql) — support/reporting visibility.
create policy "Admins can view all purchases"
  on public.purchases for select
  using (public.is_admin ());
