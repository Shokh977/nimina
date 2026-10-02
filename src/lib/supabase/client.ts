import { createBrowserClient } from '@supabase/ssr';

import { applyPersistence, PERSIST_COOKIE, persistFromCookieValue } from '@/lib/auth/cookies';

function readCookies(): { name: string; value: string }[] {
  if (typeof document === 'undefined' || !document.cookie) return [];
  return document.cookie.split('; ').map((c) => {
    const i = c.indexOf('=');
    return { name: decodeURIComponent(c.slice(0, i)), value: decodeURIComponent(c.slice(i + 1)) };
  });
}

/** Browser-side Supabase client. Uses the public anon key only — every
 * table it touches is protected by Row Level Security. Writes its auth
 * cookies itself so the "Stay signed in" preference (PERSIST_COOKIE) also
 * applies to tokens refreshed in the browser. */
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: readCookies,
      setAll(cookiesToSet) {
        const persist = persistFromCookieValue(readCookies().find((c) => c.name === PERSIST_COOKIE)?.value);
        for (const { name, value, options } of cookiesToSet) {
          const o = applyPersistence(options, persist) ?? {};
          let s = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Path=${o.path ?? '/'}`;
          if (o.maxAge !== undefined) s += `; Max-Age=${o.maxAge}`;
          if (o.domain) s += `; Domain=${o.domain}`;
          if (o.sameSite) s += `; SameSite=${o.sameSite === true ? 'Strict' : o.sameSite}`;
          if (o.secure || location.protocol === 'https:') s += '; Secure';
          document.cookie = s;
        }
      },
    },
  });
}

/** Records the "Stay signed in" choice before a sign-in that the browser
 * completes itself (Google). The server routes set it on their own. */
export function setPersistPreference(persist: boolean) {
  document.cookie = `${PERSIST_COOKIE}=${persist ? '1' : '0'}; Path=/; Max-Age=${400 * 24 * 60 * 60}; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
}
