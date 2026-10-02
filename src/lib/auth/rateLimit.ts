import { createHash } from 'node:crypto';

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * SERVER-ONLY. Per-email and per-IP rate limits for the auth routes, on top
 * of Supabase's own (which are per project and per IP only). Counted in
 * fixed windows by public.hit_rate_limit (supabase/migrations/0018), keyed
 * by a SHA-256 of action + email/IP so neither is stored in the clear.
 */

type Scope = 'email' | 'ip';
type Rule = { scope: Scope; max: number; windowSeconds: number };

export type RateLimitedAction = 'sign-in' | 'sign-up' | 'otp-request' | 'otp-verify' | 'reset' | 'resend' | 'set-password';

const RULES: Record<RateLimitedAction, Rule[]> = {
  // Password guessing: 5 tries per address per 15 min, more per IP for shared networks.
  'sign-in': [
    { scope: 'email', max: 5, windowSeconds: 15 * 60 },
    { scope: 'ip', max: 30, windowSeconds: 15 * 60 },
  ],
  'sign-up': [
    { scope: 'email', max: 3, windowSeconds: 60 * 60 },
    { scope: 'ip', max: 6, windowSeconds: 60 * 60 },
  ],
  // Each request sends an email.
  'otp-request': [
    { scope: 'email', max: 3, windowSeconds: 10 * 60 },
    { scope: 'ip', max: 15, windowSeconds: 10 * 60 },
  ],
  // Guessing a 6-digit code: 6 tries per address per code lifetime.
  'otp-verify': [
    { scope: 'email', max: 6, windowSeconds: 10 * 60 },
    { scope: 'ip', max: 40, windowSeconds: 10 * 60 },
  ],
  reset: [
    { scope: 'email', max: 3, windowSeconds: 60 * 60 },
    { scope: 'ip', max: 10, windowSeconds: 60 * 60 },
  ],
  resend: [
    { scope: 'email', max: 3, windowSeconds: 60 * 60 },
    { scope: 'ip', max: 10, windowSeconds: 60 * 60 },
  ],
  // Checking a "current password" is a guessing surface too.
  'set-password': [
    { scope: 'email', max: 5, windowSeconds: 15 * 60 },
    { scope: 'ip', max: 20, windowSeconds: 15 * 60 },
  ],
};

export type RateLimitResult = { ok: true } | { ok: false; retryAfter: number };

const hash = (s: string) => createHash('sha256').update(s).digest('hex');

export async function rateLimit(action: RateLimitedAction, who: { email?: string | null; ip?: string | null }): Promise<RateLimitResult> {
  const admin = createAdminClient();
  let retryAfter = 0;
  for (const rule of RULES[action]) {
    const value = rule.scope === 'email' ? who.email?.trim().toLowerCase() : who.ip;
    if (!value) continue;
    const { data, error } = await admin.rpc('hit_rate_limit', { p_key: hash(`${action}:${rule.scope}:${value}`), p_window_seconds: rule.windowSeconds });
    if (error) {
      // Fail open: a missing migration or a database hiccup must not lock
      // everyone out of signing in. Loud, so it gets noticed.
      console.error(`[rate-limit] hit_rate_limit failed (is migration 0018 applied?): ${error.message}`);
      return { ok: true };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (row && row.hits > rule.max) {
      const windowEnd = new Date(row.window_start).getTime() + rule.windowSeconds * 1000;
      retryAfter = Math.max(retryAfter, Math.ceil((windowEnd - Date.now()) / 1000));
    }
  }
  return retryAfter > 0 ? { ok: false, retryAfter } : { ok: true };
}

/** The caller's IP as Vercel reports it (x-real-ip, else the first
 * x-forwarded-for hop). null locally, where neither is set. */
export function clientIp(headers: Headers): string | null {
  return headers.get('x-real-ip') || headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
}

export function retryText(seconds: number): string {
  if (seconds < 90) return `${seconds} seconds`;
  return `${Math.ceil(seconds / 60)} minutes`;
}
