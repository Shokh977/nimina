import { NextResponse } from 'next/server';
import { z } from 'zod';

import { isR2Configured, r2 } from '@/lib/r2/server';
import { SAFE_SEGMENT } from '@/lib/storage/rules';
import { createClient } from '@/lib/supabase/server';

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('duplicate'), from: z.string().regex(SAFE_SEGMENT), to: z.string().regex(SAFE_SEGMENT) }),
  z.object({ action: z.literal('delete'), projectId: z.string().regex(SAFE_SEGMENT) }),
]);

/** Copies one of the user's project folders to another (Duplicate
 * project/template), or deletes one (Delete project). Both stay inside the
 * signed-in user's own {user_id}/ folder. */
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
    const deleted = await store.deletePrefix(bucket, `${user.id}/${body.projectId}/`);
    return NextResponse.json({ ok: true, deleted });
  }
  const fromPrefix = `${user.id}/${body.from}/`;
  const objects = await store.list(bucket, fromPrefix);
  for (let i = 0; i < objects.length; i += 10) {
    await Promise.all(objects.slice(i, i + 10).map((o) => store.copy(bucket, o.key, `${user.id}/${body.to}/${o.key.slice(fromPrefix.length)}`)));
  }
  return NextResponse.json({ ok: true, copied: objects.length });
}
