'use client';

import { customFontFamily } from '@/engine/customFonts';
import { setCustomFontLoader } from '@/engine/fonts';
import type { CustomFontRef } from '@/engine/types';

/**
 * Registers uploaded fonts with the browser for the engine
 * (src/engine/fonts.ts setCustomFontLoader). Files are private, so their
 * URLs are short-lived signed links from /api/fonts. Each face is added
 * under its internal family name (customFontFamily) and declared for every
 * weight, so a single uploaded file is used as-is for headline and body
 * text instead of the browser faking a bold.
 */

type Listed = CustomFontRef & { url: string };
let listing: Promise<Map<string, Listed>> | null = null;
const loaded = new Map<string, Promise<void>>();

function list(force = false): Promise<Map<string, Listed>> {
  if (!listing || force) {
    listing = fetch('/api/fonts', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { fonts: [] }))
      .then((d: { fonts: Listed[] }) => new Map(d.fonts.map((f) => [f.id, f])))
      .catch(() => new Map());
  }
  return listing;
}

/** Forget cached links (after an upload or delete). */
export function refreshCustomFonts(): void {
  listing = null;
}

/** Adds an uploaded font file as a face under its internal family name,
 * for every weight. Shared with the standing font check (src/dev/fontCheck.ts). */
export async function registerFontFace(id: string, url: string, italic = false): Promise<void> {
  const face = new FontFace(customFontFamily(id), `url(${url})`, { weight: '1 1000', style: italic ? 'italic' : 'normal' });
  await face.load();
  document.fonts.add(face);
}

export function loadCustomFont(ref: CustomFontRef): Promise<void> {
  const existing = loaded.get(ref.id);
  if (existing) return existing;
  const p = (async () => {
    let f = (await list()).get(ref.id);
    if (!f) f = (await list(true)).get(ref.id);
    if (!f) throw new Error(`Font ${ref.family} is no longer in your account.`);
    await registerFontFace(ref.id, f.url, f.italic);
  })();
  loaded.set(ref.id, p);
  p.catch(() => loaded.delete(ref.id));
  return p;
}

if (typeof window !== 'undefined') setCustomFontLoader(loadCustomFont);
