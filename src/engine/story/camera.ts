/**
 * Camera targeting for story slides. Both modes are pure functions of
 * (derived keyframe list, t) — no simulation state carried between frames
 * — required so any frame can be rendered independently (frame-by-frame
 * export). "Critically damped, never jerky" is approximated deterministically
 * as smooth eased ramps between held poses (auto) or continuous eased
 * interpolation between authored poses (manual) — a literal spring
 * simulation would need per-frame velocity memory, which isn't compatible
 * with querying an arbitrary t in isolation.
 */
import type { CameraKey, Point, StorySlide } from '../types';
import { clamp } from '../utils';
import { resolveEasing } from './easing';
import { findEntry, type StoryTimeline } from './timeline';

export interface CameraState {
  target: Point;
  zoom: number;
  rotation: number;
}

export const NEUTRAL_CAMERA: CameraState = { target: { x: 0.5, y: 0.5 }, zoom: 1, rotation: 0 };

const PUSH_IN_ZOOM = 1.6;
const PUSH_IN_RAMP = 0.5;
const PULL_OUT_RAMP = 0.6;

interface Keyframe extends CameraState {
  time: number;
  /** How long (seconds) the ease *into* this keyframe takes; the camera
   * holds the previous keyframe's pose until `time - ramp`. */
  ramp: number;
}

function autoKeyframes(timeline: StoryTimeline): Keyframe[] {
  const raw: Keyframe[] = [{ time: 0, ...NEUTRAL_CAMERA, ramp: 0 }];

  for (const e of timeline.entries) {
    const a = e.action;
    if (a.type === 'tap' || a.type === 'longPress' || a.type === 'successCheck') {
      raw.push({ time: e.start + a.duration * 0.5, target: { x: a.x, y: a.y }, zoom: PUSH_IN_ZOOM, rotation: 0, ramp: PUSH_IN_RAMP });
    } else if (a.type === 'iconAnim') {
      raw.push({ time: e.start + a.duration * 0.35, target: { x: a.x, y: a.y }, zoom: PUSH_IN_ZOOM, rotation: 0, ramp: PUSH_IN_RAMP });
    } else if (a.type === 'typeText') {
      raw.push({ time: e.start + Math.min(a.duration * 0.4, 0.3), target: { x: a.x, y: a.y }, zoom: 1.5, rotation: 0, ramp: PUSH_IN_RAMP });
    } else if (a.type === 'highlight') {
      raw.push({ time: e.start + a.duration * 0.4, target: { x: a.x + a.w / 2, y: a.y + a.h / 2 }, zoom: 1.5, rotation: 0, ramp: PUSH_IN_RAMP });
    } else if (a.type === 'scroll' || a.type === 'showScreen') {
      raw.push({ time: e.start, ...NEUTRAL_CAMERA, ramp: PULL_OUT_RAMP });
    }
  }
  raw.push({ time: timeline.total, ...NEUTRAL_CAMERA, ramp: PULL_OUT_RAMP });

  raw.sort((a, b) => a.time - b.time);
  // Clamp each ramp so consecutive ramps never overlap.
  for (let i = 1; i < raw.length; i++) {
    raw[i].ramp = Math.min(raw[i].ramp, (raw[i].time - raw[i - 1].time) * 0.9);
  }
  return raw;
}

/** Holds each keyframe's pose, easing into the next one during its `ramp`
 * window right before that keyframe's time. */
function sampleHeld(keys: Keyframe[], t: number): CameraState {
  if (keys.length === 0) return NEUTRAL_CAMERA;
  let idx = 0;
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].time <= t) idx = i;
    else break;
  }
  const cur = keys[idx];
  const next = keys[idx + 1];
  if (!next) return { target: cur.target, zoom: cur.zoom, rotation: cur.rotation };
  const rampStart = next.time - next.ramp;
  if (t < rampStart) return { target: cur.target, zoom: cur.zoom, rotation: cur.rotation };
  const p = resolveEasing('easeInOutCubic')(clamp((t - rampStart) / Math.max(0.0001, next.time - rampStart)));
  return blend(cur, next, p);
}

/** Continuous ease across the full gap between each pair of consecutive keys. */
function sampleContinuous(keys: Keyframe[], t: number): CameraState {
  if (keys.length === 0) return NEUTRAL_CAMERA;
  if (t <= keys[0].time) return { target: keys[0].target, zoom: keys[0].zoom, rotation: keys[0].rotation };
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i],
      b = keys[i + 1];
    if (t <= b.time) {
      const p = resolveEasing('easeInOutCubic')(clamp((t - a.time) / Math.max(0.0001, b.time - a.time)));
      return blend(a, b, p);
    }
  }
  const last = keys[keys.length - 1];
  return { target: last.target, zoom: last.zoom, rotation: last.rotation };
}

function blend(a: CameraState, b: CameraState, p: number): CameraState {
  return {
    target: { x: a.target.x + (b.target.x - a.target.x) * p, y: a.target.y + (b.target.y - a.target.y) * p },
    zoom: a.zoom + (b.zoom - a.zoom) * p,
    rotation: a.rotation + (b.rotation - a.rotation) * p,
  };
}

function manualKeyframes(cameraKeys: CameraKey[], timeline: StoryTimeline): Keyframe[] {
  const resolved = cameraKeys
    .map((k) => {
      const time = 'time' in k && k.time !== undefined ? k.time : (findEntry(timeline, k.actionId as string)?.start ?? 0);
      return { time, target: k.target, zoom: k.zoom, rotation: k.rotation ?? 0, ramp: 0 };
    })
    .sort((a, b) => a.time - b.time);
  return resolved.length ? resolved : [{ time: 0, ...NEUTRAL_CAMERA, ramp: 0 }];
}

export function resolveCamera(slide: StorySlide, timeline: StoryTimeline, t: number): CameraState {
  if (slide.cameraMode === 'manual') {
    return sampleContinuous(manualKeyframes(slide.cameraKeys, timeline), t);
  }
  return sampleHeld(autoKeyframes(timeline), t);
}
