import { NextResponse } from 'next/server';
import { z } from 'zod';

import { isR2Configured, projectKey, r2 } from '@/lib/r2/server';
import { SAFE_SEGMENT } from '@/lib/storage/rules';
import { createClient } from '@/lib/supabase/server';

const Body = z.object({
  projectId: z.string().regex(SAFE_SEGMENT),
  assetIds: z.array(z.string().regex(SAFE_SEGMENT)).max(300),
});

/** Signed, one-hour read URLs for files in one of the signed-in user's
 * project folders (keys are built from their own user id, so another
 * user's files can't be addressed). Missing files just 404 when fetched. */
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
  const entries = await Promise.all(parsed.data.assetIds.map(async (id) => [id, await store.signGet(bucket, projectKey(user.id, parsed.data.projectId, id))] as const));
  return NextResponse.json({ urls: Object.fromEntries(entries) }, { headers: { 'Cache-Control': 'no-store' } });
}
