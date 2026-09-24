/**
 * Motion styles — bundles of spring presets plus intensity multipliers
 * applied uniformly across every template. Ported from
 * legacy/motion-lab-download.html's STYLES. `R`/`F`/`stag`/`burst` scale a
 * layer's keyframe deltas at evaluation time (see evaluate.ts) so switching
 * style never touches a template's keyframe data, only how strongly it
 * plays — this is what keeps the editor's "Style" level (docs/MOTION_GUIDE.md
 * / task 5) non-destructive to Manual-level edits.
 */
import { SP, type SpringParams } from './spring';

export interface MotionStyle {
  label: string;
  /** Spring used for enter moves (pw, headline words, ...). */
  enter: SpringParams;
  /** Spring used for pop/lift moves. */
  pop: SpringParams;
  /** Rotation multiplier. */
  R: number;
  /** Float amplitude multiplier. */
  F: number;
  /** Stagger multiplier. */
  stag: number;
  /** Particle burst multiplier. */
  burst: number;
  /** Overall playback speed multiplier. */
  speed: number;

  // ---- Prompt 6: the parameters a scene recipe/remix reads to give each
  // style a distinct *personality*, not just different spring numbers. ----

  /** 0-1 — how much decorative confetti/sticker/emoji a recipe should add.
   * Playful wants lots; Calm/Sleek want none or almost none. */
  decorationDensity: number;
  /** Headline/number type-scale multiplier — Bold reads noticeably larger. */
  typeScale: number;
  /** Camera push/pan/zoom speed multiplier a recipe's camera track scales
   * its keyframe timings by (smaller = slower-feeling moves). */
  cameraSpeed: number;
  /** 0-1 — background blur/glass-morphism a recipe applies behind cards or
   * sheets (Sleek's "glass blur"). 0 = opaque flat surface. */
  glassBlur: number;
  /** 0-1 — saturation/contrast boost applied to the resolved palette before
   * a recipe uses it (Bold's "high contrast"). */
  contrastBoost: number;
  /** True favors hard, instant cuts between beats (Bold); false favors
   * soft cross-fades/overlap (every other style here). */
  hardCuts: boolean;
  /** Background gradient/blob drift speed multiplier — Calm drifts slowly,
   * Bold/Playful move more. */
  bgDriftSpeed: number;
  /** Rotation is a real, visible part of this style's language (Playful's
   * "rotations") vs. an incidental side effect — recipes use this to
   * decide whether to lean into tilt/spin choices at all. */
  leansIntoRotation: boolean;
}

export const STYLES: Record<string, MotionStyle> = {
  playful: {
    label: 'Playful',
    enter: SP.bouncy,
    pop: SP.wobbly,
    R: 1.35,
    F: 1.5,
    stag: 1.1,
    burst: 1.5,
    speed: 1,
    decorationDensity: 0.9,
    typeScale: 1,
    cameraSpeed: 1,
    glassBlur: 0,
    contrastBoost: 0.1,
    hardCuts: false,
    bgDriftSpeed: 1.1,
    leansIntoRotation: true,
  },
  sleek: {
    label: 'Sleek',
    enter: SP.snappy,
    pop: SP.crisp,
    R: 0.75,
    F: 0.7,
    stag: 0.8,
    burst: 0.6,
    speed: 1.05,
    decorationDensity: 0.05,
    typeScale: 0.92,
    cameraSpeed: 1.1,
    glassBlur: 0.65,
    contrastBoost: 0,
    hardCuts: false,
    bgDriftSpeed: 0.6,
    leansIntoRotation: false,
  },
  bold: {
    label: 'Bold',
    enter: SP.punch,
    pop: SP.punch,
    R: 1.1,
    F: 0.9,
    stag: 0.7,
    burst: 1.2,
    speed: 1.15,
    decorationDensity: 0.3,
    typeScale: 1.35,
    cameraSpeed: 1.4,
    glassBlur: 0,
    contrastBoost: 0.35,
    hardCuts: true,
    bgDriftSpeed: 1.3,
    leansIntoRotation: false,
  },
  calm: {
    label: 'Calm',
    enter: SP.gentle,
    pop: SP.soft,
    R: 0.55,
    F: 1.0,
    stag: 1.3,
    burst: 0.45,
    speed: 0.85,
    decorationDensity: 0.1,
    typeScale: 0.88,
    cameraSpeed: 0.7,
    glassBlur: 0.25,
    contrastBoost: -0.1,
    hardCuts: false,
    bgDriftSpeed: 0.4,
    leansIntoRotation: false,
  },
};

export type StyleId = keyof typeof STYLES;
