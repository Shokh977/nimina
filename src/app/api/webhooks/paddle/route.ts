import { EventName } from '@paddle/paddle-node-sdk';
import { NextResponse } from 'next/server';

import { subscriptionGrantsAccess } from '@/lib/paddle/access';
import { isPaddleConfigured } from '@/lib/paddle/config';
import { createPaddleClient } from '@/lib/paddle/server';
import { createAdminClient } from '@/lib/supabase/admin';

type AdminClient = ReturnType<typeof createAdminClient>;

/** Upserts the `customers` mirror table, keyed by Paddle's customer id —
 * idempotent, safe to call from every event type that carries a
 * `customerId` (subscription.*, transaction.completed, customer.*).
 *
 * Paddle's customer.* events carry an email but not our internal user id
 * (no customData on the Customer entity itself); subscription/transaction
 * events carry the user id (via customData) but not an email inline. Each
 * call site passes whichever it has, and this resolves the other side by
 * matching against `profiles` (email <-> id), so the row ends up complete
 * regardless of which event happens to arrive first. */
async function upsertCustomer(supabase: AdminClient, paddleCustomerId: string, known: { userId?: string | null; email?: string | null }) {
  let userId = known.userId ?? null;
  let email = known.email ?? null;

  if (!email && userId) {
    const { data } = await supabase.from('profiles').select('email').eq('id', userId).maybeSingle();
    email = data?.email ?? null;
  }
  if (!userId && email) {
    const { data } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();
    userId = data?.id ?? null;
  }
  // Nothing usable yet (e.g. a subscription event with no matching profile) —
  // leave it for a later event on the same customer id to fill in.
  if (!email) return;

  const { error } = await supabase.from('customers').upsert({ paddle_customer_id: paddleCustomerId, user_id: userId, email }, { onConflict: 'paddle_customer_id' });
  if (error) throw error;
}

/** Minimal shape shared by every subscription.* notification payload —
 * each Paddle SDK event class names its `.data` type slightly differently
 * (SubscriptionCreatedNotification vs SubscriptionNotification, etc.) but
 * they're all structurally compatible with this. */
interface SubscriptionEventData {
  id: string;
  status: string;
  customerId: string;
  currentBillingPeriod: { endsAt: string } | null;
  items: Array<{ price: { id: string } | null; product: { id: string } | null }>;
  customData: Record<string, unknown> | null;
  scheduledChange: { action: string; effectiveAt: string } | null;
}

async function syncSubscription(sub: SubscriptionEventData) {
  const userId = typeof sub.customData?.user_id === 'string' ? sub.customData.user_id : null;
  if (!userId) {
    console.error('[paddle webhook] subscription has no user_id in customData:', sub.id);
    return;
  }

  const supabase = createAdminClient();

  // Idempotent: re-delivered/duplicate webhooks just upsert the same row.
  const { error: upsertError } = await supabase.from('subscriptions').upsert(
    {
      user_id: userId,
      paddle_subscription_id: sub.id,
      paddle_customer_id: sub.customerId,
      status: sub.status,
      price_id: sub.items[0]?.price?.id ?? null,
      product_id: sub.items[0]?.product?.id ?? null,
      current_period_end: sub.currentBillingPeriod?.endsAt ?? null,
      scheduled_change_action: sub.scheduledChange?.action ?? null,
      scheduled_change_at: sub.scheduledChange?.effectiveAt ?? null,
    },
    { onConflict: 'paddle_subscription_id' },
  );
  if (upsertError) throw upsertError;

  await upsertCustomer(supabase, sub.customerId, { userId });

  const plan = subscriptionGrantsAccess(sub.status) ? 'pro' : 'free';

  // A canceled/paused subscription must never downgrade someone who
  // separately bought lifetime access (see 0015_lifetime_purchases.sql) —
  // lifetime isn't its own plan value, it's just 'pro' with no expiry, so
  // this is the one place that distinction has to be checked explicitly.
  if (plan === 'free') {
    const { data: lifetimePurchase } = await supabase.from('purchases').select('id').eq('user_id', userId).limit(1).maybeSingle();
    if (lifetimePurchase) return;
  }

  const { error: profileError } = await supabase.from('profiles').update({ plan }).eq('id', userId);
  if (profileError) throw profileError;
}

/** Minimal shape of a Customer notification's `.data` (customer.created /
 * customer.updated) — just what upsertCustomer needs. */
interface CustomerEventData {
  id: string;
  email: string;
}

async function handleCustomerEvent(customer: CustomerEventData) {
  const supabase = createAdminClient();
  await upsertCustomer(supabase, customer.id, { email: customer.email });
}

/** Minimal shape of a Transaction notification's `.data` — only the fields
 * handleTransactionCompleted needs. `transaction.completed` fires for
 * every successful charge, including a subscription's recurring renewals,
 * so this only acts when the transaction's price matches the configured
 * one-time lifetime price; anything else is left to the subscription.*
 * events above. */
interface TransactionEventData {
  id: string;
  customerId: string | null;
  customData: Record<string, unknown> | null;
  items: Array<{ price: { id: string } | null }>;
  details: { totals: { total: string; currencyCode: string } | null } | null;
}

async function handleTransactionCompleted(txn: TransactionEventData) {
  const priceId = txn.items[0]?.price?.id ?? null;
  if (!priceId) return;

  const supabase = createAdminClient();

  // Matches against every price pricing_config has ever recorded for
  // 'lifetime', not just the current one — an admin can replace the price
  // (see src/lib/paddle/catalog.ts's setPrice), and a transaction that
  // started just before that change still has to resolve correctly.
  const { data: lifetimePrice } = await supabase.from('pricing_config').select('id').eq('key', 'lifetime').eq('paddle_price_id', priceId).limit(1).maybeSingle();
  if (!lifetimePrice) return;

  const userId = typeof txn.customData?.user_id === 'string' ? txn.customData.user_id : null;
  if (!userId || !txn.customerId) {
    console.error('[paddle webhook] lifetime transaction missing user_id/customerId:', txn.id);
    return;
  }

  const { error: upsertError } = await supabase.from('purchases').upsert(
    {
      user_id: userId,
      paddle_transaction_id: txn.id,
      paddle_customer_id: txn.customerId,
      price_id: priceId,
      amount: txn.details?.totals?.total ?? null,
      currency: txn.details?.totals?.currencyCode ?? null,
    },
    { onConflict: 'paddle_transaction_id' },
  );
  if (upsertError) throw upsertError;

  await upsertCustomer(supabase, txn.customerId, { userId });

  const { error: profileError } = await supabase.from('profiles').update({ plan: 'pro' }).eq('id', userId);
  if (profileError) throw profileError;
}

export async function POST(request: Request) {
  if (!isPaddleConfigured()) {
    return NextResponse.json({ error: 'Paddle is not configured on this server.' }, { status: 503 });
  }

  const signature = request.headers.get('paddle-signature');
  const rawBody = await request.text();
  if (!signature) {
    return NextResponse.json({ error: 'Missing Paddle-Signature header.' }, { status: 400 });
  }

  const paddle = createPaddleClient();
  let event;
  try {
    event = await paddle.webhooks.unmarshal(rawBody, process.env.PADDLE_WEBHOOK_SECRET!, signature);
  } catch (err) {
    console.error('[paddle webhook] signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }
  if (!event) {
    return NextResponse.json({ error: 'Unrecognized event.' }, { status: 400 });
  }

  try {
    switch (event.eventType) {
      case EventName.SubscriptionCreated:
      case EventName.SubscriptionUpdated:
      case EventName.SubscriptionActivated:
      case EventName.SubscriptionCanceled:
      case EventName.SubscriptionPastDue:
      case EventName.SubscriptionPaused:
      case EventName.SubscriptionResumed:
      case EventName.SubscriptionTrialing:
        await syncSubscription(event.data);
        break;
      case EventName.TransactionCompleted:
        await handleTransactionCompleted(event.data);
        break;
      case EventName.CustomerCreated:
      case EventName.CustomerUpdated:
        await handleCustomerEvent(event.data);
        break;
      default:
        // Other event types aren't needed yet — safely ignored.
        break;
    }
  } catch (err) {
    console.error('[paddle webhook] failed to process event:', event.eventType, err);
    return NextResponse.json({ error: 'Failed to process event.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
