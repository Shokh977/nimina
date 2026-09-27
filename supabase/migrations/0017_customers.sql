-- Customers: mirrors Paddle's Customer entity, keyed by Paddle's own
-- customer id (not our internal user id, since Paddle's customer.* events
-- don't carry our customData — only transaction/subscription events do).
-- user_id is resolved by matching email against profiles when it isn't
-- otherwise known yet. Written only by the webhook (service role), same
-- as subscriptions/profiles.plan.
create table public.customers (
  paddle_customer_id text primary key,
  user_id uuid references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customers_user_id_idx on public.customers (user_id);

alter table public.customers enable row level security;

create policy "Users can view own customer row"
  on public.customers for select
  using (auth.uid () = user_id);

-- Reuses the set_updated_at() function created in 0002_projects.sql.
create trigger customers_set_updated_at
  before update on public.customers
  for each row
  execute procedure public.set_updated_at ();

-- Subscriptions: record which product backed a subscription (a product can
-- back more than one price — monthly vs yearly — this is which one), and
-- whether a scheduled change (e.g. "cancel at period end", set from the
-- customer portal) is pending. A pending scheduled change must never be
-- treated as an actual downgrade — status only flips (e.g. to 'canceled')
-- once Paddle actually executes the change and fires its own event; until
-- then this is purely informational for the UI.
alter table public.subscriptions
  add column product_id text,
  add column scheduled_change_action text,
  add column scheduled_change_at timestamptz;
