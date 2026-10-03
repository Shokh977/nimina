/**
 * Waits for the faces a project's render will use, so the first frames of
 * an export (or a still) aren't drawn with fallback metrics. Fonts are
 * loaded lazily by the browser — a face only downloads once something uses
 * it — so without this the opening frames of an export can be measured
 * and drawn before the real font arrives.
 */
import { customFontsInUse, fontForChoice, projectFont } from './customFonts';
import { collectStrings } from './localization';
import { localeDef, SCRIPT_FAMILIES, type ScriptKey } from './locales';
import type { CustomFontRef, FontDef, Project } from './types';

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

/** Makes an uploaded font's face available under customFontFamily(id).
 * The engine can't fetch it (it doesn't know where files live), so the app
 * provides this (src/components/customFontLoader.ts). */
type CustomFontLoader = (ref: CustomFontRef) => Promise<void>;
let customFontLoader: CustomFontLoader | null = null;
export function setCustomFontLoader(loader: CustomFontLoader): void {
  customFontLoader = loader;
}

/** Every typeface a project draws with: its default plus any slide/intro/
 * outro override (built-in or uploaded). */
export function fontsInUse(project: Project): FontDef[] {
  const defs = [projectFont(project)];
  for (const o of [project.intro, project.outro, ...project.scenes]) {
    const choice = (o as { style?: { font?: string } }).style?.font;
    if (choice) defs.push(fontForChoice(project, choice));
  }
  return [...new Map(defs.map((d) => [d.name, d])).values()];
}

export async function ensureProjectFonts(project: Project): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const custom = customFontsInUse(project);
  const fonts = fontsInUse(project);
  const weights = new Set<number>();
  const specs = ['600 40px Figtree', '400 40px Figtree'];
  for (const font of fonts) {
    const button = font.h === 400 ? 400 : 700; // drawOutro's CTA button weight
    for (const w of [font.h, font.s, button]) {
      weights.add(w);
      specs.push(`${w} 40px "${font.name}"`);
    }
  }
  const script = project.renderLocale ? localeDef(project.renderLocale.locale).script : 'latin';
  const loads = Promise.all([
    // Uploaded faces first (they must be registered before document.fonts.load can find them).
    Promise.all(custom.map((ref) => (customFontLoader ? customFontLoader(ref).catch((err) => console.warn('[fonts] uploaded font failed to load', ref.family, err)) : Promise.resolve()))).then(() =>
      Promise.all(specs.map((f) => document.fonts.load(f).catch(() => []))),
    ),
    // A localized copy: the script font, for exactly the text it renders.
    ensureScriptFont(script, collectStrings(project).map((s) => s.source).join(' '), [...weights]),
  ]).then(() => document.fonts.ready);
  await Promise.race([loads, new Promise((r) => setTimeout(r, LOAD_TIMEOUT_MS))]);
}
