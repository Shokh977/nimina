let warned = false;

/** Mirrors src/lib/supabase/config.ts's graceful-degradation pattern:
 * /pricing and the webhook route stay usable (showing a clear message
 * instead of crashing) until Paddle env vars are actually filled in. */
export function isPaddleConfigured(): boolean {
  const configured =
    !!process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN &&
    !!process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_PRO_MONTHLY &&
    !!process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_PRO_YEARLY &&
    !!process.env.PADDLE_API_KEY &&
    !!process.env.PADDLE_WEBHOOK_SECRET;
  if (!configured && !warned) {
    warned = true;
    console.warn('[paddle] Paddle env vars are not fully set — /pricing checkout and the webhook are disabled. See AGENTS.md for setup steps.');
  }
  return configured;
}

export const PADDLE_ENV: 'sandbox' | 'production' = process.env.NEXT_PUBLIC_PADDLE_ENV === 'production' ? 'production' : 'sandbox';

export const PRICE_IDS = {
  monthly: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_PRO_MONTHLY ?? '',
  yearly: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_PRO_YEARLY ?? '',
};
