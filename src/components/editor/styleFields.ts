/**
 * UI metadata for the per-slide/intro/outro "Style for this slide" override
 * editor. Mirrors legacy/promo-studio.html's STYLE_FIELDS/KEYS_IMAGE/
 * KEYS_TEXT/KEYS_IO tables. Lives in components/ (not src/engine/) because
 * it's presentation metadata (labels, which fields apply to which slide
 * kind) rather than rendering data.
 */
import { BG_PATTERNS, FCOLORS, HL_STYLES, MODELS, PRESETS, TEXT_ANIMS, TRANSITIONS } from '@/engine/constants';
import type { Project, SlideStyle } from '@/engine/types';

export type StyleFieldKey = keyof SlideStyle;

export interface StyleFieldDef {
  label: string;
  options: () => Array<[string, string]>;
}

export const STYLE_FIELDS: Record<StyleFieldKey, StyleFieldDef> = {
  theme: { label: 'Color theme', options: () => PRESETS.map((p, i) => [String(i), p.name]) },
  textAnim: { label: 'Text animation', options: () => TEXT_ANIMS },
  hlStyle: { label: 'Highlight', options: () => HL_STYLES },
  transition: { label: 'Transition in', options: () => TRANSITIONS },
  bgPattern: { label: 'Background', options: () => BG_PATTERNS },
  shapes: {
    label: 'Floating shapes',
    options: () => [
      ['on', 'On'],
      ['off', 'Off'],
    ],
  },
  textPos: {
    label: 'Text position',
    options: () => [
      ['top', 'Top'],
      ['bottom', 'Bottom'],
    ],
  },
  model: { label: 'Device', options: () => Object.entries(MODELS).map(([k, m]) => [k, m.label]) },
  fcolor: { label: 'Device color', options: () => FCOLORS.map((f) => [f.id, f.label]) },
};

export const KEYS_IMAGE: StyleFieldKey[] = ['theme', 'textAnim', 'hlStyle', 'transition', 'bgPattern', 'shapes', 'textPos', 'model', 'fcolor'];
export const KEYS_TEXT: StyleFieldKey[] = ['theme', 'textAnim', 'hlStyle', 'transition', 'bgPattern', 'shapes'];
export const KEYS_IO: StyleFieldKey[] = ['theme', 'textAnim', 'hlStyle', 'transition', 'bgPattern', 'shapes'];
/** Story slides have no headline text, so textAnim/hlStyle/textPos don't
 * apply — but they still show a device frame and sit on the background. */
export const KEYS_STORY: StyleFieldKey[] = ['theme', 'transition', 'bgPattern', 'shapes', 'model', 'fcolor'];

/** What a style field currently resolves to, for the "Default (...)" option label. */
export function defaultLabel(project: Project, key: StyleFieldKey): string {
  const list = STYLE_FIELDS[key].options();
  const v = key === 'theme' ? String(project.preset) : key === 'shapes' ? (project.shapes ? 'on' : 'off') : String(project[key as keyof Project]);
  const f = list.find((o) => o[0] === v);
  return f ? f[1] : 'Custom';
}

export function overrideCount(style: SlideStyle): number {
  return Object.values(style).filter((v) => v !== '' && v != null).length;
}
