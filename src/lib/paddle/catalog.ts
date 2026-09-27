import type { CurrencyCode, Paddle } from '@paddle/paddle-node-sdk';
import type { SupabaseClient } from '@supabase/supabase-js';

/** The three admin-configurable price points — see
 * supabase/migrations/0016_pricing_config.sql. Free is $0 and isn't here;
 * it needs no Paddle object. */
export type PricingKey = 'pro_monthly' | 'pro_yearly' | 'lifetime';

export interface PricingEntry {
  paddleProductId: string;
  paddlePriceId: string;
  amountCents: number;
  currency: CurrencyCode;
}

export type Pricing = Record<PricingKey, PricingEntry | null>;

const KEYS: PricingKey[] = ['pro_monthly', 'pro_yearly', 'lifetime'];

/** The current price for each key — its most recent `pricing_config` row,
 * or null if an admin hasn't set that one yet. Public read (RLS allows
 * anyone), safe to call from a signed-out page. */
export async function getCurrentPricing(supabase: SupabaseClient): Promise<Pricing> {
  const result: Pricing = { pro_monthly: null, pro_yearly: null, lifetime: null };
  await Promise.all(
    KEYS.map(async (key) => {
      const { data } = await supabase.from('pricing_config').select('paddle_product_id, paddle_price_id, amount_cents, currency').eq('key', key).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (data) {
        result[key] = { paddleProductId: data.paddle_product_id, paddlePriceId: data.paddle_price_id, amountCents: data.amount_cents, currency: data.currency as CurrencyCode };
      }
    }),
  );
  return result;
}

/** Finds a Paddle product id to attach a new price to — reuses whichever
 * one any existing pricing_config row already points at (all three keys
 * share one "Pro" product), or creates it the very first time any price
 * is ever set. */
async function getOrCreateProductId(paddle: Paddle, supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase.from('pricing_config').select('paddle_product_id').limit(1).maybeSingle();
  if (data?.paddle_product_id) return data.paddle_product_id;

  const product = await paddle.products.create({ name: 'Pro', taxCategory: 'saas' });
  return product.id;
}

/** Sets a new price for one key. Never edits an existing Paddle price
 * (they're effectively immutable — an existing subscriber's billing
 * shouldn't change retroactively): this always creates a brand-new Price
 * object and records it as the new "current" row for that key. Old rows,
 * and the Paddle price objects they point at, are left alone. */
export async function setPrice(paddle: Paddle, supabase: SupabaseClient, { key, amountCents, currency, userId }: { key: PricingKey; amountCents: number; currency: CurrencyCode; userId: string | null }): Promise<PricingEntry> {
  const productId = await getOrCreateProductId(paddle, supabase);

  const price = await paddle.prices.create({
    productId,
    description: key,
    unitPrice: { amount: String(amountCents), currencyCode: currency },
    // A price with no billing cycle is a one-time (non-recurring) price —
    // exactly what "lifetime" needs; the two Pro keys bill monthly/yearly.
    billingCycle: key === 'lifetime' ? null : { interval: key === 'pro_yearly' ? 'year' : 'month', frequency: 1 },
  });

  const { error } = await supabase.from('pricing_config').insert({
    key,
    paddle_product_id: productId,
    paddle_price_id: price.id,
    amount_cents: amountCents,
    currency,
    created_by: userId,
  });
  if (error) throw error;

  return { paddleProductId: productId, paddlePriceId: price.id, amountCents, currency };
}
