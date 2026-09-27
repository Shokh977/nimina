/**
 * 3D pose math for device mockups — perspective rotate/project and
 * per-triangle affine texture mapping, ported from
 * legacy/device-3d-lab-download.html's rotate()/project()/xform()/
 * roundRectPoints()/drawTriangle()/drawTexturedQuad(). Pure canvas-2D, no
 * WebGL. Consumed by drawDevice3D (src/engine/devices.ts), invoked only
 * when a scene has a non-null `pose3d` — the classic flat drawDevice()
 * path never calls anything here.
 *
 * Coordinate convention: unlike the prototype (which projects around a
 * fixed on-canvas camera center `cam.cx/cy`), the engine already runs
 * inside a device-centered local transform (drawScene's ctx.translate),
 * so the camera's optical center is just (0, 0) in local space — no
 * separate cx/cy bookkeeping needed here.
 */
import type { ImageAsset, Motion3DKey, Pose3D } from './types';
import { clamp, easeInOutCubic } from './utils';

export const DEG = Math.PI / 180;

export interface Point3 {
  x: number;
  y: number;
  z: number;
}
export interface Point2 {
  x: number;
  y: number;
  /** Projected scale at this point (focal / depth) — callers that need to
   * size something (e.g. a dot's radius) consistently with perspective
   * can multiply by this. */
  s: number;
}

/** Rotates a device-local point by the pose's rx/ry/rz (degrees), in the
 * same Z (roll) → X (pitch) → Y (yaw) order as the prototype's rotate(). */
export function rotate3d(p: Point3, rx: number, ry: number, rz: number): Point3 {
  let { x, y, z } = p;
  const cz = Math.cos(rz * DEG),
    sz = Math.sin(rz * DEG);
  [x, y] = [x * cz - y * sz, x * sz + y * cz];
  const cx = Math.cos(rx * DEG),
    sx = Math.sin(rx * DEG);
  [y, z] = [y * cx - z * sx, y * sx + z * cx];
  const cy = Math.cos(ry * DEG),
    sy = Math.sin(ry * DEG);
  [x, z] = [x * cy + z * sy, -x * sy + z * cy];
  return { x, y, z };
}

/** Perspective-divides a (rotated) point by (distance - z). `focal =
 * pose.distance * pose.scale`, mirroring the prototype's `cam.f =
 * dist*scale` — scale directly controls apparent size without changing
 * the depth falloff. */
export function project3d(p: Point3, pose: Pose3D): Point2 {
  const focal = pose.distance * pose.scale;
  const d = Math.max(1, pose.distance - p.z);
  const s = focal / d;
  return { x: p.x * s, y: p.y * s, s };
}

/** rotate3d + project3d in one call — the composition every draw site uses. */
export function xform3d(p: Point3, pose: Pose3D): Point2 {
  return project3d(rotate3d(p, pose.rx, pose.ry, pose.rz), pose);
}

/** True iff the pose has no rotation at all — at rx=ry=rz=0 every point on
 * a flat face shares the same z, so project3d degenerates to one uniform
 * scale factor. Callers (drawDevice3D) use this to skip the whole
 * triangle-mesh/projected-polygon path and fall back to the exact classic
 * drawDevice(), wrapped in that one scale — avoids any seam/anti-aliasing
 * drift between the two renderers for the "Front" pose. */
export function isFrontPose(pose: Pose3D): boolean {
  return pose.rx === 0 && pose.ry === 0 && pose.rz === 0;
}

/** Uniform scale factor a front-facing (rx=ry=rz=0) pose applies at local
 * depth `z` — see isFrontPose. */
export function frontPoseScale(pose: Pose3D, z: number): number {
  return (pose.distance * pose.scale) / Math.max(1, pose.distance - z);
}

/** Rounded-rect outline sampled as a point ring at local depth `z` — direct
 * port of the prototype's roundRectPoints(), used for both the front and
 * back faces (the ring is what gets projected and filled as a polygon,
 * or used as a clip path, since ctx has no native 3D rect primitive). */
export function roundRectPoints3d(w: number, h: number, r: number, z: number, steps = 6): Point3[] {
  const hw = w / 2,
    hh = h / 2,
    pts: Point3[] = [];
  const corner = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (i / steps) * (Math.PI / 2);
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, z });
    }
  };
  corner(hw - r, hh - r, 0);
  corner(-hw + r, hh - r, Math.PI / 2);
  corner(-hw + r, -hh + r, Math.PI);
  corner(hw - r, -hh + r, Math.PI * 1.5);
  return pts;
}

/** Draws a closed path through already-projected points (ctx.moveTo/
 * lineTo/closePath) — caller fills/strokes/clips it. */
export function pathFrom3d(ctx: CanvasRenderingContext2D, pts: Array<{ x: number; y: number }>): void {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}

interface UV {
  u: number;
  v: number;
}

/** Fills one destination triangle (already-projected points d0/d1/d2)
 * with the affine-mapped source slice s0/s1/s2 (source-image pixel
 * coords) — direct port of the prototype's drawTriangle(). `bleed`
 * expands the destination triangle slightly around its centroid before
 * clipping, hiding hairline seams between adjacent triangles. */
export function drawTexturedTriangle(ctx: CanvasRenderingContext2D, img: ImageAsset, s0: UV, s1: UV, s2: UV, d0: Point2, d1: Point2, d2: Point2, bleed: number): void {
  const gx = (d0.x + d1.x + d2.x) / 3,
    gy = (d0.y + d1.y + d2.y) / 3;
  const e = (p: Point2) => ({ x: gx + (p.x - gx) * bleed, y: gy + (p.y - gy) * bleed });
  const e0 = e(d0),
    e1 = e(d1),
    e2 = e(d2);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(e0.x, e0.y);
  ctx.lineTo(e1.x, e1.y);
  ctx.lineTo(e2.x, e2.y);
  ctx.closePath();
  ctx.clip();
  const dx1 = s1.u - s0.u,
    dy1 = s1.v - s0.v,
    dx2 = s2.u - s0.u,
    dy2 = s2.v - s0.v;
  const det = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(det) > 1e-9) {
    const px1 = d1.x - d0.x,
      py1 = d1.y - d0.y,
      px2 = d2.x - d0.x,
      py2 = d2.y - d0.y;
    const a = (px1 * dy2 - px2 * dy1) / det,
      b = (py1 * dy2 - py2 * dy1) / det,
      c = (px2 * dx1 - px1 * dx2) / det,
      d = (py2 * dx1 - py1 * dx2) / det;
    ctx.transform(a, b, c, d, d0.x - a * s0.u - c * s0.v, d0.y - b * s0.u - d * s0.v);
    const iw = 'naturalWidth' in img ? img.naturalWidth || img.width : img.width;
    const ih = 'naturalHeight' in img ? img.naturalHeight || img.height : img.height;
    const bx = Math.max(0, Math.min(s0.u, s1.u, s2.u) - 1),
      by = Math.max(0, Math.min(s0.v, s1.v, s2.v) - 1);
    const bw = Math.min(iw - bx, Math.max(s0.u, s1.u, s2.u) + 1 - bx),
      bh = Math.min(ih - by, Math.max(s0.v, s1.v, s2.v) + 1 - by);
    if (bw > 0 && bh > 0) ctx.drawImage(img, bx, by, bw, bh, bx, by, bw, bh);
  }
  ctx.restore();
}

/** Texture-maps `img` (cover-fit into a w×h rect, top-aligned crop — same
 * convention as devices.ts's imgRect) onto the projected quad at local
 * depth `z`, by subdividing it into an N×N grid of affine triangles —
 * direct port of the prototype's drawTexturedQuad(). Fixed `N` for this
 * milestone; adaptive density (lower for preview, higher for export) is
 * deferred. */
export function drawTexturedQuad3d(ctx: CanvasRenderingContext2D, img: ImageAsset, w: number, h: number, z: number, pose: Pose3D, N: number, cx = 0, cy = 0): void {
  const iw = 'naturalWidth' in img ? img.naturalWidth || img.width : img.width;
  const ih = 'naturalHeight' in img ? img.naturalHeight || img.height : img.height;
  const s = Math.max(w / iw, h / ih),
    cw = w / s,
    ch = h / s;
  const u0 = (iw - cw) / 2,
    v0 = 0;
  const grid: Array<Array<Point2 & UV>> = [];
  for (let j = 0; j <= N; j++) {
    const row: Array<Point2 & UV> = [];
    for (let i = 0; i <= N; i++) {
      const fx = i / N,
        fy = j / N;
      const p = xform3d({ x: cx + (fx - 0.5) * w, y: cy + (fy - 0.5) * h, z }, pose);
      row.push({ x: p.x, y: p.y, s: p.s, u: u0 + fx * cw, v: v0 + fy * ch });
    }
    grid.push(row);
  }
  // A larger overlap than the prototype's own 1.02 — canvas 2D's clip()
  // antialiases each triangle's edge, and that faint edge blending with an
  // adjacent triangle's independently-affine-mapped pixels is visible as a
  // crosshatch of the mesh itself (confirmed empirically: raising N alone
  // just made the pattern finer, not fainter, since it's an edge-blend
  // artifact, not a perspective-approximation error). A bigger bleed makes
  // each triangle's fully-opaque core (not just its own antialiased sliver)
  // cover its neighbor's edge.
  const bleed = 1.15;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const a = grid[j][i],
        b = grid[j][i + 1],
        c = grid[j + 1][i + 1],
        d = grid[j + 1][i];
      drawTexturedTriangle(ctx, img, a, b, c, a, b, c, bleed);
      drawTexturedTriangle(ctx, img, a, c, d, a, c, d, bleed);
    }
  }
}

/* ───────────────────────── motion presets ─────────────────────────
 * Each motion is a pure function of (base pose, slide-local elapsed time,
 * slide duration) — no simulation state carried between frames, so any
 * frame can be rendered independently (required for frame-by-frame
 * export), matching the existing scene.anim's use of `local`. Continuous
 * oscillators (turntable/orbit/handheld) run for the whole slide; one-shot
 * eases (swing/flip/unfold) resolve to the base pose within roughly the
 * first second and hold, mirroring how scene.anim's rise/pop/slide already
 * complete their entrance and hold. Ported from the prototype's
 * motionPose(t), replacing its fixed 4.2s loop with `local`/`dur`. */

/** Critically/over-damped spring approach to 1, evaluated at time t (no
 * velocity memory — a closed-form function of t, not a simulation step).
 * Direct port of the prototype's spring(). */
function spring(t: number, k = 300, c = 18): number {
  if (t <= 0) return 0;
  const w = Math.sqrt(k),
    z = c / (2 * w);
  if (z < 1) {
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
  }
  return 1 - Math.exp(-w * t) * (1 + w * t);
}

export function resolveMotion3d(base: Pose3D, motion: Motion3DKey, local: number, dur: number): Pose3D {
  const b = { ...base };
  switch (motion) {
    case 'turntable':
      b.ry = base.ry + Math.sin(local * 0.8) * 22;
      b.rx = base.rx + Math.sin(local * 0.55) * 4;
      break;
    case 'swing': {
      const p = spring(local, 260, 17);
      b.ry = -78 + (base.ry + 78) * p;
      b.rz = 14 * (1 - p) + base.rz * p;
      b.scale = base.scale * (0.86 + 0.14 * p);
      break;
    }
    case 'flip': {
      const p = easeInOutCubic(clamp((local - 0.12) / Math.max(0.35, dur * 0.4)));
      b.ry = base.ry + 180 * p;
      b.rx = base.rx + Math.sin(p * Math.PI) * 8;
      break;
    }
    case 'unfold': {
      const p = spring(local, 200, 20);
      b.rx = 74 - (74 - base.rx) * p;
      b.ry = base.ry * p;
      b.scale = base.scale * (0.9 + 0.1 * p);
      break;
    }
    case 'handheld':
      b.rx = base.rx + Math.sin(local * 1.7) * 1.6 + Math.sin(local * 3.9) * 0.7;
      b.ry = base.ry + Math.sin(local * 1.3 + 1) * 2.1 + Math.sin(local * 4.3) * 0.8;
      b.rz = base.rz + Math.sin(local * 1.1) * 0.8;
      break;
    case 'orbit':
      b.ry = base.ry + Math.sin(local * 0.55) * 40;
      b.rx = base.rx + Math.cos(local * 0.55) * 7;
      break;
    default:
      break;
  }
  return b;
}

