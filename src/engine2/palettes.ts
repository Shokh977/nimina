/**
 * Palettes — ported from legacy/motion-lab-download.html's PALS. Per
 * docs/MOTION_GUIDE.md, a palette is background base + 4 gradient blob
 * colors + ink (text-on-dark) + accent (highlight) + mark (text-on-accent)
 * + ui (buttons/bubbles/accents inside the screen content) + a shadow tint
 * (RGB triplet string, never pure black).
 */
export interface Palette {
  label: string;
  base: string;
  b: [string, string, string, string];
  ink: string;
  accent: string;
  mark: string;
  ui: string;
  /** "r,g,b" — shadow tint, always derived from the palette, never pure black. */
  shadow: string;
}

export const PALS: Record<string, Palette> = {
  aurora: { label: 'Aurora', base: '#1A1446', b: ['#6D5BFF', '#FF6FD8', '#3EC5FF', '#8B5CF6'], ink: '#FFFFFF', accent: '#FFE066', mark: '#1A1446', ui: '#6D5BFF', shadow: '24,14,70' },
  sunset: { label: 'Sunset', base: '#3A0C1E', b: ['#FF7A59', '#FFB347', '#FF3E7F', '#7A2BFF'], ink: '#FFFFFF', accent: '#FFF1B8', mark: '#3A0C1E', ui: '#FF4F2E', shadow: '70,14,30' },
  mint: { label: 'Mint', base: '#0B3A33', b: ['#2DD4BF', '#A7F3D0', '#22C55E', '#0EA5E9'], ink: '#F2FFFA', accent: '#FDE047', mark: '#0B3A33', ui: '#0FA37A', shadow: '6,50,42' },
  midnight: { label: 'Midnight', base: '#06070C', b: ['#1E3A8A', '#7C3AED', '#0EA5E9', '#0F172A'], ink: '#F5F7FF', accent: '#7CF0FF', mark: '#06070C', ui: '#3B82F6', shadow: '0,0,10' },
  candy: { label: 'Candy', base: '#FFE3EC', b: ['#FF9EC4', '#FFD6A5', '#B5E8FF', '#D9B8FF'], ink: '#2A1030', accent: '#FF3E7F', mark: '#FFFFFF', ui: '#FF3E7F', shadow: '120,40,80' },
  // Placeholder slot for "extract a palette from my screenshot" (Tier 1
  // item 5) — a real Palette object so 'custom' is a valid PaletteId from
  // compile time on; its fields are overwritten in place by
  // applyExtractedTheme() once the user actually extracts one. Starts as a
  // copy of aurora so nothing looks broken if 'custom' is ever selected
  // before an extraction has happened.
  custom: { label: 'Custom', base: '#1A1446', b: ['#6D5BFF', '#FF6FD8', '#3EC5FF', '#8B5CF6'], ink: '#FFFFFF', accent: '#FFE066', mark: '#1A1446', ui: '#6D5BFF', shadow: '24,14,70' },
};

export type PaletteId = keyof typeof PALS;

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return [0, 0, 0];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Maps a screenshot-extracted 4-color theme (paletteExtractor.ts's
 * ExtractedTheme: primary/accent/surface/text) onto this engine's fuller
 * Palette shape (base + 4 gradient blobs + ink/accent/mark/ui/shadow),
 * mutating PALS.custom in place — Tier 1 item 5: "auto-extracting a
 * palette from an uploaded screenshot." Not a full color-theory engine:
 * gradient blobs alternate primary/accent, `mark` (text-on-accent) picks
 * white or the surface color by contrast against the accent, matching the
 * simplest of the 5 hand-authored palettes' own convention rather than
 * inventing a fifth color. */
export function applyExtractedTheme(theme: { primary: string; accent: string; surface: string; text: string }): void {
  const custom = PALS.custom;
  custom.base = theme.surface;
  custom.ink = theme.text;
  custom.accent = theme.accent;
  custom.ui = theme.primary;
  custom.b = [theme.primary, theme.accent, theme.surface, theme.primary];
  custom.mark = relativeLuminance(hexToRgb(theme.accent)) > 0.6 ? theme.surface : '#FFFFFF';
  const [r, g, b] = hexToRgb(theme.surface);
  custom.shadow = `${r},${g},${b}`;
}
