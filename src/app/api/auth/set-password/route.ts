import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';

import { friendlyAuthError } from '@/lib/auth/messages';
import { checkPassword } from '@/lib/auth/password';
import { RECOVERY_COOKIE, fail, limitOr429, ok, parseBody } from '@/lib/auth/route';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const Body = z.object({ password: z.string().max(200), currentPassword: z.string().max(200).optional() });

/**
 * Sets or changes the signed-in user's password.
 * - No password yet (signed up with Google or a code): just set it.
 * - Has one: the current password is required — unless this session came
 *   from a password-reset link (RECOVERY_COOKIE, set by /auth/callback).
 * `app_metadata.has_password` (server-writable only) records which applies.
 */
export async function POST(request: Request) {
  const body = await parseBody(request, Body);
  if (!body) return fail('Enter a new password.');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return fail('Your session has expired — sign in again.', 401, 'signed_out');

  const limited = await limitOr429('set-password', request, user.email);
  if (limited) return limited;
  const weak = checkPassword(body.password, user.email);
  if (weak) return fail(weak, 400, 'weak_password');

  const cookieStore = await cookies();
  const fromResetLink = cookieStore.get(RECOVERY_COOKIE)?.value === user.id;
  if (user.app_metadata?.has_password && !fromResetLink) {
    if (!body.currentPassword) return fail('Enter your current password.', 400, 'current_required');
    // Check it on a throwaway client so the user's own session cookies are untouched.
    const probe = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: wrong } = await probe.auth.signInWithPassword({ email: user.email, password: body.currentPassword });
    if (wrong) return fail('Your current password is incorrect.', 401, 'bad_current');
    await probe.auth.signOut({ scope: 'local' }); // don't leave the check's session lying around
  }

  const { error } = await supabase.auth.updateUser({ password: body.password, data: { password_prompt_done: true } });
  if (error) return fail(friendlyAuthError(error), 400, error.code);
  await createAdminClient().auth.admin.updateUserById(user.id, { app_metadata: { has_password: true } });
  if (fromResetLink) cookieStore.delete(RECOVERY_COOKIE);
  return ok('Password saved.');
}
