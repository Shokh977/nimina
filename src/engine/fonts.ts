/**
 * Waits for the faces a project's render will use, so the first frames of
 * an export (or a still) aren't drawn with fallback metrics. Fonts are
 * loaded lazily by the browser — a face only downloads once something uses
 * it — so without this the opening frames of an export can be measured
 * and drawn before the real font arrives.
 */
import { FONTS } from './constants';
import { collectStrings } from './localization';
import { localeDef, SCRIPT_FAMILIES, type ScriptKey } from './locales';
import type { Project } from './types';

/** document.fonts.load never rejects for a missing face, but it can wait
 * on a stalled network request — cap it so a slow font fetch delays an
 * export rather than hanging it. */
const LOAD_TIMEOUT_MS = 8000;

/** Registers the script fonts' @font-face rules on demand. The engine
 * can't import CSS itself (it's framework-free), so the app provides this
 * (src/components/scriptFontLoader.ts). */
type ScriptCssLoader = (script: ScriptKey) => Promise<void>;
let scriptCssLoader: ScriptCssLoader | null = null;
export function setScriptFontCssLoader(loader: ScriptCssLoader): void {
  scriptCssLoader = loader;
}

/** Makes `script`'s font usable: registers its @font-face rules, then
 * fetches the unicode-range slices covering `text` in both weights. */
export async function ensureScriptFont(script: ScriptKey, text: string, weights: number[]): Promise<void> {
  const family = SCRIPT_FAMILIES[script];
  if (!family || typeof document === 'undefined') return;
  if (!scriptCssLoader) throw new Error(`No script font loader registered — can't load ${family}.`);
  await scriptCssLoader(script);
  await Promise.all(weights.map((w) => document.fonts.load(`${w} 40px "${family}"`, text || ' ').catch(() => [])));
}

export async function ensureProjectFonts(project: Project): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const font = FONTS[project.font];
  const button = font.h === 400 ? 400 : 700; // drawOutro's CTA button weight
  const specs = [`${font.h} 40px "${font.name}"`, `${font.s} 40px "${font.name}"`, `${button} 40px "${font.name}"`, '600 40px Figtree', '400 40px Figtree'];
  const script = project.renderLocale ? localeDef(project.renderLocale.locale).script : 'latin';
  const loads = Promise.all([
    ...specs.map((f) => document.fonts.load(f).catch(() => [])),
    // A localized copy: the script font, for exactly the text it renders.
    ensureScriptFont(script, collectStrings(project).map((s) => s.source).join(' '), [...new Set([font.h, font.s, button])]),
  ]).then(() => document.fonts.ready);
  await Promise.race([loads, new Promise((r) => setTimeout(r, LOAD_TIMEOUT_MS))]);
}
