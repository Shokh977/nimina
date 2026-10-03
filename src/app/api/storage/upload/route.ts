import { NextResponse } from 'next/server';
import { z } from 'zod';

import { isR2Configured, projectKey, r2 } from '@/lib/r2/server';
import { checkUpload, quotaMessage, SAFE_SEGMENT } from '@/lib/storage/rules';
import { recount, reserve } from '@/lib/storage/usage';
import { createClient } from '@/lib/supabase/server';

const Body = z.object({
  kind: z.enum(['image', 'audio', 'thumbnail', 'template-preview']),
  projectId: z.string().regex(SAFE_SEGMENT),
  assetId: z.string().regex(SAFE_SEGMENT).optional(),
  contentType: z.string().max(100),
  size: z.number().int().nonnegative(),
});

const PREVIEW_NAME = /^preview-(9x16|16x9)\.(mp4|webm)$/;

/**
 * Approves one upload and returns a pre-signed R2 PUT URL for it. The
 * file's type and exact size are checked here against UPLOAD_RULES and
 * signed into the URL, so R2 rejects anything else; the key is always
 * built from the signed-in user's id, so nobody can write outside their
 * own {user_id}/ folder. It also counts against the user's storage limit
 * (Free 200 MB / Pro 5 GB): the file is reserved atomically before the URL
 * is issued, and if that would pass the limit, unused files are cleaned up
 * and the user's usage recounted before refusing. Template preview videos
 * (admins only) go to the public bucket and don't count.
 */
export async function POST(request: Request) {
  if (!isR2Configured()) return NextResponse.json({ error: "File storage isn't set up on this server." }, { status: 503 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid upload request.' }, { status: 400 });
  const { kind, projectId, assetId, contentType, size } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to upload files.' }, { status: 401 });

  const problem = checkUpload(kind, contentType, size);
  if (problem) return NextResponse.json({ error: problem }, { status: 413 });

  const store = r2();
  if (kind === 'template-preview') {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admins only.' }, { status: 403 });
    if (!assetId || !PREVIEW_NAME.test(assetId)) return NextResponse.json({ error: 'Invalid preview name.' }, { status: 400 });
    const key = `template-previews/${projectId}/${assetId}`;
    const signed = await store.signPut(store.bucketName('public'), key, contentType, size);
    // ?v= busts browser/CDN caches when a preview is re-rendered at the same key.
    return NextResponse.json({ ...signed, publicUrl: `${store.publicObjectUrl(key)}?v=${Date.now()}` });
  }

  const name = kind === 'thumbnail' ? 'thumbnail.jpg' : assetId;
  if (!name) return NextResponse.json({ error: 'Missing asset id.' }, { status: 400 });
  const key = projectKey(user.id, projectId, name);
  let reservation = await reserve(user.id, [{ key, bytes: size }]);
  if (!reservation.ok) {
    await recount(user.id);
    reservation = await reserve(user.id, [{ key, bytes: size }]);
  }
  if (!reservation.ok) return NextResponse.json({ error: quotaMessage(reservation.usage), code: 'quota', usage: reservation.usage }, { status: 413 });
  const signed = await store.signPut(store.bucketName('private'), key, contentType, size);
  return NextResponse.json({ ...signed, path: key, usage: reservation.usage });
}
