import { EventName } from '@paddle/paddle-node-sdk';
import { NextResponse } from 'next/server';

import { isPaddleConfigured } from '@/lib/paddle/config';
import { createPaddleClient } from '@/lib/paddle/server';
import { createAdminClient } from '@/lib/supabase/admin';

/** Subscription statuses that keep a user on the Pro plan. `past_due` is
 * included deliberately: Paddle retries failed payments for a while
 * (dunning), and downgrading instantly on the first failed charge is bad
 * UX — the user only actually loses Pro once Paddle gives up and moves the
 * subscription to `canceled` (or `paused`), which fires its own event. */
const PRO_STATUSES = new Set(['active', 'trialing', 'past_due']);

/** Minimal shape shared by every subscription.* notification payload —
 * each Paddle SDK event class names its `.data` type slightly differently
 * (SubscriptionCreatedNotification vs SubscriptionNotification, etc.) but
 * they're all structurally compatible with this. */
interface SubscriptionEventData {
  id: string;
  status: string;
  customerId: string;
  currentBillingPeriod: { endsAt: string } | null;
  items: Array<{ price: { id: string } | null }>;
  customData: Record<string, unknown> | null;
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
      current_period_end: sub.currentBillingPeriod?.endsAt ?? null,
    },
    { onConflict: 'paddle_subscription_id' },
  );
  if (upsertError) throw upsertError;

  const plan = PRO_STATUSES.has(sub.status) ? 'pro' : 'free';
  const { error: profileError } = await supabase.from('profiles').update({ plan }).eq('id', userId);
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
      default:
        // Other event types (transactions, customers, etc.) aren't needed yet.
        break;
    }
  } catch (err) {
    console.error('[paddle webhook] failed to process event:', event.eventType, err);
    return NextResponse.json({ error: 'Failed to process event.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
