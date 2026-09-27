import { NextResponse } from 'next/server';

import { isPaddleConfigured } from '@/lib/paddle/config';
import { setPrice, type PricingKey } from '@/lib/paddle/catalog';
import { createPaddleClient } from '@/lib/paddle/server';
import { createClient } from '@/lib/supabase/server';

const VALID_KEYS: PricingKey[] = ['pro_monthly', 'pro_yearly', 'lifetime'];

/** Admin-only: creates a real Paddle price (and the shared "Pro" product,
 * the first time this is ever called) for one of the three configurable
 * price points, and records it in `pricing_config`. Never touches an
 * existing Paddle price — see src/lib/paddle/catalog.ts's setPrice. */
export async function POST(request: Request) {
  if (!isPaddleConfigured()) {
    return NextResponse.json({ error: 'Paddle is not configured on this server.' }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admins only.' }, { status: 403 });

  const body = await request.json().catch(() => null);
  const key = body?.key;
  const amountCents = Number(body?.amountCents);
  const currency = typeof body?.currency === 'string' ? body.currency : 'USD';

  if (!VALID_KEYS.includes(key)) {
    return NextResponse.json({ error: `key must be one of ${VALID_KEYS.join(', ')}.` }, { status: 400 });
  }
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return NextResponse.json({ error: 'amountCents must be a positive integer (e.g. 500 for $5.00).' }, { status: 400 });
  }

  try {
    const paddle = createPaddleClient();
    const entry = await setPrice(paddle, supabase, { key, amountCents, currency, userId: user.id });
    return NextResponse.json({ entry });
  } catch (err) {
    console.error('[admin pricing] failed to set price:', err);
    const message = err instanceof Error ? err.message : 'Failed to create the Paddle price.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
