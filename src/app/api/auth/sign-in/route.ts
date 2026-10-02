import { z } from 'zod';

import { MSG, friendlyAuthError } from '@/lib/auth/messages';
import { emailField, fail, limitOr429, ok, parseBody, setPersistCookie } from '@/lib/auth/route';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const Body = z.object({ email: emailField, password: z.string().min(1).max(200), stay: z.boolean().default(true) });

/** Email + password sign-in. A wrong password and an unknown address get
 * the same answer; "verify your email first" only appears once the
 * password was right (so it reveals nothing to someone without it). */
export async function POST(request: Request) {
  const body = await parseBody(request, Body);
  if (!body) return fail('Enter your email and password.');
  const limited = await limitOr429('sign-in', request, body.email);
  if (limited) return limited;

  await setPersistCookie(body.stay);
  const supabase = await createClient({ persist: body.stay });
  const { data, error } = await supabase.auth.signInWithPassword({ email: body.email, password: body.password });
  if (error) {
    const unverified = error.code === 'email_not_confirmed' || /email not confirmed/i.test(error.message);
    return fail(unverified ? MSG.unverified : friendlyAuthError(error, MSG.badCredentials), unverified ? 403 : 401, unverified ? 'unverified' : 'bad_credentials');
  }
  // Accounts that predate app_metadata.has_password (set at sign-up and
  // whenever a password is set) learn it here.
  if (data.user && !data.user.app_metadata?.has_password) {
    await createAdminClient().auth.admin.updateUserById(data.user.id, { app_metadata: { has_password: true } });
  }
  return ok();
}
