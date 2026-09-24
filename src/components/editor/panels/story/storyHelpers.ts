import type { StoryTimelineEntry } from '@/engine/story/timeline';
import type { StorySlide } from '@/engine/types';

/** Best-effort "which screen is showing" for an action, so its placement
 * picker defaults to a sensible image — the latest `showScreen` action
 * before it in the array (array order, not resolved time, since this only
 * needs to be a reasonable default the user can see and correct by eye). */
export function resolveActionScreenId(slide: StorySlide, actionId: string): string | null {
  const idx = slide.actions.findIndex((a) => a.id === actionId);
  for (let i = idx; i >= 0; i--) {
    const a = slide.actions[i];
    if (a.type === 'showScreen') return a.screenId;
  }
  return slide.screens[0]?.id ?? null;
}

/** Assigns each timeline entry to the lowest-numbered track that's free at
 * its start time, so 'with-previous' actions that overlap in time render on
 * separate rows instead of stacking illegibly. */
export function assignTracks(entries: StoryTimelineEntry[]): number[] {
  const trackEnds: number[] = [];
  return entries.map((e) => {
    let track = trackEnds.findIndex((end) => end <= e.start + 1e-6);
    if (track === -1) {
      track = trackEnds.length;
      trackEnds.push(e.end);
    } else {
      trackEnds[track] = e.end;
    }
    return track;
  });
}

export const ACTION_COLORS: Record<string, string> = {
  launchApp: '#6366F1',
  showScreen: '#0EA5E9',
  loading: '#8B5CF6',
  scroll: '#14B8A6',
  tap: '#F59E0B',
  longPress: '#F97316',
  swipe: '#EAB308',
  typeText: '#22C55E',
  highlight: '#EC4899',
  notification: '#EF4444',
  iconAnim: '#D946EF',
  sprite: '#3B82F6',
  successCheck: '#10B981',
  wait: '#9CA3AF',
};
