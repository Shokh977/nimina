/**
 * Supported languages, the script font each one needs, and the text-locale
 * context the renderer runs under.
 *
 * None of the six engine fonts carry Cyrillic, CJK, Arabic, Hebrew or
 * Devanagari glyphs, so each of those scripts gets one Noto Sans family
 * (self-hosted — src/styles/script-fonts/, loaded on demand by
 * src/components/scriptFontLoader.ts) placed right after the project font
 * in every font stack: Latin characters (app names, "Pro") still come from
 * the project font, everything else from the script font. Sans only, even
 * for Fraunces/DM Serif Display (a deliberate v1 choice).
 */
import type { RenderLocale } from './types';

export type ScriptKey = 'latin' | 'cyrillic' | 'jp' | 'kr' | 'sc' | 'tc' | 'arabic' | 'hebrew' | 'devanagari';

export interface LocaleDef {
  code: string;
  /** English name, for the UI. */
  label: string;
  /** Name in the language itself. */
  native: string;
  script: ScriptKey;
  dir: 'ltr' | 'rtl';
}

export const LOCALES: LocaleDef[] = [
  { code: 'en', label: 'English', native: 'English', script: 'latin', dir: 'ltr' },
  { code: 'de', label: 'German', native: 'Deutsch', script: 'latin', dir: 'ltr' },
  { code: 'fr', label: 'French', native: 'Français', script: 'latin', dir: 'ltr' },
  { code: 'es', label: 'Spanish', native: 'Español', script: 'latin', dir: 'ltr' },
  { code: 'pt-BR', label: 'Portuguese (Brazil)', native: 'Português (Brasil)', script: 'latin', dir: 'ltr' },
  { code: 'it', label: 'Italian', native: 'Italiano', script: 'latin', dir: 'ltr' },
  { code: 'nl', label: 'Dutch', native: 'Nederlands', script: 'latin', dir: 'ltr' },
  { code: 'pl', label: 'Polish', native: 'Polski', script: 'latin', dir: 'ltr' },
  { code: 'sv', label: 'Swedish', native: 'Svenska', script: 'latin', dir: 'ltr' },
  { code: 'tr', label: 'Turkish', native: 'Türkçe', script: 'latin', dir: 'ltr' },
  { code: 'id', label: 'Indonesian', native: 'Bahasa Indonesia', script: 'latin', dir: 'ltr' },
  { code: 'ru', label: 'Russian', native: 'Русский', script: 'cyrillic', dir: 'ltr' },
  { code: 'uk', label: 'Ukrainian', native: 'Українська', script: 'cyrillic', dir: 'ltr' },
  { code: 'el', label: 'Greek', native: 'Ελληνικά', script: 'cyrillic', dir: 'ltr' },
  { code: 'ja', label: 'Japanese', native: '日本語', script: 'jp', dir: 'ltr' },
  { code: 'ko', label: 'Korean', native: '한국어', script: 'kr', dir: 'ltr' },
  { code: 'zh-Hans', label: 'Chinese (Simplified)', native: '简体中文', script: 'sc', dir: 'ltr' },
  { code: 'zh-Hant', label: 'Chinese (Traditional)', native: '繁體中文', script: 'tc', dir: 'ltr' },
  { code: 'ar', label: 'Arabic', native: 'العربية', script: 'arabic', dir: 'rtl' },
  { code: 'he', label: 'Hebrew', native: 'עברית', script: 'hebrew', dir: 'rtl' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', script: 'devanagari', dir: 'ltr' },
];

/** Family name each script's @font-face rules declare (scripts/generate-font-css.mjs). */
export const SCRIPT_FAMILIES: Record<ScriptKey, string | null> = {
  latin: null,
  // Noto Sans' Cyrillic + Greek subsets only (Latin always comes from the project font).
  cyrillic: 'Noto Sans',
  jp: 'Noto Sans JP',
  kr: 'Noto Sans KR',
  sc: 'Noto Sans SC',
  tc: 'Noto Sans TC',
  arabic: 'Noto Sans Arabic',
  hebrew: 'Noto Sans Hebrew',
  devanagari: 'Noto Sans Devanagari',
};

export function localeDef(code: string): LocaleDef {
  return LOCALES.find((l) => l.code === code) ?? { code, label: code, native: code, script: 'latin', dir: 'ltr' };
}

/* ---------- text-locale context ---------- */

/** What text measurement/drawing needs to know about the language being
 * rendered. Module-level rather than threaded through every draw call:
 * render() (and the still-export measurements) set it for the duration of
 * one synchronous pass via withTextLocale, and the engine never renders
 * concurrently. The default is exactly the pre-localization behavior. */
export interface TextLocale {
  lang: string;
  dir: 'ltr' | 'rtl';
  /** Script font placed after the project font in every font stack. */
  scriptFamily: string | null;
  fontScale: number;
}

const DEFAULT_TEXT_LOCALE: TextLocale = { lang: 'en', dir: 'ltr', scriptFamily: null, fontScale: 1 };
let current: TextLocale = DEFAULT_TEXT_LOCALE;

export function currentTextLocale(): TextLocale {
  return current;
}

export function textLocaleFor(rl: RenderLocale | undefined): TextLocale {
  if (!rl) return DEFAULT_TEXT_LOCALE;
  return { lang: rl.locale, dir: rl.dir, scriptFamily: SCRIPT_FAMILIES[localeDef(rl.locale).script], fontScale: rl.fontScale };
}

/** Runs `fn` with `rl`'s text locale active, restoring the previous one
 * afterwards (even if `fn` throws). */
export function withTextLocale<T>(rl: RenderLocale | undefined, fn: () => T): T {
  const prev = current;
  current = textLocaleFor(rl);
  try {
    return fn();
  } finally {
    current = prev;
  }
}
