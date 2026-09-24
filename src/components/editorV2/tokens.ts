/**
 * Shared design tokens for the Engine v2 editor (layout rebuild) — the
 * same radius scale, spacing rhythm, type scale and accent color *family*
 * classic's editor uses (src/components/editor/panels/*.tsx's Tailwind
 * classes: rounded-xl/2xl, indigo-500/600, text-[11px..15px], the
 * black/10 \\ white/10 border convention), so the two editors read as one
 * product despite v2 staying dark-surfaced — the deliberate choice here
 * (matching every mainstream video/creative tool: Premiere, Resolve,
 * Figma's canvas) is *consistent tokens*, not an identical light theme;
 * classic's own light surface suits its simpler 2D canvas and marketing-
 * adjacent context, v2's dark one suits judging color-accurate screenshot
 * content against a WebGL preview. Flag this call if it's wrong.
 *
 * v2 still uses inline styles rather than Tailwind classNames (unlike
 * classic) — converting the whole editor to Tailwind is a much larger,
 * separate change from "make the tokens match" and wasn't requested.
 */

export const radius = {
  /** Tailwind's rounded-lg — small inputs, color swatches. */
  sm: 8,
  /** Tailwind's rounded-xl — buttons, cards, the default for most controls. */
  md: 12,
  /** Tailwind's rounded-2xl — preset/template cards. */
  lg: 16,
  /** Tailwind's rounded-3xl — top-level panel/section containers. */
  xl: 24,
  full: 9999,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const font = {
  /** Tailwind's text-[10.5px] — badges, fine print. */
  xs: 10.5,
  sm: 11,
  /** Tailwind's text-[12.5px] — the workhorse body size across classic's panels. */
  base: 12.5,
  md: 13,
  lg: 14,
  xl: 15,
  xxl: 18,
} as const;

export const color = {
  bg: '#0B0B10',
  surface: '#15151B',
  surfaceRaised: '#1A1A22',
  border: 'rgba(255,255,255,0.1)',
  borderStrong: 'rgba(255,255,255,0.18)',
  /** Tailwind's indigo-500 — replaces v2's earlier ad hoc #6D5BFF so both
   * editors share the same accent hue family. */
  accent: '#6366F1',
  /** Tailwind's indigo-600 — hover/active state. */
  accentStrong: '#4F46E5',
  /** Tailwind's indigo-500 at 30% — the accent-tinted ring classic uses
   * for a selected/active card (dark:aria-pressed:ring-indigo-500/30). */
  accentRing: 'rgba(99,102,241,0.3)',
  text: '#FFFFFF',
  /** ~Tailwind's neutral-400 on a dark surface. */
  textSecondary: 'rgba(255,255,255,0.6)',
  textMuted: 'rgba(255,255,255,0.4)',
  danger: '#ff8a8a',
} as const;

export const shadow = {
  panel: '0 8px 30px rgba(0,0,0,0.35)',
};

/** A plain button — the v2 equivalent of classic's `rounded-xl border
 * border-black/10 bg-white ... dark:border-white/10 dark:bg-neutral-800`. */
export function buttonStyle(active = false, disabled = false) {
  return {
    fontSize: font.sm,
    padding: `${space.sm - 2}px ${space.md - 2}px`,
    borderRadius: radius.md,
    border: `1px solid ${active ? color.accent : color.border}`,
    background: active ? color.accent : color.surfaceRaised,
    color: color.text,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.4 : 1,
  } as const;
}

export const sectionHeadingStyle = {
  fontSize: font.md,
  fontWeight: 800,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  opacity: 0.6,
  margin: '0 0 6px',
};

export const inputStyle = {
  width: '100%',
  background: color.surfaceRaised,
  color: color.text,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  padding: '6px 8px',
  fontSize: font.base,
} as const;
