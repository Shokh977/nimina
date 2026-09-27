/**
 * Sequences a story slide's actions into absolute start/end times.
 *
 * `startMode` follows PowerPoint/Keynote-style animation trigger semantics:
 * 'after-previous' starts when the previous action in the array ends;
 * 'with-previous' starts at the same time the previous action *started*
 * (i.e. runs in parallel with it, not with whatever else might also be
 * parallel to that one). A chain of consecutive 'with-previous' actions
 * therefore all start together. The slide's total duration is the latest
 * end time across every action, so a long parallel action properly extends
 * the slide instead of being cut off.
 */
import type { Action, StorySlide } from '../types';

export interface StoryTimelineEntry {
  action: Action;
  start: number;
  end: number;
}

export interface StoryTimeline {
  entries: StoryTimelineEntry[];
  total: number;
}

/** `speedFactor` scales every action's authored duration uniformly (1 =
 * unscaled, matching the project's motionSpeed=100 default) — used by
 * playback/export/audio-sync call sites so a global speed change stretches
 * the whole story proportionally without touching the authored per-action
 * values. Editor UI that displays/edits a story's own action durations
 * (CameraEditor, StorySceneEditor, StoryTimelineView) omits it, always
 * showing the author's actual authored numbers regardless of the global
 * speed setting. */
export function getStoryTimeline(slide: StorySlide, speedFactor = 1): StoryTimeline {
  const entries: StoryTimelineEntry[] = [];
  let prevStart = 0;
  let prevEnd = 0;
  let total = 0;

  for (const action of slide.actions) {
    const start = action.startMode === 'with-previous' ? prevStart : prevEnd;
    const end = start + Math.max(0, action.duration) / speedFactor;
    entries.push({ action, start, end });
    prevStart = start;
    prevEnd = end;
    total = Math.max(total, end);
  }

  return { entries, total };
}

/** Finds the timeline entry for a given action id, if any. */
export function findEntry(timeline: StoryTimeline, actionId: string): StoryTimelineEntry | null {
  return timeline.entries.find((e) => e.action.id === actionId) ?? null;
}
