import type { SupabaseClient } from '@supabase/supabase-js';

/** Fire-and-forget product event, scoped to the current session's user via
 * RLS (see supabase/migrations/0009_events.sql) — callers don't need to
 * pass a user id, and a logging failure never breaks the calling flow. */
export async function logEvent(supabase: SupabaseClient, type: string, meta: Record<string, unknown> = {}): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('events').insert({ user_id: user.id, type, meta });
  } catch (err) {
    console.error('[events] log failed', type, err);
  }
}
