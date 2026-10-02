import type { EmailOtpType } from '@supabase/supabase-js';
import { z } from 'zod';

import { MSG, friendlyAuthError } from '@/lib/auth/messages';
import { emailField, fail, limitOr429, ok, parseBody, setPersistCookie } from '@/lib/auth/route';
import { createClient } from '@/lib/supabase/server';

const Body = z.object({ email: emailField, code: z.string().trim().regex(/^\d{6,10}$/), stay: z.boolean().default(true) });

/** Completes a code sign-in — from any device, since it's just the email
 * and the typed code (no browser-held PKCE verifier). Also verifies a new
 * account's email when the code came from the sign-up email. */
export async function POST(request: Request) {
  const body = await parseBody(request, Body);
  if (!body) return fail('Enter the 6-digit code from the email.');
  const limited = await limitOr429('otp-verify', request, body.email);
  if (limited) return limited;

  await setPersistCookie(body.stay);
  const supabase = await createClient({ persist: body.stay });
  let lastError = null;
  // Sign-in codes verify as "email"; a sign-up confirmation code may need "signup".
  for (const type of ['email', 'signup'] as EmailOtpType[]) {
    const { error } = await supabase.auth.verifyOtp({ email: body.email, token: body.code, type });
    if (!error) return ok();
    lastError = error;
    if (error.status === 429 || error.code?.startsWith('over_')) break;
  }
  return fail(friendlyAuthError(lastError, MSG.badCode), lastError?.status === 429 ? 429 : 400, 'bad_code');
}
