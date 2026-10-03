import { NextResponse } from 'next/server';

import { isR2Configured, r2 } from '@/lib/r2/server';
import { forgetPrefix, getUsage } from '@/lib/storage/usage';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/** Deletes one of the signed-in user's fonts (file, storage record, row).
 * Projects that used it fall back to their built-in typeface. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { data: font } = await supabase.from('user_fonts').select('id, file_key').eq('id', id).maybeSingle();
  if (!font) return NextResponse.json({ error: 'Font not found.' }, { status: 404 });
  if (isR2Configured()) {
    const store = r2();
    await store.delete(store.bucketName('private'), font.file_key);
    await forgetPrefix(user.id, font.file_key);
  }
  await createAdminClient().from('user_fonts').delete().eq('id', id).eq('user_id', user.id);
  return NextResponse.json({ ok: true, usage: await getUsage(user.id) });
}
