import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

/** The signed-in user's active sessions (public.my_sessions, migration 0018). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { data, error } = await supabase.rpc('my_sessions');
  if (error) {
    console.error('[account/sessions] my_sessions failed (is migration 0018 applied?):', error.message);
    return NextResponse.json({ error: "Couldn't load your sessions." }, { status: 500 });
  }
  return NextResponse.json({ sessions: data ?? [] });
}

/** Signs out one other session (never the current one — Sign out does that). */
export async function DELETE(request: Request) {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('revoke_my_session', { p_session_id: parsed.data.id });
  if (error) return NextResponse.json({ error: "Couldn't sign that session out." }, { status: 500 });
  return NextResponse.json({ ok: data === true });
}
