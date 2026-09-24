let warned = false;

/**
 * Whether NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY are set.
 * Used to let the rest of the app (proxy, protected pages) degrade
 * gracefully — skipping auth instead of hard-crashing — while Supabase
 * hasn't been set up yet (see AGENTS.md for the setup steps). Once you've
 * filled in .env.local, this always returns true and route protection
 * takes effect normally.
 */
export function isSupabaseConfigured(): boolean {
  const configured = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!configured && !warned) {
    warned = true;
    console.warn('[supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set — auth and route protection are disabled. See AGENTS.md for setup steps.');
  }
  return configured;
}
