import { NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Daily Vercel Cron (vercel.json) — one real database query, so the
 * Supabase free-tier project never counts as inactive and pauses (it
 * pauses after 7 days without activity). The weekly backup workflow is a
 * second, independent source of activity.
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is
 * set; anything else is refused so this can't be used to probe the app.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { count, error } = await createAdminClient().from('profiles').select('id', { count: 'exact', head: true });
  if (error) {
    console.error('[keepalive] database query failed', error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, profiles: count, at: new Date().toISOString() });
}
