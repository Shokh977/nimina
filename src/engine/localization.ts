/**
 * Per-language text overrides. The project itself always holds the source
 * language's text; every other language is a set of overrides keyed by
 * string key (collectStrings). localizeProject() swaps them in to produce
 * a render-time copy — the renderer itself never knows about languages
 * beyond the RenderLocale that copy carries.
 */
import { localeDef } from './locales';
import { UNSPACED } from './text';
import type { LanguageEntry, Localization, Project, RenderLocale, Slide, TranslatedString } from './types';

export type StringField = 'appName' | 'tagline' | 'headline' | 'sub' | 'badge' | 'callout' | 'stickers' | 'cta' | 'button' | 'small' | 'notificationTitle' | 'notificationBody' | 'typedText';

export interface LocalizableString {
  key: string;
  /** Which editor group the string belongs to: 'app', 'slide:<id>' or 'outro'. */
  group: string;
  field: StringField;
  /** The source-language text. */
  source: string;
  /** For story-action strings: which action. */
  actionId?: string;
}

const FIELD_LABELS: Record<StringField, string> = {
  appName: 'App name',
  tagline: 'Intro tagline',
  headline: 'Headline',
  sub: 'Subtitle',
  badge: 'Badge',
  callout: 'Callout',
  stickers: 'Stickers',
  cta: 'Call to action',
  button: 'Button',
  small: 'Small print',
  notificationTitle: 'Notification title',
  notificationBody: 'Notification text',
  typedText: 'Typed text',
};
export const fieldLabel = (f: StringField) => FIELD_LABELS[f];

function slideStrings(s: Slide): LocalizableString[] {
  const group = `slide:${s.id}`;
  const out: LocalizableString[] = [];
  const add = (field: StringField, source: string, keySuffix: string = field, actionId?: string) => {
    if (source) out.push({ key: `s${s.id}.${keySuffix}`, group, field, source, actionId });
  };
  if (s.kind === 'story') {
    for (const a of s.actions) {
      if (a.type === 'notification') {
        add('notificationTitle', a.title, `${a.id}.title`, a.id);
        add('notificationBody', a.body, `${a.id}.body`, a.id);
      } else if (a.type === 'typeText') add('typedText', a.text, `${a.id}.text`, a.id);
    }
    return out;
  }
  add('headline', s.headline);
  add('sub', s.sub);
  if (s.kind === 'image' || s.kind === 'video') {
    add('badge', s.badge);
    add('callout', s.callout);
  }
  if (s.effect === 'stickers') add('stickers', s.stickers);
  return out;
}

/** Every translatable string in the project, in editor order: app name and
 * intro tagline, each slide's text, then the outro. Empty source strings
 * are skipped (nothing to translate). */
export function collectStrings(project: Project): LocalizableString[] {
  const out: LocalizableString[] = [];
  if (project.appName) out.push({ key: 'appName', group: 'app', field: 'appName', source: project.appName });
  if (project.intro.on && project.intro.tagline) out.push({ key: 'intro.tagline', group: 'app', field: 'tagline', source: project.intro.tagline });
  project.scenes.forEach((s) => out.push(...slideStrings(s)));
  if (project.outro.on) {
    const o = project.outro;
    if (o.cta) out.push({ key: 'outro.cta', group: 'outro', field: 'cta', source: o.cta });
    if (o.button) out.push({ key: 'outro.button', group: 'outro', field: 'button', source: o.button });
    if (o.small) out.push({ key: 'outro.small', group: 'outro', field: 'small', source: o.small });
  }
  return out;
}

/** FNV-1a — a short, stable fingerprint of a source string, so a
 * translation can tell whether its source changed after it was made. */
export function hashText(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export type StringStatus = 'translated' | 'untranslated' | 'outdated';

/** untranslated: never confirmed (missing, or still the cloned source
 * text); outdated: confirmed, but the source changed since. */
export function stringStatus(entry: TranslatedString | undefined, source: string): StringStatus {
  if (!entry || !entry.done) return 'untranslated';
  return entry.sourceHash === hashText(source) ? 'translated' : 'outdated';
}

export function newLanguageEntry(project: Project, locale: string): LanguageEntry {
  // Clones the source text into an editable override set.
  const strings: Record<string, TranslatedString> = {};
  for (const s of collectStrings(project)) strings[s.key] = { text: s.source, sourceHash: hashText(s.source), done: false };
  return { locale, fontScale: 1, strings };
}

export function languageOf(project: Project, locale: string): LanguageEntry | undefined {
  return project.localization?.languages.find((l) => l.locale === locale);
}

export function renderLocaleFor(loc: Localization | undefined, locale: string): RenderLocale {
  const entry = loc?.languages.find((l) => l.locale === locale);
  return { locale, dir: localeDef(locale).dir, fontScale: entry?.fontScale ?? 1 };
}

/**
 * A render-time copy of `project` with `locale`'s text swapped in (a
 * string with no override, or an empty one, falls back to the source
 * text) and `renderLocale` set. Projects without localization come back
 * unchanged, so they render exactly as before.
 */
export function localizeProject(project: Project, locale: string | null | undefined): Project {
  const loc = project.localization;
  if (!loc) return project;
  const target = locale && loc.languages.some((l) => l.locale === locale) ? locale : loc.source;
  const renderLocale = renderLocaleFor(loc, target);
  if (target === loc.source) return { ...project, renderLocale };

  const strings = languageOf(project, target)?.strings ?? {};
  const tr = (key: string, source: string) => {
    const t = strings[key]?.text;
    return t ? t : source;
  };
  return {
    ...project,
    renderLocale,
    appName: tr('appName', project.appName),
    intro: { ...project.intro, tagline: tr('intro.tagline', project.intro.tagline) },
    outro: { ...project.outro, cta: tr('outro.cta', project.outro.cta), button: tr('outro.button', project.outro.button), small: tr('outro.small', project.outro.small) },
    scenes: project.scenes.map((s): Slide => {
      const k = (f: string) => `s${s.id}.${f}`;
      if (s.kind === 'story') {
        return {
          ...s,
          actions: s.actions.map((a) =>
            a.type === 'notification'
              ? { ...a, title: tr(k(`${a.id}.title`), a.title), body: tr(k(`${a.id}.body`), a.body) }
              : a.type === 'typeText'
                ? { ...a, text: tr(k(`${a.id}.text`), a.text) }
                : a,
          ),
        };
      }
      return {
        ...s,
        headline: tr(k('headline'), s.headline),
        sub: tr(k('sub'), s.sub),
        badge: tr(k('badge'), s.badge),
        callout: tr(k('callout'), s.callout),
        stickers: tr(k('stickers'), s.stickers),
      } as Slide;
    }),
  };
}

/** Every string of every language (for font loading/measuring), keyed by locale. */
export function allLocaleText(project: Project, locale: string): string {
  return collectStrings(localizeProject(project, locale))
    .map((s) => s.source)
    .join(' ');
}

/* ---------- highlight markers ---------- */

export type HighlightCheck = { ok: true } | { ok: false; fixed: string; reason: string };

/**
 * Whether a string's *highlight* markers will render the way they read.
 * In scripts written with spaces, the renderer (text.ts layoutWords — the
 * prototype's rule) only honours a marker at the very start or end of a
 * whitespace-separated word: one inside a word (Arabic و*جاهزة) is
 * silently dropped, and a closing marker followed by punctuation
 * (*today*!) leaves the highlight running into the next words. Words in
 * unspaced scripts (Chinese/Japanese) honour a marker anywhere.
 *
 * Compares what the markers say (each one toggles the highlight; a word
 * with any highlighted letter counts as highlighted) with what the
 * renderer would draw, and when they differ returns the text with the
 * markers moved outward to the nearest word boundaries.
 */
export function checkHighlights(text: string): HighlightCheck {
  if (!text.includes('*')) return { ok: true };
  const parts = text.split(/(\s+)/);
  const words = parts.map((p, i) => ({ p, i })).filter(({ p }) => p && !/^\s+$/.test(p));
  // Mixed with an unspaced run that carries its own markers, there's no
  // single boundary rule to apply — the CJK run honours markers anywhere.
  if (words.some(({ p }) => UNSPACED.test(p) && p.includes('*'))) return { ok: true };

  let rendered = false, // renderer's carried-over state (text.ts)
    intended = false; // what the markers mean (toggle per marker)
  const want: boolean[] = [];
  let mismatch = false;
  for (const { p } of words) {
    // Renderer: highlighted from a leading star; a trailing star ends it after this word.
    let hi = rendered;
    if (p.startsWith('*')) hi = rendered = true;
    if (p.length > 1 && p.endsWith('*')) rendered = false;
    // Intended: any of this word's letters inside a highlight.
    let w = false;
    for (const ch of p) {
      if (ch === '*') intended = !intended;
      else if (intended) w = true;
    }
    want.push(w);
    if (w !== hi) mismatch = true;
  }
  // A final unclosed highlight is how the renderer already reads it — only
  // a disagreement about which words are highlighted is a problem.
  if (!mismatch) return { ok: true };

  const out = [...parts];
  words.forEach(({ p, i }, k) => {
    let bare = p.replace(/\*/g, '');
    if (want[k] && !want[k - 1]) bare = '*' + bare;
    if (want[k] && !want[k + 1]) bare = bare + '*';
    out[i] = bare;
  });
  return { ok: false, fixed: out.join(''), reason: 'A highlight marker sits inside a word, so the highlight won’t show where intended.' };
}
