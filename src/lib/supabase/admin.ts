import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * SERVER-ONLY. Uses the service role key, which bypasses Row Level
 * Security entirely. Only ever import this from server-only code that has
 * no other way to write the data it needs — currently just the Paddle
 * webhook route, which has no user session/cookies to act as, and needs to
 * write subscriptions/profiles rows on the user's behalf based on a
 * verified Paddle event.
 *
 * Never import this from a Client Component or anything reachable from the
 * browser bundle.
 */
export function createAdminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
