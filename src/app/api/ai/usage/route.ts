import { NextResponse } from 'next/server';

import { aiUsage } from '@/lib/ai/usage';
import { createClient } from '@/lib/supabase/server';

/** This month's AI uses and what's left, per feature — shown next to each
 * AI button and on /account. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  return NextResponse.json(await aiUsage(supabase, user.id), { headers: { 'Cache-Control': 'no-store' } });
}
