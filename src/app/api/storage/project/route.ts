import { NextResponse } from 'next/server';
import { z } from 'zod';

import { isR2Configured, r2 } from '@/lib/r2/server';
import { quotaMessage, SAFE_SEGMENT } from '@/lib/storage/rules';
import { forgetPrefix, getUsage, recount, reserve } from '@/lib/storage/usage';
import { createClient } from '@/lib/supabase/server';

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('duplicate'), from: z.string().regex(SAFE_SEGMENT), to: z.string().regex(SAFE_SEGMENT) }),
  z.object({ action: z.literal('delete'), projectId: z.string().regex(SAFE_SEGMENT) }),
]);

/** Copies one of the user's project folders to another (Duplicate
 * project/template — counts against the storage limit, refused as a whole
 * if it wouldn't fit), or deletes one (Delete project — the space is freed
 * at once). Both stay inside the signed-in user's own {user_id}/ folder. */
export async function POST(request: Request) {
  if (!isR2Configured()) return NextResponse.json({ error: "File storage isn't set up on this server." }, { status: 503 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const store = r2();
  const bucket = store.bucketName('private');
  const body = parsed.data;
  if (body.action === 'delete') {
    const prefix = `${user.id}/${body.projectId}/`;
    const deleted = await store.deletePrefix(bucket, prefix);
    await forgetPrefix(user.id, prefix);
    return NextResponse.json({ ok: true, deleted, usage: await getUsage(user.id) });
  }
  const fromPrefix = `${user.id}/${body.from}/`;
  const objects = await store.list(bucket, fromPrefix);
  const copies = objects.map((o) => ({ key: `${user.id}/${body.to}/${o.key.slice(fromPrefix.length)}`, bytes: o.size }));
  let reservation = await reserve(user.id, copies);
  if (!reservation.ok) {
    await recount(user.id);
    reservation = await reserve(user.id, copies);
  }
  if (!reservation.ok) return NextResponse.json({ error: quotaMessage(reservation.usage), code: 'quota', usage: reservation.usage }, { status: 413 });
  for (let i = 0; i < objects.length; i += 10) {
    await Promise.all(objects.slice(i, i + 10).map((o) => store.copy(bucket, o.key, `${user.id}/${body.to}/${o.key.slice(fromPrefix.length)}`)));
  }
  return NextResponse.json({ ok: true, copied: objects.length, usage: reservation.usage });
}
