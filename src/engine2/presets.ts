/**
 * Motion presets (Prompt 5) — Enter/Emphasis/Exit, one-click-applied to a
 * layer's keyframe tracks. Each preset is a pure function of the layer's
 * *current* resting values (so e.g. "slide" computes its offset relative
 * to wherever the layer already sits) producing per-axis patches; nothing
 * here mutates a layer directly — editorV2Store.ts's applyPreset action
 * does that, and decides merge policy (Enter replaces a track's existing
 * steps, Emphasis/Exit append after them — see its doc comment).
 *
 * Exit presets use a fixed-duration bezier (BEZIER_PRESETS.easeIn) rather
 * than a spring: docs/MOTION_GUIDE.md requires exits to be fast (200-300ms)
 * and never overshoot, which is exactly what an ease-in cubic gives and no
 * named spring here reliably does.
 */
import { BEZIER_PRESETS } from './bezier';
import type { Axis, KeyframeStep, LayerDef } from './types';

/** 'idle' (new — device motion presets) is a fourth category alongside the
 * original three: it loops for as long as the layer rests, layered on top
 * of whatever enter/emphasis/exit steps are also present (see PropertyTrack's
 * `float`/`spin` and evaluate.ts's evaluateProperty, which already adds
 * base+steps+float+spin unconditionally — idle presets only ever touch
 * `float`/`spin`, never `steps`, which is what makes "enter + idle +
 * emphasis + exit at once without them fighting" true for free at the
 * evaluation layer; editorV2Store.ts's applyPreset is what keeps the merge
 * at the *write* side equally non-destructive. */
export type PresetCategory = 'enter' | 'idle' | 'emphasis' | 'exit';

/** Which layer contexts a preset is curated for — a UI filtering hint only
 * (PresetsPanel.tsx), never enforced by the engine: applying a
 * device-tagged preset to a sticker still works, it's just not what the
 * picker surfaces by default. 'device' = a layer on the 'device' plane
 * (screenLayer()/addScreenshotLayer() output); 'cutout' = a popout layer
 * with `liftOf` set. Every preset predating this field is 'generic'. */
export type PresetTag = 'generic' | 'device' | 'cutout';

export interface PresetAxisPatch {
  /** Present only when the preset needs to move the track's resting value
   * (e.g. "rise" starts below rest) — replaces the axis's current base. */
  base?: number;
  /** Idle presets never set this (omit or pass []) — see PresetCategory's
   * doc comment above. */
  steps: KeyframeStep[];
  /** Idle-only: a bounded oscillation layered on top of base+steps (see
   * PropertyTrack.float). Setting this on a non-idle preset works
   * mechanically the same way but isn't what any preset here does. */
  float?: { amp: number; period: number; phase: number };
  /** Idle-only: unbounded continuous motion (see PropertyTrack.spin) —
   * degrees/second added on top of everything else, unconditionally.
   * None of the presets below use this (a bounded `float` reads better for
   * every idle case the spec asks for, including "turntable" — see its
   * doc comment), but it's wired through for a future one that wants true
   * unbounded rotation. */
  spin?: number;
}

export type PresetPatch = Partial<Record<Axis, PresetAxisPatch>>;

/** Position within a same-preset application group — Tier 1 part C's
 * "Stagger automatically when applied to several layers at once" plus
 * "Stack"/"Fan out"/"Carousel", which need to fan each selected layer to a
 * *different* destination (not just a different start time) based on where
 * it falls in the selection. `index`/`total` are the same selection-order
 * values editorV2Store.ts already computes for staggering `at` — passed
 * through so a preset can use them for spatial layout too, not just
 * timing. Every preset that doesn't care simply ignores this param (TS
 * allows an `apply` with fewer declared params). */
export interface PresetGroupContext {
  index: number;
  total: number;
}

export interface MotionPreset {
  id: string;
  label: string;
  category: PresetCategory;
  description: string;
  tags: PresetTag[];
  apply(layer: LayerDef, at: number, group?: PresetGroupContext): PresetPatch;
}

function base(layer: LayerDef, axis: Axis, fallback: number): number {
  return layer.transform[axis]?.base ?? fallback;
}

/** Deterministic 0-2π phase from a layer's id — MOTION_GUIDE.md's idle
 * float spec calls for "randomized phase per element" so siblings with the
 * same idle preset don't drift in lockstep; deterministic (not
 * Math.random()) so the same project always evaluates the same way. */
function hashPhase(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % 1000) / 1000 * Math.PI * 2;
}

const EXIT_EASE = { easing: BEZIER_PRESETS.easeIn, dur: 0.25 } as const;

const PRESETS: MotionPreset[] = [
  // ---------- Enter ----------
  {
    id: 'pop',
    label: 'Pop',
    category: 'enter',
    tags: ['generic'],
    description: 'Scales up from nothing with a bouncy overshoot, fading in.',
    apply(layer, at) {
      const restScale = base(layer, 'scale', 1);
      const restOpacity = base(layer, 'opacity', 1);
      return {
        scale: { base: 0.001, steps: [{ at, to: restScale, spring: 'bouncy' }] },
        opacity: { base: 0, steps: [{ at, to: restOpacity, spring: 'snappy' }] },
      };
    },
  },
  {
    id: 'rise',
    label: 'Rise',
    category: 'enter',
    tags: ['generic', 'device'],
    description: 'Enters from below, springing up into place with overshoot ("Rise up" in the device preset list).',
    apply(layer, at) {
      const restY = base(layer, 'y', 0);
      const restOpacity = base(layer, 'opacity', 1);
      return {
        y: { base: restY + 80, steps: [{ at, to: restY, spring: 'bouncy' }] },
        opacity: { base: 0, steps: [{ at, to: restOpacity, spring: 'snappy' }] },
      };
    },
  },
  {
    id: 'slide',
    label: 'Slide',
    category: 'enter',
    tags: ['generic'],
    description: 'Slides in from the right.',
    apply(layer, at) {
      const restX = base(layer, 'x', 0);
      const restOpacity = base(layer, 'opacity', 1);
      return {
        x: { base: restX + 130, steps: [{ at, to: restX, spring: 'snappy' }] },
        opacity: { base: 0, steps: [{ at, to: restOpacity, spring: 'snappy' }] },
      };
    },
  },
  {
    id: 'unfold',
    label: 'Unfold',
    category: 'enter',
    tags: ['generic'],
    description: 'Opens up in true 3D, hinged from its top edge, like a flap.',
    apply(layer, at) {
      const restRx = base(layer, 'rx', 0);
      const restOpacity = base(layer, 'opacity', 1);
      return {
        rx: { base: restRx - 90, steps: [{ at, to: restRx, spring: 'wobbly' }] },
        opacity: { base: 0, steps: [{ at, to: restOpacity, spring: 'snappy' }] },
      };
    },
  },
  {
    id: 'scaleFromPoint',
    label: 'Scale from point',
    category: 'enter',
    tags: ['generic'],
    description: 'Grows from a single point, no fade — already visible, just tiny.',
    apply(layer, at) {
      const restScale = base(layer, 'scale', 1);
      return { scale: { base: 0.001, steps: [{ at, to: restScale, spring: 'punch' }] } };
    },
  },
  {
    id: 'maskReveal',
    label: 'Mask reveal',
    category: 'enter',
    tags: ['generic'],
    description: 'Approximation — a real clip-mask wipe isn’t wired into the renderer yet, so this is a fast fade + slight scale settle instead.',
    apply(layer, at) {
      const restScale = base(layer, 'scale', 1);
      const restOpacity = base(layer, 'opacity', 1);
      return {
        opacity: { base: 0, steps: [{ at, to: restOpacity, spring: 'crisp' }] },
        scale: { base: restScale * 0.92, steps: [{ at, to: restScale, spring: 'crisp' }] },
      };
    },
  },
  {
    id: 'flipIn',
    label: 'Flip in',
    category: 'enter',
    tags: ['generic'],
    description: 'A quarter 3D flip around the vertical axis.',
    apply(layer, at) {
      const restRy = base(layer, 'ry', 0);
      const restOpacity = base(layer, 'opacity', 1);
      return {
        ry: { base: restRy + 90, steps: [{ at, to: restRy, spring: 'wobbly' }] },
        opacity: { base: 0, steps: [{ at, to: restOpacity, spring: 'crisp' }] },
      };
    },
  },

  // ---------- Enter — device motion (Tier 1 "device motion presets",
  // highest priority). Every one is a pure function of the device layer's
  // *current* rest pose (base()), same convention as the generic presets
  // above — "Rise up" reuses 'rise' verbatim (already matches: overshoot
  // via 'bouncy'), so it isn't duplicated here. ----------
  {
    id: 'devicePopIn',
    label: 'Pop in',
    category: 'enter',
    tags: ['device'],
    description: 'Scales up from 0.6x with a slight rotate, settling at rest.',
    apply(layer, at) {
      const restScale = base(layer, 'scale', 1);
      const restOpacity = base(layer, 'opacity', 1);
      const restRz = base(layer, 'rz', 0);
      const sign = restRz >= 0 ? 1 : -1;
      return {
        scale: { base: restScale * 0.6, steps: [{ at, to: restScale, spring: 'bouncy' }] },
        rz: { base: restRz + sign * 6, steps: [{ at, to: restRz, spring: 'bouncy' }] },
        opacity: { base: 0, steps: [{ at, to: restOpacity, spring: 'snappy' }] },
      };
    },
  },
  {
    id: 'deviceSlideIn',
    label: 'Slide across',
    category: 'enter',
    tags: ['device'],
    description: 'Slides in from off to the side (away from wherever it already sits) with a rotateZ lean that settles out.',
    apply(layer, at) {
      const restX = base(layer, 'x', 0);
      const restRz = base(layer, 'rz', 0);
      const restOpacity = base(layer, 'opacity', 1);
      // Enters from further out on whichever side it already leans toward
      // — reads as "sliding into its own spot" rather than always from a
      // fixed edge regardless of layout (the spec's "from left/right").
      const sign = restX >= 0 ? 1 : -1;
      return {
        x: { base: restX + sign * 220, steps: [{ at, to: restX, spring: 'snappy' }] },
        rz: { base: restRz + sign * 10, steps: [{ at, to: restRz, spring: 'snappy' }] },
        opacity: { base: 0, steps: [{ at, to: restOpacity, spring: 'snappy' }] },
      };
    },
  },
  {
    id: 'deviceSwingIn',
    label: 'Swing in',
    category: 'enter',
    tags: ['device'],
    description: 'Swings in around the vertical axis — enters at rest-46° (rotateY -60° for the default -14° rest pose) and settles at rest, matching legacy/motion-lab-download.html\'s device entrance (line ~384: ry step to -14 via S.enter).',
    apply(layer, at) {
      const restRy = base(layer, 'ry', 0);
      const restOpacity = base(layer, 'opacity', 1);
      return {
        ry: { base: restRy - 46, steps: [{ at, to: restRy, spring: 'wobbly' }] },
        opacity: { base: 0, steps: [{ at, to: restOpacity, spring: 'snappy' }] },
      };
    },
  },
  {
    id: 'deviceFlipIn',
    label: 'Flip in',
    category: 'enter',
    tags: ['device'],
    description: 'A full half-turn (rotateY 180° to 0) that reveals the screen turning to face the viewer — no fade, since the turn itself is the reveal.',
    apply(layer, at) {
      const restRy = base(layer, 'ry', 0);
      return { ry: { base: restRy + 180, steps: [{ at, to: restRy, spring: 'wobbly' }] } };
    },
  },
  {
    id: 'deviceDropIn',
    label: 'Drop in',
    category: 'enter',
    tags: ['device'],
    description: 'Falls from above and bounces to a settle.',
    apply(layer, at) {
      const restY = base(layer, 'y', 0);
      const restOpacity = base(layer, 'opacity', 1);
      return {
        y: { base: restY - 140, steps: [{ at, to: restY, spring: 'bouncy' }] },
        opacity: { base: 0, steps: [{ at, to: restOpacity, spring: 'snappy' }] },
      };
    },
  },
  {
    id: 'deviceUnfold',
    label: 'Unfold',
    category: 'enter',
    tags: ['device'],
    description: 'Tips up from flat, like being stood upright off a table — rotateX -75° to -8°, a fixed target pose rather than a delta from rest (an unfold has its own landing angle, not whatever the layer happened to rest at before).',
    apply(layer, at) {
      return { rx: { base: -75, steps: [{ at, to: -8, spring: 'wobbly' }] } };
    },
  },

  // ---------- Idle — loops while resting, layered on top of whatever
  // enter/emphasis/exit is also applied (see PresetCategory's doc comment
  // above). Every one only sets `float`/`spin`, never `steps`, so applying
  // one never disturbs an already-applied enter/exit on the same axis. ----------
  {
    id: 'idleFloat',
    label: 'Float',
    category: 'idle',
    tags: ['device', 'cutout'],
    description: 'A slow, gentle vertical bob (2px over 4s) — MOTION_GUIDE.md\'s baseline "nothing is fully static" idle.',
    apply(layer) {
      return { y: { steps: [], float: { amp: 2, period: 4, phase: hashPhase(layer.id) } } };
    },
  },
  {
    id: 'idleTurntable',
    label: 'Turntable',
    category: 'idle',
    tags: ['device'],
    description: 'A slow rotateY sway, ±10° — reads as a continuous turntable without ever turning fully away from camera.',
    apply(layer) {
      return { ry: { steps: [], float: { amp: 10, period: 7, phase: hashPhase(layer.id) } } };
    },
  },
  {
    id: 'idleBreathe',
    label: 'Breathe',
    category: 'idle',
    tags: ['device'],
    description: 'A subtle scale pulse (approximation: symmetric ±1% around rest, reading as "1.00-1.02" — evaluateProperty\'s float() is a plain sine, so a strictly one-sided range isn\'t available without a second, asymmetric idle primitive this preset doesn\'t need).',
    apply(layer) {
      return { scale: { steps: [], float: { amp: 0.01, period: 3.5, phase: hashPhase(layer.id) } } };
    },
  },
  {
    id: 'idleHandheld',
    label: 'Handheld',
    category: 'idle',
    tags: ['device'],
    description: 'Subtle noise on x/y/rotateZ — approximated as three small sine floats at different periods/phases (no true noise primitive in PropertyTrack), which reads as organic jitter since the axes never sync up.',
    apply(layer) {
      const h = hashPhase(layer.id);
      return {
        x: { steps: [], float: { amp: 0.8, period: 2.3, phase: h } },
        y: { steps: [], float: { amp: 0.8, period: 2.7, phase: h + 1.1 } },
        rz: { steps: [], float: { amp: 0.4, period: 3.1, phase: h + 2.4 } },
      };
    },
  },

  // ---------- Emphasis (a single beat, not a loop) ----------
  {
    id: 'wiggle',
    label: 'Wiggle',
    category: 'emphasis',
    tags: ['generic'],
    description: 'A quick side-to-side rotation.',
    apply(layer, at) {
      const restRz = base(layer, 'rz', 0);
      return {
        rz: {
          steps: [
            { at, to: restRz + 5, spring: 'snappy' },
            { at: at + 0.12, to: restRz - 5, spring: 'snappy' },
            { at: at + 0.26, to: restRz, spring: 'gentle' },
          ],
        },
      };
    },
  },
  {
    id: 'pulse',
    label: 'Pulse',
    category: 'emphasis',
    tags: ['generic'],
    description: 'A quick scale-up and back.',
    apply(layer, at) {
      const restScale = base(layer, 'scale', 1);
      return {
        scale: {
          steps: [
            { at, to: restScale * 1.08, spring: 'snappy' },
            { at: at + 0.16, to: restScale, spring: 'gentle' },
          ],
        },
      };
    },
  },
  {
    id: 'glow',
    label: 'Glow',
    category: 'emphasis',
    tags: ['generic'],
    description: 'Approximation — no per-layer bloom control yet, so this reads as a bright quick scale/opacity flash instead of a true glow.',
    apply(layer, at) {
      const restScale = base(layer, 'scale', 1);
      const restOpacity = base(layer, 'opacity', 1);
      return {
        scale: { steps: [{ at, to: restScale * 1.05, spring: 'snappy' }, { at: at + 0.2, to: restScale, spring: 'gentle' }] },
        opacity: { steps: [{ at, to: Math.min(1, restOpacity + 0.001), spring: 'snappy' }] },
      };
    },
  },
  {
    id: 'shake',
    label: 'Shake',
    category: 'emphasis',
    tags: ['generic'],
    description: 'A fast left-right jitter.',
    apply(layer, at) {
      const restX = base(layer, 'x', 0);
      return {
        x: {
          steps: [
            { at, to: restX + 7, spring: 'punch' },
            { at: at + 0.08, to: restX - 7, spring: 'punch' },
            { at: at + 0.16, to: restX + 3, spring: 'punch' },
            { at: at + 0.24, to: restX, spring: 'snappy' },
          ],
        },
      };
    },
  },
  {
    id: 'bounce',
    label: 'Bounce',
    category: 'emphasis',
    tags: ['generic'],
    description: 'A single hop up and settle.',
    apply(layer, at) {
      const restY = base(layer, 'y', 0);
      return { y: { steps: [{ at, to: restY - 16, spring: 'snappy' }, { at: at + 0.14, to: restY, spring: 'bouncy' }] } };
    },
  },
  {
    id: 'liftOutEmphasis',
    label: 'Lift out',
    category: 'emphasis',
    tags: ['generic', 'cutout'],
    description: 'Pops toward the camera and settles slightly forward.',
    apply(layer, at) {
      const restZ = base(layer, 'z', 0);
      const restScale = base(layer, 'scale', 1);
      return {
        z: { steps: [{ at, to: restZ + 90, spring: 'wobbly' }] },
        scale: { steps: [{ at, to: restScale * 1.06, spring: 'wobbly' }] },
      };
    },
  },
  {
    id: 'deviceTurnToFace',
    label: 'Turn to face',
    category: 'emphasis',
    tags: ['device'],
    description: 'Rotates from an angled rest pose to straight-on — one-directional, stays facing forward afterward rather than springing back.',
    apply(layer, at) {
      const restRy = base(layer, 'ry', 0);
      return { ry: { base: restRy, steps: [{ at, to: 0, spring: 'gentle' }] } };
    },
  },
  {
    id: 'deviceTiltAway',
    label: 'Tilt away',
    category: 'emphasis',
    tags: ['device'],
    description: 'Leans back and dims — for when a cutout lifts out of this device and the device itself should recede. One-directional, stays leaned/dimmed.',
    apply(layer, at) {
      const restRx = base(layer, 'rx', 0);
      const restOpacity = base(layer, 'opacity', 1);
      return {
        rx: { base: restRx, steps: [{ at, to: restRx + 20, spring: 'gentle' }] },
        opacity: { base: restOpacity, steps: [{ at, to: restOpacity * 0.6, spring: 'gentle' }] },
      };
    },
  },
  {
    id: 'deviceWobble',
    label: 'Wobble',
    category: 'emphasis',
    tags: ['device'],
    description: 'A quick rotateY rock, settling back to rest.',
    apply(layer, at) {
      const restRy = base(layer, 'ry', 0);
      return {
        ry: {
          steps: [
            { at, to: restRy + 6, spring: 'wobbly' },
            { at: at + 0.16, to: restRy - 6, spring: 'wobbly' },
            { at: at + 0.34, to: restRy, spring: 'gentle' },
          ],
        },
      };
    },
  },
  {
    id: 'deviceSpin',
    label: 'Spin',
    category: 'emphasis',
    tags: ['device'],
    description: 'A full 360° rotateY, landing back at rest.',
    apply(layer, at) {
      const restRy = base(layer, 'ry', 0);
      return { ry: { steps: [{ at, to: restRy + 360, spring: 'gentle' }] } };
    },
  },
  {
    id: 'deviceFlipToSecond',
    label: 'Flip to second screenshot',
    category: 'emphasis',
    tags: ['device'],
    description: 'Rotates 180° rotateY, revealing whatever is set as this layer\'s back content (LayersPanel\'s "Back content" picker — a second screenshot for a device) as the front culls away mid-turn. One-directional, lands showing the back.',
    apply(layer, at) {
      const restRy = base(layer, 'ry', 0);
      return { ry: { base: restRy, steps: [{ at, to: restRy + 180, spring: 'wobbly' }] } };
    },
  },

  // ---------- Exit (fast, no overshoot — bezier ease-in, not a spring) ----------
  {
    id: 'shrink',
    label: 'Shrink',
    category: 'exit',
    tags: ['generic', 'device'],
    description: 'Scales down to nothing.',
    apply(layer, at) {
      return {
        scale: { steps: [{ at, to: 0.001, spring: 'crisp', ...EXIT_EASE }] },
        opacity: { steps: [{ at, to: 0, spring: 'crisp', ...EXIT_EASE }] },
      };
    },
  },
  {
    id: 'fall',
    label: 'Fall',
    category: 'exit',
    tags: ['generic'],
    description: 'Drops down and fades.',
    apply(layer, at) {
      const restY = base(layer, 'y', 0);
      return {
        y: { steps: [{ at, to: restY + 140, spring: 'crisp', easing: BEZIER_PRESETS.easeIn, dur: 0.3 }] },
        opacity: { steps: [{ at, to: 0, spring: 'crisp', ...EXIT_EASE }] },
      };
    },
  },
  {
    id: 'slideExit',
    label: 'Slide',
    category: 'exit',
    tags: ['generic', 'device'],
    description: 'Slides out to the left and fades ("Fly out sideways" in the device preset list).',
    apply(layer, at) {
      const restX = base(layer, 'x', 0);
      return {
        x: { steps: [{ at, to: restX - 160, spring: 'crisp', ...EXIT_EASE }] },
        opacity: { steps: [{ at, to: 0, spring: 'crisp', ...EXIT_EASE }] },
      };
    },
  },
  {
    id: 'fadeBlur',
    label: 'Fade + blur',
    category: 'exit',
    tags: ['generic'],
    description: 'Approximation — no per-layer blur yet, so this fades while scaling up slightly, which reads as defocusing.',
    apply(layer, at) {
      const restScale = base(layer, 'scale', 1);
      return {
        scale: { steps: [{ at, to: restScale * 1.18, spring: 'crisp', easing: BEZIER_PRESETS.easeIn, dur: 0.3 }] },
        opacity: { steps: [{ at, to: 0, spring: 'crisp', easing: BEZIER_PRESETS.easeIn, dur: 0.3 }] },
      };
    },
  },
  {
    id: 'deviceSink',
    label: 'Sink',
    category: 'exit',
    tags: ['device'],
    description: 'Drops down and recedes (pulls back in z) while fading — a heavier, more final exit than a plain fall.',
    apply(layer, at) {
      const restY = base(layer, 'y', 0);
      const restZ = base(layer, 'z', 0);
      return {
        y: { steps: [{ at, to: restY + 120, spring: 'crisp', ...EXIT_EASE }] },
        z: { steps: [{ at, to: restZ - 60, spring: 'crisp', ...EXIT_EASE }] },
        opacity: { steps: [{ at, to: 0, spring: 'crisp', ...EXIT_EASE }] },
      };
    },
  },
  {
    id: 'deviceFlipAway',
    label: 'Flip away',
    category: 'exit',
    tags: ['device'],
    description: 'A fast quarter-turn rotateY while fading — the reverse read of Flip in.',
    apply(layer, at) {
      const restRy = base(layer, 'ry', 0);
      return {
        ry: { steps: [{ at, to: restRy + 120, spring: 'crisp', ...EXIT_EASE }] },
        opacity: { steps: [{ at, to: 0, spring: 'crisp', ...EXIT_EASE }] },
      };
    },
  },

  // ---------- Cutout motion (Tier 1 part C). All 'enter' category (a
  // cutout's reveal *is* its defining animation, the same way
  // addCutoutFromLayer's hardcoded default already works) except
  // cutoutOrbitDevice, which loops. "Lift out"/"Pop return"/"Fly to side"/
  // "Zoom hero"/"Stack" port classic's 5 cutout presets (src/engine/
  // cutouts.ts) into this engine's keyframe system; the rest are new. ----------
  {
    id: 'cutoutLiftOut',
    label: 'Lift out',
    category: 'enter',
    tags: ['cutout'],
    description: 'Rises and scales up slightly with a small rotate, staying lifted — classic\'s liftOut. This is also what addCutoutFromLayer sets by default on a brand-new cutout; apply this to switch a cutout back to it after trying another preset.',
    apply(layer, at) {
      const restZ = base(layer, 'z', 0);
      const restY = base(layer, 'y', 0);
      const restScale = base(layer, 'scale', 1);
      const restOpacity = base(layer, 'opacity', 1);
      return {
        z: { base: restZ, steps: [{ at, to: restZ + 90, spring: 'wobbly' }] },
        y: { base: restY, steps: [{ at, to: restY - 24, spring: 'wobbly' }] },
        scale: { base: restScale * 0.6, steps: [{ at, to: restScale * 1.06, spring: 'bouncy' }] },
        opacity: { base: 0, steps: [{ at, to: restOpacity, spring: 'snappy' }] },
      };
    },
  },
  {
    id: 'cutoutPopReturn',
    label: 'Pop return',
    category: 'enter',
    tags: ['cutout'],
    description: 'Pops up and scales, then settles back flush with the screen instead of staying lifted — classic\'s popReturn, for a cutout that should read as a tap/acknowledgment rather than a permanent lift.',
    apply(layer, at) {
      const restZ = base(layer, 'z', 0);
      const restScale = base(layer, 'scale', 1);
      const restOpacity = base(layer, 'opacity', 1);
      return {
        z: { base: restZ, steps: [{ at, to: restZ + 70, spring: 'bouncy' }, { at: at + 0.35, to: restZ, spring: 'gentle' }] },
        scale: { base: restScale, steps: [{ at, to: restScale * 1.16, spring: 'bouncy' }, { at: at + 0.35, to: restScale, spring: 'gentle' }] },
        opacity: { base: 0, steps: [{ at, to: restOpacity, spring: 'snappy' }] },
      };
    },
  },
  {
    id: 'cutoutFlyToSide',
    label: 'Fly to side',
    category: 'enter',
    tags: ['cutout'],
    description: 'Lifts while flying partway toward whichever side it already leans, with a slight rotate — classic\'s flyToSide.',
    apply(layer, at) {
      const restX = base(layer, 'x', 0);
      const restZ = base(layer, 'z', 0);
      const restRz = base(layer, 'rz', 0);
      const restOpacity = base(layer, 'opacity', 1);
      const sign = restX >= 0 ? 1 : -1;
      return {
        x: { base: restX, steps: [{ at, to: restX + sign * 260, spring: 'gentle' }] },
        z: { base: restZ, steps: [{ at, to: restZ + 60, spring: 'wobbly' }] },
        rz: { base: restRz, steps: [{ at, to: restRz + sign * 8, spring: 'gentle' }] },
        opacity: { base: 0, steps: [{ at, to: restOpacity, spring: 'snappy' }] },
      };
    },
  },
  {
    id: 'cutoutZoomHero',
    label: 'Zoom hero',
    category: 'enter',
    tags: ['cutout'],
    description: 'Scales up to fill most of the frame and centers itself — classic\'s zoomHero. Approximation: classic also dims the rest of the frame while a cutout is "hero"; this engine has no whole-scene dim pass yet, so that part is dropped rather than faked.',
    apply(layer, at) {
      const restX = base(layer, 'x', 0);
      const restY = base(layer, 'y', 0);
      const restZ = base(layer, 'z', 0);
      const restScale = base(layer, 'scale', 1);
      const restOpacity = base(layer, 'opacity', 1);
      return {
        x: { base: restX, steps: [{ at, to: 0, spring: 'gentle' }] },
        y: { base: restY, steps: [{ at, to: 0, spring: 'gentle' }] },
        z: { base: restZ, steps: [{ at, to: restZ + 140, spring: 'gentle' }] },
        scale: { base: restScale * 0.5, steps: [{ at, to: restScale * 2.2, spring: 'gentle' }] },
        opacity: { base: 0, steps: [{ at, to: restOpacity, spring: 'snappy' }] },
      };
    },
  },
  {
    id: 'cutoutStack',
    label: 'Stack',
    category: 'enter',
    tags: ['cutout'],
    description: 'Fans several cutouts from the same screen into an offset stack, centered on the selection — classic\'s stack. Needs more than one layer selected to see the fan; with one, it just lifts in place.',
    apply(layer, at, group) {
      const restX = base(layer, 'x', 0);
      const restY = base(layer, 'y', 0);
      const restRz = base(layer, 'rz', 0);
      const restScale = base(layer, 'scale', 1);
      const restOpacity = base(layer, 'opacity', 1);
      const centered = group ? group.index - (group.total - 1) / 2 : 0;
      return {
        x: { base: restX, steps: [{ at, to: restX + centered * 90, spring: 'wobbly' }] },
        y: { base: restY, steps: [{ at, to: restY + Math.abs(centered) * 30, spring: 'wobbly' }] },
        rz: { base: restRz, steps: [{ at, to: restRz + centered * 8, spring: 'wobbly' }] },
        scale: { base: restScale * 0.5, steps: [{ at, to: restScale * (1.06 - Math.abs(centered) * 0.05), spring: 'bouncy' }] },
        opacity: { base: 0, steps: [{ at, to: restOpacity, spring: 'snappy' }] },
      };
    },
  },
  {
    id: 'cutoutPeel',
    label: 'Peel',
    category: 'enter',
    tags: ['cutout'],
    description: 'Lifts from one corner with a tilt, like peeling a sticker up.',
    apply(layer, at) {
      const restX = base(layer, 'x', 0);
      const restY = base(layer, 'y', 0);
      const restZ = base(layer, 'z', 0);
      const restRz = base(layer, 'rz', 0);
      const restOpacity = base(layer, 'opacity', 1);
      const sign = restX >= 0 ? 1 : -1;
      return {
        x: { base: restX - sign * 30, steps: [{ at, to: restX, spring: 'wobbly' }] },
        y: { base: restY + 40, steps: [{ at, to: restY, spring: 'wobbly' }] },
        z: { base: restZ, steps: [{ at, to: restZ + 80, spring: 'wobbly' }] },
        rz: { base: restRz - sign * 18, steps: [{ at, to: restRz, spring: 'wobbly' }] },
        opacity: { base: 0, steps: [{ at, to: restOpacity, spring: 'snappy' }] },
      };
    },
  },
  {
    id: 'cutoutOrbitDevice',
    label: 'Orbit the device',
    category: 'idle',
    tags: ['cutout'],
    description: 'Circles in 3D around wherever the cutout already rests — two floats 90° out of phase on x/z trace a true circle (not an ellipse-that-looks-like-one), the same trick a mesh-gradient background might use for a slow orbiting light.',
    apply(layer) {
      const h = hashPhase(layer.id);
      return {
        x: { steps: [], float: { amp: 70, period: 6, phase: h } },
        z: { steps: [], float: { amp: 70, period: 6, phase: h + Math.PI / 2 } },
      };
    },
  },
  {
    id: 'cutoutFanOut',
    label: 'Fan out',
    category: 'enter',
    tags: ['cutout'],
    description: 'All cutouts from the same screen explode into a radial spread, hold, then return to rest — needs more than one selected layer to fan; with one it just pops out and back.',
    apply(layer, at, group) {
      const restX = base(layer, 'x', 0);
      const restY = base(layer, 'y', 0);
      const restScale = base(layer, 'scale', 1);
      const restOpacity = base(layer, 'opacity', 1);
      const n = group?.total ?? 1;
      const i = group?.index ?? 0;
      const angle = n > 1 ? (i / (n - 1)) * Math.PI - Math.PI / 2 : 0;
      const hold = 1.1;
      return {
        x: { base: restX, steps: [{ at, to: restX + Math.sin(angle) * 200, spring: 'bouncy' }, { at: at + hold, to: restX, spring: 'gentle' }] },
        y: { base: restY, steps: [{ at, to: restY - Math.cos(angle) * 160, spring: 'bouncy' }, { at: at + hold, to: restY, spring: 'gentle' }] },
        scale: { base: restScale * 0.4, steps: [{ at, to: restScale, spring: 'bouncy' }] },
        opacity: { base: 0, steps: [{ at, to: restOpacity, spring: 'snappy' }] },
      };
    },
  },
  {
    id: 'cutoutDockToEdge',
    label: 'Dock to edge',
    category: 'enter',
    tags: ['cutout'],
    description: 'Flies all the way to the frame edge and parks there, shrinking slightly to make room for a caption beside it — unlike Fly to side, this doesn\'t stay mid-frame, it settles at the edge.',
    apply(layer, at) {
      const restX = base(layer, 'x', 0);
      const restZ = base(layer, 'z', 0);
      const restScale = base(layer, 'scale', 1);
      const restOpacity = base(layer, 'opacity', 1);
      const sign = restX >= 0 ? 1 : -1;
      return {
        x: { base: restX, steps: [{ at, to: sign * 420, spring: 'gentle' }] },
        z: { base: restZ, steps: [{ at, to: restZ + 50, spring: 'gentle' }] },
        scale: { base: restScale, steps: [{ at, to: restScale * 0.72, spring: 'gentle' }] },
        opacity: { base: 0, steps: [{ at, to: restOpacity, spring: 'snappy' }] },
      };
    },
  },
  {
    id: 'cutoutFlipReveal',
    label: 'Flip reveal',
    category: 'enter',
    tags: ['cutout'],
    description: 'Lifts and turns over to show text on its back (LayersPanel\'s "Back content" picker) — shares the same backface-culling mechanism as deviceFlipToSecond, just entering instead of mid-slide.',
    apply(layer, at) {
      const restZ = base(layer, 'z', 0);
      const restRy = base(layer, 'ry', 0);
      const restScale = base(layer, 'scale', 1);
      const restOpacity = base(layer, 'opacity', 1);
      return {
        z: { base: restZ, steps: [{ at, to: restZ + 90, spring: 'wobbly' }] },
        ry: { base: restRy, steps: [{ at, to: restRy + 180, spring: 'wobbly' }] },
        scale: { base: restScale * 0.6, steps: [{ at, to: restScale, spring: 'bouncy' }] },
        opacity: { base: 0, steps: [{ at, to: restOpacity, spring: 'snappy' }] },
      };
    },
  },
  {
    id: 'cutoutCarousel',
    label: 'Carousel',
    category: 'enter',
    tags: ['cutout'],
    description: 'Several cutouts sweep across the frame past the camera in sequence — a bigger per-layer stagger than the usual 40-70ms, since each one needs to fully clear the frame before the next arrives.',
    apply(layer, at, group) {
      const restX = base(layer, 'x', 0);
      const restZ = base(layer, 'z', 0);
      const restOpacity = base(layer, 'opacity', 1);
      const i = group?.index ?? 0;
      // Overrides the default stagger with a much bigger one (MOTION_GUIDE's
      // 40-70ms is for siblings entering together, not a literal sweep-past
      // sequence) — recomputed from `at` and `i` rather than trusting the
      // caller's small stagger, so this reads as a real carousel regardless
      // of how it was invoked.
      const sweepAt = at - i * STAGGER_SECONDS + i * 0.55;
      return {
        x: { base: restX - 500, steps: [{ at: sweepAt, to: restX + 500, spring: 'crisp', easing: BEZIER_PRESETS.linear, dur: 1.1 }] },
        z: { base: restZ, steps: [{ at: sweepAt, to: restZ + 60, spring: 'gentle' }] },
        opacity: {
          base: 0,
          steps: [
            { at: sweepAt, to: restOpacity, spring: 'snappy' },
            { at: sweepAt + 0.75, to: 0, spring: 'snappy' },
          ],
        },
      };
    },
  },
];

export function listPresets(category?: PresetCategory): MotionPreset[] {
  return category ? PRESETS.filter((p) => p.category === category) : PRESETS;
}

export function getPreset(id: string): MotionPreset | undefined {
  return PRESETS.find((p) => p.id === id);
}

/** MOTION_GUIDE.md: stagger siblings 40-70ms. */
export const STAGGER_SECONDS = 0.055;
