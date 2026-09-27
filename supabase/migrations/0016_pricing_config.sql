-- Admin-managed Paddle pricing. Append-only, like template_versions
-- (0013_template_editor.sql) — a price *change* inserts a new row rather
-- than updating one in place, because Paddle prices are effectively
-- immutable once created (you don't edit an existing price's amount,
-- since that would retroactively change what already-billed customers
-- pay — you create a new price and point future checkouts at it). "The
-- current price" for a key is just its most recent row.
--
-- Keeping this as history (not a single mutable row) also matters for the
-- webhook: a transaction that started right before an admin changes a
-- price still has to resolve back to the right key, so the lookup checks
-- "does this price id appear anywhere under this key," not just "is it
-- today's price."
--
-- Three keys: 'pro_monthly', 'pro_yearly', 'lifetime'. Free is $0 and has
-- no row here at all — nothing to configure for it.
create table public.pricing_config (
  id uuid primary key default gen_random_uuid (),
  key text not null check (key in ('pro_monthly', 'pro_yearly', 'lifetime')),
  paddle_product_id text not null,
  paddle_price_id text not null,
  amount_cents integer not null,
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create index pricing_config_key_created_idx on public.pricing_config (key, created_at desc);

alter table public.pricing_config enable row level security;

-- Pricing is public by definition — anonymous visitors need to see it on
-- /pricing before signing in.
create policy "Anyone can read pricing config"
  on public.pricing_config for select
  using (true);

-- Admin-only, insert only — matches the append-only contract; there is no
-- update/delete policy at all, so even an admin can't rewrite history.
create policy "Admins can add pricing config"
  on public.pricing_config for insert
  with check (public.is_admin ());
