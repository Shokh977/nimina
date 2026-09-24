import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server-side Supabase client for Server Components, Route Handlers and
 * Server Actions — reads the session from request cookies via `next/headers`.
 * Still uses the public anon key; RLS is what actually scopes access, this
 * just lets the server render as the signed-in user.
 *
 * Create a new instance per request (never module-level/shared) — that's
 * the contract @supabase/ssr's createServerClient requires.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, which can't set cookies — fine,
          // as long as middleware.ts is refreshing the session on navigation.
        }
      },
    },
  });
}
