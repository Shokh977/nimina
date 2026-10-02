import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { PERSIST_COOKIE } from './cookies';
import { MSG } from './messages';
import { clientIp, rateLimit, retryText, type RateLimitedAction } from './rateLimit';

/** Shared plumbing for the /api/auth/* route handlers. SERVER-ONLY. */

export type AuthResult = { ok: true; message?: string } | { ok: false; error: string; code?: string; retryAfter?: number };

export const ok = (message?: string) => NextResponse.json<AuthResult>({ ok: true, message });
export const fail = (error: string, status = 400, code?: string) => NextResponse.json<AuthResult>({ ok: false, error, code }, { status });

export const emailField = z.string().trim().toLowerCase().email().max(254);

export async function parseBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T> | null> {
  try {
    const parsed = schema.safeParse(await request.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Runs the action's per-email/per-IP limits; a NextResponse (429) when
 * exceeded, otherwise null. */
export async function limitOr429(action: RateLimitedAction, request: Request, email?: string | null): Promise<NextResponse | null> {
  const r = await rateLimit(action, { email, ip: clientIp(request.headers) });
  if (r.ok) return null;
  return NextResponse.json<AuthResult>({ ok: false, error: MSG.rateLimited(retryText(r.retryAfter)), code: 'rate_limited', retryAfter: r.retryAfter }, { status: 429, headers: { 'Retry-After': String(r.retryAfter) } });
}

/** Stores the "Stay signed in" choice made on the form. */
export async function setPersistCookie(persist: boolean) {
  (await cookies()).set(PERSIST_COOKIE, persist ? '1' : '0', { path: '/', maxAge: 400 * 24 * 60 * 60, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
}

/** Where email links land: the callback, which then goes on to `next`. */
export const callbackUrl = (request: Request, next: string) => `${new URL(request.url).origin}/auth/callback?next=${encodeURIComponent(next)}`;

/** Short-lived marker set when a password-reset link is used, letting
 * /api/auth/set-password accept a new password without the current one. */
export const RECOVERY_COOKIE = 'nimina-recovery';
