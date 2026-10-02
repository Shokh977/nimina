import { z } from 'zod';

import { MSG, friendlyAuthError } from '@/lib/auth/messages';
import { checkPassword } from '@/lib/auth/password';
import { callbackUrl, emailField, fail, limitOr429, ok, parseBody, setPersistCookie } from '@/lib/auth/route';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const Body = z.object({ email: emailField, password: z.string().max(200) });

/** Email + password sign-up. Enforces the password rules server-side, then
 * Supabase sends the verification email (link + code); the account can't
 * sign in — so can't export — until it's verified. The answer is the same
 * whether or not the address already has an account. */
export async function POST(request: Request) {
  const body = await parseBody(request, Body);
  if (!body) return fail('Enter a valid email address.');
  const weak = checkPassword(body.password, body.email);
  if (weak) return fail(weak, 400, 'weak_password');
  const limited = await limitOr429('sign-up', request, body.email);
  if (limited) return limited;

  await setPersistCookie(true);
  const supabase = await createClient({ persist: true });
  const { data, error } = await supabase.auth.signUp({ email: body.email, password: body.password, options: { emailRedirectTo: callbackUrl(request, '/projects') } });
  if (error && !/already registered|already exists/i.test(error.message) && error.code !== 'user_already_exists') {
    return fail(friendlyAuthError(error), error.status === 429 ? 429 : 400, error.code);
  }
  // A real new account (an existing address comes back with no identities).
  if (data.user && (data.user.identities?.length ?? 0) > 0) {
    await createAdminClient().auth.admin.updateUserById(data.user.id, { app_metadata: { has_password: true } });
    if (data.session) console.warn('[auth/sign-up] Supabase returned a session at sign-up — "Confirm email" is OFF, so addresses are not being verified. Turn it on (CLAUDE.md, Accounts).');
  }
  return ok(MSG.signUpSent);
}
