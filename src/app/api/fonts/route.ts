import { NextResponse } from 'next/server';

import { MAX_FONT_BYTES, MAX_FONTS } from '@/lib/fonts/limits';
import { FontRejected, parseFont } from '@/lib/fonts/parse';
import { isR2Configured, r2 } from '@/lib/r2/server';
import { quotaMessage } from '@/lib/storage/rules';
import { forgetPrefix, recount, reserve } from '@/lib/storage/usage';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const EXT = { woff2: 'woff2', truetype: 'ttf', opentype: 'otf' } as const;
const MIME = { woff2: 'font/woff2', truetype: 'font/ttf', opentype: 'font/otf' } as const;

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** The signed-in user's uploaded fonts, each with a one-hour link to the file. */
export async function GET() {
  const { supabase, user } = await currentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { data, error } = await supabase.from('user_fonts').select('id, family, weight, italic, format, file_key, bytes, rights_confirmed_at, created_at, coverage').order('created_at');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const store = isR2Configured() ? r2() : null;
  const fonts = await Promise.all(
    (data ?? []).map(async (f) => ({
      id: f.id,
      family: f.family,
      weight: f.weight,
      italic: f.italic,
      format: f.format,
      bytes: f.bytes,
      rightsConfirmedAt: f.rights_confirmed_at,
      coverage: f.coverage,
      url: store ? await store.signGet(store.bucketName('private'), f.file_key) : null,
    })),
  );
  return NextResponse.json({ fonts, max: MAX_FONTS }, { headers: { 'Cache-Control': 'no-store' } });
}

/**
 * Uploads a font (Pro only). multipart/form-data: `file` (.woff2/.ttf/.otf,
 * ≤ 2 MB) and `rights=yes` — the uploader's statement that they may use the
 * font commercially; we record when they made it. The file is parsed here
 * (src/lib/fonts/parse.ts) and rejected if it isn't a complete, real font.
 */
export async function POST(request: Request) {
  const { supabase, user } = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in to upload fonts.' }, { status: 401 });
  if (!isR2Configured()) return NextResponse.json({ error: "File storage isn't set up on this server." }, { status: 503 });

  const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle();
  if (profile?.plan !== 'pro') return NextResponse.json({ error: 'Uploading your own fonts is a Pro feature.', code: 'pro' }, { status: 403 });

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a font file to upload.' }, { status: 400 });
  if (form?.get('rights') !== 'yes') return NextResponse.json({ error: 'Confirm that you have the right to use this font commercially.' }, { status: 400 });
  if (file.size > MAX_FONT_BYTES) return NextResponse.json({ error: `That font is ${(file.size / 1048576).toFixed(1)} MB — the limit is 2 MB per file.` }, { status: 413 });

  const admin = createAdminClient();
  const { count } = await admin.from('user_fonts').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
  if ((count ?? 0) >= MAX_FONTS) return NextResponse.json({ error: `You've uploaded ${MAX_FONTS} fonts, the most an account can have. Delete one to add another.` }, { status: 409 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  let parsed;
  try {
    parsed = parseFont(bytes, file.name);
  } catch (err) {
    if (err instanceof FontRejected) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }

  const id = crypto.randomUUID();
  const key = `${user.id}/fonts/${id}.${EXT[parsed.format]}`;
  let reservation = await reserve(user.id, [{ key, bytes: bytes.length }]);
  if (!reservation.ok) {
    await recount(user.id);
    reservation = await reserve(user.id, [{ key, bytes: bytes.length }]);
  }
  if (!reservation.ok) return NextResponse.json({ error: quotaMessage(reservation.usage), code: 'quota' }, { status: 413 });

  const store = r2();
  try {
    await store.put(store.bucketName('private'), key, bytes, MIME[parsed.format], 'private, max-age=31536000, immutable');
  } catch (err) {
    console.error('[fonts] storing the file failed', err);
    await forgetPrefix(user.id, key); // release the space reserved above
    return NextResponse.json({ error: 'The font could not be stored. Try again.' }, { status: 502 });
  }
  const row = { id, user_id: user.id, family: parsed.family, weight: parsed.weight, italic: parsed.italic, format: parsed.format, file_key: key, bytes: bytes.length, coverage: parsed.coverage, rights_confirmed_at: new Date().toISOString() };
  const { error } = await admin.from('user_fonts').insert(row);
  if (error) {
    await store.delete(store.bucketName('private'), key).catch(() => {});
    await forgetPrefix(user.id, key);
    return NextResponse.json({ error: 'The font could not be saved. Try again.' }, { status: 500 });
  }
  return NextResponse.json({
    font: { id, family: parsed.family, weight: parsed.weight, italic: parsed.italic, format: parsed.format, bytes: bytes.length, rightsConfirmedAt: row.rights_confirmed_at, coverage: parsed.coverage, url: await store.signGet(store.bucketName('private'), key) },
    usage: reservation.usage,
  });
}
