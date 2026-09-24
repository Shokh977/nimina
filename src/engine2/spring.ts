/**
 * Analytic damped springs — deterministic for any time t (no simulation
 * state, no per-frame integration), so any frame can be evaluated in
 * isolation. Ported exactly from legacy/motion-lab-download.html's
 * spr()/tr()/SP — see docs/MOTION_GUIDE.md for the design rules this
 * implements. Framework-agnostic (no Three.js import) so it's reusable
 * anywhere motion needs a spring, not just Engine v2's 3D layers.
 */

export interface SpringParams {
  /** Stiffness. */
  k: number;
  /** Damping. */
  c: number;
}

/** Named presets — gentle/bouncy/snappy are the three docs/MOTION_GUIDE.md
 * names explicitly; soft/wobbly/punch/crisp are further presets templates
 * and styles can reference. */
export const SP: Record<string, SpringParams> = {
  gentle: { k: 170, c: 26 },
  bouncy: { k: 300, c: 18 },
  snappy: { k: 420, c: 32 },
  soft: { k: 110, c: 20 },
  wobbly: { k: 240, c: 13 },
  punch: { k: 520, c: 26 },
  crisp: { k: 380, c: 27 },
};

export type SpringPresetId = keyof typeof SP;

/** 0→1 damped-spring settle curve at time `t` (seconds) since the spring
 * started. Underdamped springs (z<1) overshoot and ring; critically/over-
 * damped ones (z>=1) approach 1 without crossing it — used for fast,
 * non-overshooting exits. */
export function spr(t: number, p: SpringParams): number {
  if (t <= 0) return 0;
  const w = Math.sqrt(p.k);
  const z = p.c / (2 * w);
  if (z < 1) {
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
  }
  return 1 - Math.exp(-w * t) * (1 + w * t);
}

export type SpringStep = [at: number, to: number, spring: SpringParams];

/**
 * Superposed spring steps: starting from `v0`, each `[at, to, spring]` step
 * moves the value toward `to` via a spring starting at time `at` — and
 * because each step's contribution is simply added on top of the ones
 * before it (rather than replacing them), a step that starts before the
 * previous one has fully settled blends smoothly instead of jump-cutting.
 * This is *the* mechanism behind "overlap" in docs/MOTION_GUIDE.md: the
 * next move can start while the current one is still 70% settled.
 */
export function tr(t: number, v0: number, steps: SpringStep[]): number {
  let v = v0;
  let prev = v0;
  for (const [at, to, sp] of steps) {
    v += (to - prev) * spr(t - at, sp);
    prev = to;
  }
  return v;
}

/** Ease-in (cubic) progress from `at` over `dur` seconds — used for exits,
 * which per docs/MOTION_GUIDE.md are fast (200-300ms) and don't overshoot,
 * so they use this instead of a spring. */
export function out(t: number, at: number, dur: number): number {
  const x = Math.min(1, Math.max(0, (t - at) / dur));
  return x * x * x;
}

export function easeInOut(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Idle float — every resting element has one per docs/MOTION_GUIDE.md
 * ("nothing is fully static"): a slow sinusoidal drift, `amp` px over
 * `period` seconds, `ph` phase (radians) so siblings don't move in unison. */
export function float(t: number, amp: number, period: number, ph = 0): number {
  return Math.sin((t / period) * Math.PI * 2 + ph) * amp;
}

export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
