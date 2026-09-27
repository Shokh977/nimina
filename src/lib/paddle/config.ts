let warned = false;

/** Mirrors src/lib/supabase/config.ts's graceful-degradation pattern:
 * /pricing and the webhook route stay usable (showing a clear message
 * instead of crashing) until Paddle env vars are actually filled in.
 *
 * Deliberately only checks account-level credentials — price ids used to
 * live here too, but they're now created and stored at runtime in the
 * `pricing_config` table (src/lib/paddle/catalog.ts), set from
 * /admin/pricing rather than pasted into .env.local. Whether pricing
 * itself is ready is a separate, runtime check against that table (done
 * where /pricing renders), not part of this env-var gate. */
export function isPaddleConfigured(): boolean {
  const configured = !!process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN && !!process.env.NEXT_PUBLIC_PADDLE_ENV && !!process.env.PADDLE_API_KEY && !!process.env.PADDLE_WEBHOOK_SECRET;
  if (!configured && !warned) {
    warned = true;
    console.warn('[paddle] Paddle env vars are not fully set — /pricing checkout and the webhook are disabled. See AGENTS.md for setup steps.');
  }
  return configured;
}

/** Deliberately not a silently-defaulting constant — guessing 'sandbox'
 * when this is unset could just as easily hide a real misconfiguration
 * (e.g. a live client token paired with no environment set). Every real
 * Paddle call site (getPaddle() in client.ts, createPaddleClient() in
 * server.ts) is already reached only after isPaddleConfigured() is true,
 * so this throwing here means "the account creds are set but the
 * environment isn't" — a real bug worth surfacing loudly, not a normal
 * not-configured-yet state. */
export function getPaddleEnv(): 'sandbox' | 'production' {
  const env = process.env.NEXT_PUBLIC_PADDLE_ENV;
  if (env !== 'sandbox' && env !== 'production') {
    throw new Error("NEXT_PUBLIC_PADDLE_ENV must be 'sandbox' or 'production' — refusing to silently default, since guessing wrong could mean running against the wrong Paddle account.");
  }
  return env;
}
