import { NextResponse } from 'next/server';
import { z } from 'zod';

import { isPaddleConfigured } from '@/lib/paddle/config';
import { createPaddleClient } from '@/lib/paddle/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/** Paddle statuses that are still (or may resume) billing. */
const LIVE_STATUSES = ['active', 'trialing', 'past_due', 'paused'];

/**
 * Permanently deletes the signed-in account, in an order that can't leave
 * someone half-deleted but still billed:
 *  1. cancel every live Paddle subscription, effective immediately — and
 *     stop if that fails (never delete an account that's still paying);
 *  2. delete every stored file under the user's folder ({user_id}/…);
 *  3. delete their projects;
 *  4. delete the auth user — the profile row cascades; subscriptions,
 *     purchases and customers rows are KEPT with user_id cleared
 *     (migration 0018 — billing records must survive, see CLAUDE.md).
 * Requires the literal "DELETE", checked here as well as in the UI.
 */
export async function POST(request: Request) {
  const parsed = z.object({ confirm: z.literal('DELETE') }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Type DELETE to confirm.' }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Your session has expired. Sign in again.' }, { status: 401 });
  const admin = createAdminClient();

  // 1. Subscriptions.
  const { data: subs } = await admin.from('subscriptions').select('paddle_subscription_id, status').eq('user_id', user.id);
  const live = (subs ?? []).filter((s) => LIVE_STATUSES.includes(s.status));
  if (live.length) {
    if (!isPaddleConfigured()) {
      return NextResponse.json({ error: 'Billing is unreachable right now, so your subscription could not be cancelled. Nothing was deleted. Try again later.' }, { status: 503 });
    }
    const paddle = createPaddleClient();
    for (const s of live) {
      try {
        await paddle.subscriptions.cancel(s.paddle_subscription_id, { effectiveFrom: 'immediately' });
      } catch (err) {
        console.error('[account/delete] cancel failed', s.paddle_subscription_id, err);
        return NextResponse.json({ error: 'We could not cancel your subscription, so nothing was deleted. Try again, or cancel it from Manage subscription first.' }, { status: 502 });
      }
    }
  }

  // 2. Files: paths are {user_id}/{project_id}/{file}.
  const bucket = admin.storage.from('assets');
  const { data: folders, error: listError } = await bucket.list(user.id, { limit: 1000 });
  if (listError) return NextResponse.json({ error: 'File storage is unreachable, so nothing was deleted. Try again.' }, { status: 502 });
  for (const folder of folders ?? []) {
    const prefix = `${user.id}/${folder.name}`;
    for (;;) {
      const { data: items } = await bucket.list(prefix, { limit: 1000 });
      if (!items?.length) break;
      const { error } = await bucket.remove(items.map((i) => `${prefix}/${i.name}`));
      if (error) return NextResponse.json({ error: 'Some files could not be deleted. Your account is still here. Try again.' }, { status: 502 });
      if (items.length < 1000) break;
    }
  }

  // 3. Projects. 4. The account.
  const { error: projError } = await admin.from('projects').delete().eq('user_id', user.id);
  if (projError) return NextResponse.json({ error: 'Your projects could not be deleted. Your account is still here. Try again.' }, { status: 500 });
  const { error: userError } = await admin.auth.admin.deleteUser(user.id);
  if (userError) {
    console.error('[account/delete] deleteUser failed', userError.message);
    return NextResponse.json({ error: 'Your files and projects were deleted, but the account itself could not be. Try again, or contact support.' }, { status: 500 });
  }

  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
  return NextResponse.json({ ok: true, cancelledSubscriptions: live.length });
}
