/**
 * The UI kit's color/type theme — derived from a project Palette
 * (src/engine2/palettes.ts) the same way every existing template already
 * uses palette fields (`ui` for buttons/bubbles, a light neutral surface,
 * dark ink text, `accent` for highlights — see templates/reactions.ts etc.),
 * not reinvented here. `palette.ink`/`palette.mark` are "text readable
 * directly on the dark promo background" and stay out of this — UI kit
 * elements represent *app* chrome, which is deliberately light/neutral
 * regardless of how dark the surrounding promo palette is.
 */
import type { Palette } from '../palettes';

export interface UIKitTheme {
  /** Buttons, active states, outgoing bubbles, links. */
  primary: string;
  /** Badges, ticks, highlight accents, progress fills. */
  accent: string;
  /** Card/bubble/sheet backgrounds. */
  surface: string;
  /** Track backgrounds, incoming bubbles, disabled fills. */
  surfaceAlt: string;
  /** Primary text on `surface`. */
  text: string;
  /** Secondary/caption text on `surface`. */
  textMuted: string;
  /** Text/icon color on top of `primary`. */
  onPrimary: string;
  success: string;
  danger: string;
  /** Base corner radius in px at the element's natural (unscaled) size. */
  radius: number;
  font: string;
  fontDisplay: string;
}

export function deriveTheme(palette: Palette): UIKitTheme {
  return {
    primary: palette.ui,
    accent: palette.accent,
    surface: '#FFFFFF',
    surfaceAlt: '#F1F1F5',
    text: '#15161B',
    textMuted: '#6B6F7D',
    onPrimary: '#FFFFFF',
    success: '#16B364',
    danger: '#E5484D',
    radius: 20,
    font: 'Figtree, system-ui, sans-serif',
    fontDisplay: '"Bricolage Grotesque", Figtree, sans-serif',
  };
}

export function fontStr(weight: number, size: number, family: string): string {
  return `${weight} ${size}px ${family}`;
}
