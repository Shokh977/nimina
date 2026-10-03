import { NextResponse } from 'next/server';

import { isR2Configured } from '@/lib/r2/server';
import { getUsage, recount } from '@/lib/storage/usage';
import { createClient } from '@/lib/supabase/server';

/** The signed-in user's storage usage and limit. `?recount=1` first
 * re-syncs with R2 (cleaning up unused files) — used by the meter after an
 * upload was refused, so it shows the real figure. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const wantRecount = new URL(request.url).searchParams.get('recount') === '1' && isR2Configured();
  const usage = wantRecount ? await recount(user.id) : await getUsage(user.id);
  return NextResponse.json(usage, { headers: { 'Cache-Control': 'no-store' } });
}
