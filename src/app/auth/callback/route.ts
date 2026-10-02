import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { RECOVERY_COOKIE } from '@/lib/auth/route';
import { createClient } from '@/lib/supabase/server';

const EMAIL_OTP_TYPES: EmailOtpType[] = ['email', 'magiclink', 'signup', 'invite', 'recovery', 'email_change'];

/** The PKCE exchange's own wording is developer-facing; say what happened. */
function friendly(message: string): string {
  if (/code verifier/i.test(message)) return 'That sign-in link was opened in a different browser than the one that requested it. Enter the 6-digit code from the email instead, or request a new link here.';
  if (/expired|invalid/i.test(message)) return 'That sign-in link has expired or was already used. Request a new one below.';
  return message;
}

/**
 * Lands both sign-in methods:
 *
 * - Email links (sign-up verification, password reset, email change) →
 *   `?token_hash=…&type=…`; the Supabase email templates build them as
 *   `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=<email|recovery|email_change>`.
 *   Verified server-side, so it works in ANY browser or device — no PKCE
 *   code verifier involved. See CLAUDE.md ("Auth email").
 * - Google (and email links from templates that still use the default
 *   {{ .ConfirmationURL }}) → `?code=…`, the PKCE exchange, which only
 *   completes in the browser that started the flow.
 *
 * Supabase can also redirect here with an error (e.g. an expired or
 * already-used link) — surface it on /login rather than a generic failure.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  // /projects, not /editor: /editor creates a project on arrival, which would
  // spend a free user's single project before they've picked a template.
  const rawNext = searchParams.get('next');
  const next = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/projects';
  const fail = (message: string) => NextResponse.redirect(`${origin}/login?next=${encodeURIComponent(next)}&error=${encodeURIComponent(friendly(message))}`);

  const upstreamError = searchParams.get('error_description') || searchParams.get('error');
  if (upstreamError) {
    console.error('[auth/callback] Supabase redirected with an error:', upstreamError);
    return fail(upstreamError);
  }

  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  if (tokenHash && type && EMAIL_OTP_TYPES.includes(type)) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      const res = NextResponse.redirect(`${origin}${next}`);
      // A password-reset link: let /reset-password set a new password
      // without the current one, for the next 15 minutes only.
      if (type === 'recovery' && data.user) res.cookies.set(RECOVERY_COOKIE, data.user.id, { httpOnly: true, sameSite: 'lax', secure: origin.startsWith('https'), path: '/', maxAge: 15 * 60 });
      return res;
    }
    console.error('[auth/callback] verifyOtp(token_hash) failed:', error.message);
    return fail(error.message);
  }

  const code = searchParams.get('code');
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    console.error('[auth/callback] exchangeCodeForSession failed:', error.message);
    return fail(error.message);
  }

  console.error('[auth/callback] No code, token_hash or error param on callback request:', request.url);
  return fail('No sign-in code received.');
}
