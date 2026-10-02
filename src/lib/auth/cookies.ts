/**
 * "Stay signed in". Supabase's auth cookies default to a 400-day lifetime
 * (persist across browser restarts). When a user unticks "Stay signed in",
 * this cookie records it and every place that writes the auth cookies
 * (server client, middleware, browser client) drops the lifetime, making
 * them session cookies that end when the browser closes. Deletions
 * (maxAge 0, i.e. sign-out) are never touched.
 */
export const PERSIST_COOKIE = 'nimina-persist';

type CookieOpts = { maxAge?: number; expires?: Date | number | string } & Record<string, unknown>;

export function applyPersistence<T extends CookieOpts | undefined>(options: T, persist: boolean): T {
  if (persist || !options) return options;
  if (options.maxAge !== undefined && options.maxAge <= 0) return options;
  const { maxAge: _maxAge, expires: _expires, ...rest } = options;
  void _maxAge;
  void _expires;
  return rest as T;
}

/** The preference itself, as stored: absent or anything but "0" = stay signed in. */
export function persistFromCookieValue(value: string | undefined): boolean {
  return value !== '0';
}
