import { z } from 'zod';

import { MSG, friendlyAuthError } from '@/lib/auth/messages';
import { callbackUrl, emailField, fail, limitOr429, ok, parseBody } from '@/lib/auth/route';
import { createClient } from '@/lib/supabase/server';

const Body = z.object({ email: emailField, intent: z.enum(['signin', 'signup']).default('signin') });

/** Sends a 6-digit sign-in code (Supabase OTP). From Sign in it never
 * creates an account; from Create account it does. Either way the answer
 * doesn't say whether the address exists. */
export async function POST(request: Request) {
  const body = await parseBody(request, Body);
  if (!body) return fail('Enter a valid email address.');
  const limited = await limitOr429('otp-request', request, body.email);
  if (limited) return limited;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: body.email,
    options: { shouldCreateUser: body.intent === 'signup', emailRedirectTo: callbackUrl(request, '/projects') },
  });
  // "Signups not allowed" = no such account on Sign in: answer as if sent.
  if (error && error.code !== 'otp_disabled' && !/signups not allowed/i.test(error.message)) {
    if (error.status === 429 || error.code?.startsWith('over_')) return fail(friendlyAuthError(error), 429, 'rate_limited');
    console.error('[auth/otp/request]', error.code, error.message);
    return fail(MSG.generic, 500);
  }
  return ok(MSG.codeSent);
}
