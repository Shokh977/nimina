import { z } from 'zod';

import { MSG } from '@/lib/auth/messages';
import { callbackUrl, emailField, fail, limitOr429, ok, parseBody } from '@/lib/auth/route';
import { createClient } from '@/lib/supabase/server';

const Body = z.object({ email: emailField });

/** Re-sends the sign-up verification email (link + code). */
export async function POST(request: Request) {
  const body = await parseBody(request, Body);
  if (!body) return fail('Enter a valid email address.');
  const limited = await limitOr429('resend', request, body.email);
  if (limited) return limited;

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: 'signup', email: body.email, options: { emailRedirectTo: callbackUrl(request, '/projects') } });
  if (error) console.error('[auth/resend-verification]', error.code, error.message);
  return ok(MSG.resendSent);
}
