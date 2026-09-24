/**
 * Catmull-Rom spline evaluation for sprite paths. Pure function of the
 * control points and a normalized parameter u (0-1) along the whole path
 * — deterministic, no accumulated/stateful simulation, so it can be
 * queried at any t independently (required for frame-by-frame export).
 */
import type { Point } from '../types';
import { clamp } from '../utils';

function segment(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const t2 = t * t,
    t3 = t2 * t;
  return {
    x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

/** Reflects the endpoints outward so every real segment (including the
 * first/last) has 4 usable control points. */
function extend(points: Point[]): Point[] {
  const n = points.length;
  const first = points[0],
    second = points[1],
    last = points[n - 1],
    secondLast = points[n - 2];
  return [{ x: first.x - (second.x - first.x), y: first.y - (second.y - first.y) }, ...points, { x: last.x + (last.x - secondLast.x), y: last.y + (last.y - secondLast.y) }];
}

/** Evaluates the smooth path through `points` at normalized position u (0-1). */
export function evaluatePath(points: Point[], u: number): Point {
  if (points.length === 0) return { x: 0.5, y: 0.5 };
  if (points.length === 1) return points[0];
  const t = clamp(u);
  if (points.length === 2) {
    return { x: points[0].x + (points[1].x - points[0].x) * t, y: points[0].y + (points[1].y - points[0].y) * t };
  }
  const extended = extend(points);
  const numSegments = points.length - 1;
  const scaled = t * numSegments;
  const seg = Math.min(numSegments - 1, Math.floor(scaled));
  const localT = scaled - seg;
  return segment(extended[seg], extended[seg + 1], extended[seg + 2], extended[seg + 3], localT);
}

/** Facing angle (radians) of the path at u, via a small numerical derivative. */
export function pathTangentAngle(points: Point[], u: number): number {
  const eps = 0.002;
  const back = u <= eps;
  const a = evaluatePath(points, back ? u : u - eps);
  const b = evaluatePath(points, back ? u + eps : u);
  return Math.atan2(b.y - a.y, b.x - a.x);
}
