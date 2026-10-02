import { z } from 'zod';

import { MSG } from '@/lib/auth/messages';
import { callbackUrl, emailField, fail, limitOr429, ok, parseBody } from '@/lib/auth/route';
import { createClient } from '@/lib/supabase/server';

const Body = z.object({ email: emailField });

/** Sends a password-reset link. Same answer whether or not the address
 * has an account. */
export async function POST(request: Request) {
  const body = await parseBody(request, Body);
  if (!body) return fail('Enter a valid email address.');
  const limited = await limitOr429('reset', request, body.email);
  if (limited) return limited;

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(body.email, { redirectTo: callbackUrl(request, '/reset-password') });
  if (error) console.error('[auth/forgot-password]', error.code, error.message);
  return ok(MSG.resetSent);
}
