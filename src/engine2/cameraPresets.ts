/**
 * Camera motion presets (Tier "B" — expanding the 5 patterns every template
 * already hand-authors ad hoc — still/push in/pull out/drift/handheld —
 * into a real, reusable, one-click library, plus 8 new ones). Mirrors
 * presets.ts's shape exactly (a pure function of the camera's *current*
 * resting values producing per-axis patches, applied by editorV2Store's
 * applyCameraPreset, which owns merge policy) but keyed against
 * CameraLayerDef's nested position/target/rotation/zoom/fov instead of a
 * layer's flat transform — different enough in structure to warrant its
 * own axis type rather than shoehorning into presets.ts's Axis.
 *
 * Every preset takes a resolved `target: {x,y,z} | null` — "which layer or
 * point it moves toward" (the target picker) — resolved by the caller
 * (editorV2Store.ts, which has access to `project.layers`) from either a
 * layer id's current rest position or an explicit point, so this file has
 * no dependency on LayerDef at all and stays as pure/reusable as
 * presets.ts. A preset that doesn't need a target (still/drift/handheld)
 * simply ignores it.
 *
 * MOTION_GUIDE.md: "at most one major camera move per ~2 seconds" — unlike
 * layer presets (which compose enter+idle+emphasis+exit), a camera preset
 * is deliberately a single, replacing move: applying a new one always
 * replaces whatever steps already exist on the axes it touches (see
 * editorV2Store's applyCameraPreset), never appends. This matches "one
 * camera move" as a mental model — you wouldn't want two competing pushes
 * fighting on the same axis.
 */
import type { CameraLayerDef, KeyframeStep, PropertyTrack } from './types';

export type CameraAxis = 'px' | 'py' | 'pz' | 'tx' | 'ty' | 'tz' | 'rx' | 'ry' | 'rz' | 'zoom' | 'fov' | 'focusOffset';

export interface CameraAxisPatch {
  base?: number;
  steps: KeyframeStep[];
  /** Handheld's noise — same idle mechanism as presets.ts's device idle
   * float (PropertyTrack.float), applied here to camera axes instead of a
   * layer's. */
  float?: { amp: number; period: number; phase: number };
}

export type CameraPatch = Partial<Record<CameraAxis, CameraAxisPatch>>;

export type CameraTarget = { x: number; y: number; z: number } | null;

export interface CameraPreset {
  id: string;
  label: string;
  description: string;
  /** Whether this preset's motion is meaningfully different depending on
   * having a target layer/point picked — a UI hint (shows "pick a target
   * first" for these) rather than a hard requirement: every preset here
   * still runs with `target: null`, just aimed at wherever the camera's
   * own target track currently rests instead of a chosen subject. */
  needsTarget: boolean;
  apply(camera: CameraLayerDef, target: CameraTarget, at: number): CameraPatch;
}

function base(camera: CameraLayerDef, axis: CameraAxis, fallback: number): number {
  const track = trackFor(camera, axis);
  return track?.base ?? fallback;
}

function trackFor(camera: CameraLayerDef, axis: CameraAxis): PropertyTrack | undefined {
  switch (axis) {
    case 'px':
      return camera.position.x;
    case 'py':
      return camera.position.y;
    case 'pz':
      return camera.position.z;
    case 'tx':
      return camera.target.x;
    case 'ty':
      return camera.target.y;
    case 'tz':
      return camera.target.z;
    case 'rx':
      return camera.rotation.rx;
    case 'ry':
      return camera.rotation.ry;
    case 'rz':
      return camera.rotation.rz;
    case 'zoom':
      return camera.zoom;
    case 'fov':
      return camera.fov;
    case 'focusOffset':
      return camera.focusOffset;
  }
}

const PRESETS: CameraPreset[] = [
  // ---------- Keep (the 5 existing patterns, now real presets) ----------
  {
    id: 'still',
    label: 'Still',
    description: 'No major move — only the always-on idle drift (MOTION_GUIDE.md: never perfectly still). Clears any previous push/pull on zoom.',
    needsTarget: false,
    apply(camera, _target, at) {
      const restZoom = base(camera, 'zoom', 1);
      return { zoom: { steps: [{ at, to: restZoom, spring: 'gentle' }] } };
    },
  },
  {
    id: 'pushIn',
    label: 'Push in',
    description: 'Slow dolly toward the target (or straight ahead without one) — the DOF blur grows as it pushes past zoom 1, per MOTION_GUIDE.md.',
    needsTarget: false,
    apply(camera, target, at) {
      const restZoom = base(camera, 'zoom', 1);
      const patch: CameraPatch = { zoom: { steps: [{ at, to: Math.max(restZoom, 1.18), spring: 'gentle' }] } };
      if (target) {
        patch.tx = { base: target.x, steps: [] };
        patch.ty = { base: target.y, steps: [] };
      }
      return patch;
    },
  },
  {
    id: 'pullOut',
    label: 'Pull out',
    description: 'Slow dolly away, revealing more of the frame.',
    needsTarget: false,
    apply(camera, _target, at) {
      const restZoom = base(camera, 'zoom', 1);
      return { zoom: { steps: [{ at, to: Math.min(restZoom, 0.88), spring: 'gentle' }] } };
    },
  },
  {
    id: 'driftPreset',
    label: 'Drift',
    description: 'Explicitly just the idle drift — clears any authored move so drift is the only thing visible (camera.ts\'s drift stays on by default regardless; this preset is for undoing a previous push/pan back to a calm hold).',
    needsTarget: false,
    apply(camera, _target, at) {
      const restZoom = base(camera, 'zoom', 1);
      const restX = base(camera, 'px', 0);
      const restY = base(camera, 'py', 0);
      return {
        zoom: { steps: [{ at, to: restZoom, spring: 'soft' }] },
        px: { steps: [{ at, to: restX, spring: 'soft' }] },
        py: { steps: [{ at, to: restY, spring: 'soft' }] },
      };
    },
  },
  {
    id: 'handheldCamera',
    label: 'Handheld',
    description: 'Subtle organic noise on position/rotation — approximated as small sine floats at different periods, the same technique deviceIdleHandheld uses (no true noise primitive in PropertyTrack).',
    needsTarget: false,
    apply() {
      return {
        px: { steps: [], float: hFloat(1.2, 2.6, 0) },
        py: { steps: [], float: hFloat(1.0, 3.1, 1.4) },
        rz: { steps: [], float: hFloat(0.3, 2.2, 2.8) },
      };
    },
  },

  // ---------- Add ----------
  {
    id: 'orbitLeft',
    label: 'Orbit left',
    description: 'Arcs around the target to the left — position.x and target stay locked on the subject, so the turn reads as real parallax, not a pan.',
    needsTarget: true,
    apply(camera, target, at) {
      return orbit(camera, target, at, -1);
    },
  },
  {
    id: 'orbitRight',
    label: 'Orbit right',
    description: 'Arcs around the target to the right.',
    needsTarget: true,
    apply(camera, target, at) {
      return orbit(camera, target, at, 1);
    },
  },
  {
    id: 'craneDown',
    label: 'Crane down',
    description: 'Rises the camera up and tilts down onto the target, like a crane arm descending.',
    needsTarget: false,
    apply(camera, _target, at) {
      const restY = base(camera, 'py', 0);
      return { py: { base: restY - 160, steps: [{ at, to: restY, spring: 'gentle' }] } };
    },
  },
  {
    id: 'craneUp',
    label: 'Crane up',
    description: 'Lowers from above, rising up and away — the reverse of crane down.',
    needsTarget: false,
    apply(camera, _target, at) {
      const restY = base(camera, 'py', 0);
      return { py: { base: restY + 160, steps: [{ at, to: restY, spring: 'gentle' }] } };
    },
  },
  {
    id: 'whipPan',
    label: 'Whip pan',
    description: 'A fast move to the target — approximation: a snappy, fast-settling spring stands in for a true motion-blur streak, since export\'s motion blur is a global per-frame accumulation, not a directional per-move effect yet.',
    needsTarget: true,
    apply(camera, target, at) {
      const patch: CameraPatch = {};
      if (target) {
        patch.tx = { steps: [{ at, to: target.x, spring: 'punch' }] };
        patch.ty = { steps: [{ at, to: target.y, spring: 'punch' }] };
        patch.px = { steps: [{ at, to: target.x * 0.3, spring: 'punch' }] };
      }
      return patch;
    },
  },
  {
    id: 'rackFocus',
    label: 'Rack focus',
    description: 'Shifts depth-of-field from background to foreground (needs a target — the layer that becomes sharp) via the camera\'s independent focus-offset track, not zoom, so it works without also pushing in.',
    needsTarget: true,
    apply(camera, target, at) {
      // focusOffset is a world-Z delta from the subject plane the camera
      // already focuses on at rest (camera.ts: focus = cz + focusOffset) —
      // targeting a layer's own z pulls focus exactly onto its depth.
      const to = target ? target.z : 0;
      return { focusOffset: { base: 0, steps: [{ at, to, spring: 'gentle' }] } };
    },
  },
  {
    id: 'dollyZoom',
    label: 'Dolly zoom',
    description: 'The vertigo/Hitchcock effect — fov widens while the camera dollies in (or the reverse), keeping the subject roughly the same size while the background warps.',
    needsTarget: false,
    apply(camera, _target, at) {
      const restFov = base(camera, 'fov', 30);
      const restZ = base(camera, 'pz', 0);
      return {
        fov: { steps: [{ at, to: restFov + 16, spring: 'gentle' }] },
        pz: { steps: [{ at, to: restZ - 220, spring: 'gentle' }] },
      };
    },
  },
  {
    id: 'snapToElement',
    label: 'Snap to element',
    description: 'Sharply frames the target, holds, then eases back to the original shot — a two-phase move (snap via a punchy spring, return via a slower one) rather than a one-way reframe.',
    needsTarget: true,
    apply(camera, target, at) {
      const restTx = base(camera, 'tx', 0);
      const restTy = base(camera, 'ty', 0);
      const restZoom = base(camera, 'zoom', 1);
      const hold = 0.9;
      if (!target) return {};
      return {
        tx: { steps: [{ at, to: target.x, spring: 'punch' }, { at: at + hold, to: restTx, spring: 'gentle' }] },
        ty: { steps: [{ at, to: target.y, spring: 'punch' }, { at: at + hold, to: restTy, spring: 'gentle' }] },
        zoom: { steps: [{ at, to: Math.max(restZoom, 1.22), spring: 'punch' }, { at: at + hold, to: restZoom, spring: 'gentle' }] },
      };
    },
  },
];

function hFloat(amp: number, period: number, phase: number): { amp: number; period: number; phase: number } {
  return { amp, period, phase };
}

/** Orbit shares its body between left/right (direction ±1) — sweeps
 * position.x around the target while target.x/y stay locked onto it, so
 * the camera keeps looking at the same point throughout (real parallax,
 * per the spec, rather than a pan that just slides the frame). */
function orbit(camera: CameraLayerDef, target: CameraTarget, at: number, dir: 1 | -1): CameraPatch {
  const restX = base(camera, 'px', 0);
  if (!target) return {};
  const sweep = 260 * dir;
  return {
    px: { steps: [{ at, to: restX + sweep, spring: 'gentle' }, { at: at + 1.6, to: restX, spring: 'soft' }] },
    tx: { base: target.x, steps: [] },
    ty: { base: target.y, steps: [] },
  };
}

export function listCameraPresets(): CameraPreset[] {
  return PRESETS;
}

export function getCameraPreset(id: string): CameraPreset | undefined {
  return PRESETS.find((p) => p.id === id);
}
