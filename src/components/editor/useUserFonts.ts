'use client';

import { useEffect, useSyncExternalStore } from 'react';

import { refreshCustomFonts } from '@/components/customFontLoader';

/** One of the account's uploaded fonts, as /api/fonts lists it. */
export interface UserFont {
  id: string;
  family: string;
  weight: number;
  italic: boolean;
  format: string;
  bytes: number;
  rightsConfirmedAt: string;
  coverage: Array<[number, number]>;
  url: string | null;
}

type State = { fonts: UserFont[]; max: number; loaded: boolean };
let state: State = { fonts: [], max: 10, loaded: false };
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** (Re)loads the account's fonts. */
export function reloadUserFonts(): Promise<void> {
  refreshCustomFonts();
  inflight = fetch('/api/fonts', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : { fonts: [], max: 10 }))
    .then((d: { fonts: UserFont[]; max: number }) => {
      state = { fonts: d.fonts, max: d.max ?? 10, loaded: true };
      emit();
    })
    .catch(() => {
      state = { ...state, loaded: true };
      emit();
    });
  return inflight;
}

/** The signed-in user's uploaded fonts (shared, fetched once). */
export function useUserFonts(): State {
  const snap = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
  useEffect(() => {
    if (!state.loaded && !inflight) void reloadUserFonts();
  }, []);
  return snap;
}

/** Characters in `text` the font has no glyph for. */
export function missingChars(font: Pick<UserFont, 'coverage'>, text: string): string[] {
  const missing = new Set<string>();
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (/\s/.test(ch) || ch === '*' || cp < 0x20) continue;
    let lo = 0,
      hi = font.coverage.length - 1,
      hit = false;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const [a, b] = font.coverage[mid];
      if (cp < a) hi = mid - 1;
      else if (cp > b) lo = mid + 1;
      else {
        hit = true;
        break;
      }
    }
    if (!hit) missing.add(ch);
  }
  return [...missing];
}
