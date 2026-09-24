/**
 * The one generic function that plays every layer's keyframe data — no
 * per-template code path. This is what makes a template's motion fully
 * editable (task 2): a template's build() only produces LayerDef[] data
 * once; every frame after that is this function reading it.
 *
 * Style multipliers (R/F/stag/burst — see styles.ts) are applied here, at
 * read time, never baked into the stored keyframe values — so switching
 * Style is non-destructive by construction (docs/MOTION_GUIDE.md task 5):
 * there is nothing to "rebuild," only a different multiplier used on the
 * next evaluation.
 */
import { cubicBezier } from './bezier';
import { float, SP, spr } from './spring';
import type { Axis, KeyframeStep, LayerDef, PropertyTrack, Transform3DTrack } from './types';
import type { MotionStyle } from './styles';

/** A step's 0→1 progress at elapsed time `dt` since it started — spring by
 * default, or the fixed-duration bezier curve when `easing` is set
 * (Prompt 5's curve editor). */
function stepProgress(dt: number, step: KeyframeStep): number {
  if (step.easing) return cubicBezier(Math.max(0, Math.min(1, dt / (step.dur ?? 0.5))), step.easing);
  return spr(dt, SP[step.spring]);
}

const AXIS_DEFAULT: Record<Axis, number> = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1, opacity: 1 };

function multiplierFor(step: { scaleBy?: string }, style: MotionStyle): number {
  switch (step.scaleBy) {
    case 'R':
      return style.R;
    case 'F':
      return style.F;
    case 'stag':
      return style.stag;
    case 'burst':
      return style.burst;
    default:
      return 1;
  }
}

/** Evaluates one property track at time `t` — the direct equivalent of the
 * reference's `tr(t, v0, steps)`, generalized to read step definitions
 * (spring preset id + style multiplier) from data instead of literal calls. */
export function evaluateProperty(t: number, track: PropertyTrack, style: MotionStyle): number {
  let v = track.base;
  let prev = track.base;
  for (const step of track.steps) {
    // Stagger (docs/MOTION_GUIDE.md: 40-70ms between siblings) shifts *when*
    // a step starts, not what it moves toward — so 'stag' scales `at`, every
    // other multiplier scales `to`.
    const at = step.scaleBy === 'stag' ? step.at * style.stag : step.at;
    const to = step.scaleBy === 'stag' ? step.to : step.to * multiplierFor(step, style);
    v += (to - prev) * stepProgress(t - at, step);
    prev = to;
  }
  if (track.float) v += float(t, track.float.amp * style.F, track.float.period, track.float.phase);
  if (track.spin) v += track.spin * t;
  return v;
}

export interface ResolvedTransform {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  scale: number;
  opacity: number;
}

export function evaluateTransform(t: number, track: Transform3DTrack, style: MotionStyle): ResolvedTransform {
  const out = { ...AXIS_DEFAULT } as ResolvedTransform;
  (Object.keys(AXIS_DEFAULT) as Axis[]).forEach((axis) => {
    const prop = track[axis];
    out[axis] = prop ? evaluateProperty(t, prop, style) : AXIS_DEFAULT[axis];
  });
  return out;
}

export function evaluateLayer(t: number, layer: LayerDef, style: MotionStyle): ResolvedTransform {
  return evaluateTransform(t, layer.transform, style);
}
