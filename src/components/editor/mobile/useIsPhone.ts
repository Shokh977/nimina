'use client';

import { useSyncExternalStore } from 'react';

import { PHONE_QUERY } from '@/lib/device';

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(PHONE_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/** true on a phone (portrait under 768px wide, or a short touch landscape
 * screen), false otherwise, null during server rendering — the layout
 * can't be known before the first client render. Follows rotation live. */
export function useIsPhone(): boolean | null {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => null,
  );
}
