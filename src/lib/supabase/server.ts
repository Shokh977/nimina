import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { applyPersistence, PERSIST_COOKIE, persistFromCookieValue } from '@/lib/auth/cookies';

/**
 * Server-side Supabase client for Server Components, Route Handlers and
 * Server Actions — reads the session from request cookies via `next/headers`.
 * Still uses the public anon key; RLS is what actually scopes access, this
 * just lets the server render as the signed-in user.
 *
 * `persist` overrides the "Stay signed in" preference for this request
 * (the sign-in routes pass the box the user just ticked); otherwise it's
 * read from the PERSIST_COOKIE (src/lib/auth/cookies.ts).
 *
 * Create a new instance per request (never module-level/shared) — that's
 * the contract @supabase/ssr's createServerClient requires.
 */
export async function createClient(opts?: { persist?: boolean }) {
  const cookieStore = await cookies();
  const persist = opts?.persist ?? persistFromCookieValue(cookieStore.get(PERSIST_COOKIE)?.value);

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, applyPersistence(options, persist)));
        } catch {
          // Called from a Server Component, which can't set cookies — fine,
          // as long as middleware.ts is refreshing the session on navigation.
        }
      },
    },
  });
}
