/**
 * Resolves, for a given local time t, which "phase" the phone is in (home
 * screen, loading, or showing a specific screenshot), whether a
 * showScreen transition is still animating, and the current scroll offset.
 * Pure function of (timeline entries, t) — no state carried between calls,
 * so any t can be queried independently (required for frame-by-frame export).
 */
import type { LaunchAppAction, LoadingAction, ScreenTransition } from '../types';
import { clamp } from '../utils';
import { resolveEasing } from './easing';
import type { StoryTimelineEntry } from './timeline';

export type StoryPhase = 'none' | 'home' | 'loading' | 'screen';

export interface ScreenState {
  phase: StoryPhase;
  screenId: string | null;
  launchAction: LaunchAppAction | null;
  loadingAction: LoadingAction | null;
  fromPhase: StoryPhase;
  fromScreenId: string | null;
  transition: ScreenTransition;
  /** 0-1 eased; 1 once a transition has settled (or none is active). */
  transitionProgress: number;
  /** 0-1 scroll offset for the current screen. */
  scroll: number;
  /** Slide-local time the current phase started — subtract from `t` to get
   * the current action's own local progress (what launchApp/loading's draw
   * functions expect). */
  phaseStart: number;
}

type PhaseEntry =
  | { phase: 'home'; start: number; action: LaunchAppAction }
  | { phase: 'loading'; start: number; action: LoadingAction }
  | { phase: 'screen'; start: number; screenId: string; transition: ScreenTransition; duration: number };

const EMPTY_STATE: ScreenState = {
  phase: 'none',
  screenId: null,
  launchAction: null,
  loadingAction: null,
  fromPhase: 'none',
  fromScreenId: null,
  transition: 'none',
  transitionProgress: 1,
  scroll: 0,
  phaseStart: 0,
};

export function resolveScreenState(entries: StoryTimelineEntry[], t: number): ScreenState {
  const phases: PhaseEntry[] = [];
  for (const e of entries) {
    if (e.action.type === 'launchApp') phases.push({ phase: 'home', start: e.start, action: e.action });
    else if (e.action.type === 'loading') phases.push({ phase: 'loading', start: e.start, action: e.action });
    else if (e.action.type === 'showScreen') phases.push({ phase: 'screen', start: e.start, screenId: e.action.screenId, transition: e.action.transition, duration: e.action.duration });
  }
  if (phases.length === 0) return EMPTY_STATE;

  let idx = phases.findIndex((p, i) => t >= p.start && (i === phases.length - 1 || t < phases[i + 1].start));
  if (idx < 0) idx = t < phases[0].start ? 0 : phases.length - 1;
  const cur = phases[idx];
  const prev = idx > 0 ? phases[idx - 1] : null;

  let transition: ScreenTransition = 'none';
  let transitionProgress = 1;
  if (cur.phase === 'screen' && prev) {
    const localT = t - cur.start;
    if (localT < cur.duration && cur.transition !== 'none') {
      transition = cur.transition;
      transitionProgress = resolveEasing('easeInOutCubic')(clamp(localT / Math.max(0.0001, cur.duration)));
    }
  }

  const scroll = cur.phase === 'screen' ? resolveScroll(entries, cur.start, t) : 0;

  return {
    phase: cur.phase,
    screenId: cur.phase === 'screen' ? cur.screenId : null,
    launchAction: cur.phase === 'home' ? cur.action : null,
    loadingAction: cur.phase === 'loading' ? cur.action : null,
    fromPhase: prev ? prev.phase : 'none',
    fromScreenId: prev && prev.phase === 'screen' ? prev.screenId : null,
    transition,
    transitionProgress,
    scroll,
    phaseStart: cur.start,
  };
}

/** Latest `scroll` action belonging to the screen that started at
 * `screenPhaseStart`, evaluated at `t`. */
function resolveScroll(entries: StoryTimelineEntry[], screenPhaseStart: number, t: number): number {
  let active: StoryTimelineEntry | null = null;
  for (const e of entries) {
    if (e.action.type !== 'scroll') continue;
    if (e.start < screenPhaseStart) continue;
    if (e.start > t) break;
    active = e;
  }
  if (!active || active.action.type !== 'scroll') return 0;
  const { from, to, easing, overshoot } = active.action;
  if (t >= active.end) return clamp(to);

  const p = clamp((t - active.start) / Math.max(0.0001, active.end - active.start));
  let value = from + (to - from) * resolveEasing(easing)(p);
  if (overshoot && p > 0.75) {
    const dir = to >= from ? 1 : -1;
    value += Math.sin(((p - 0.75) / 0.25) * Math.PI) * 0.025 * dir;
  }
  return clamp(value, 0, 1);
}
