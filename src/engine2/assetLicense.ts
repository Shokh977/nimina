/**
 * Every built-in asset we ship (Lottie icons here; music library tracks —
 * see supabase/migrations/0011_music_license.sql — and any future built-in
 * sticker/image set) carries one of these, so it's always traceable that
 * we either made it ourselves or hold a real commercial redistribution
 * license for it. Not applied to anything a *user* uploads — that's their
 * asset, not ours to license.
 */
export interface AssetLicense {
  /** 'original' — we drew/authored it ourselves, no third-party rights
   * involved. 'cc0' — public domain / no-rights-reserved third-party work.
   * 'licensed' — a specific commercial license we hold; `licenseNote` must
   * say what it is and where the paperwork lives. */
  kind: 'original' | 'cc0' | 'licensed';
  /** Required when kind === 'licensed': what the license is and where to
   * find the agreement (e.g. "Commercial license, Acme Icons Pack,
   * invoice #4471, see /legal/licenses/acme-icons.pdf"). */
  licenseNote?: string;
  author?: string;
}

export const ORIGINAL: AssetLicense = { kind: 'original', author: 'Promo Studio' };
