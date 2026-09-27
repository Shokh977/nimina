/**
 * Flattens a project's story-slide actions into an absolute-time sound
 * event list — the shared source of truth for both live preview playback
 * and export mixdown, so they never drift out of sync with each other.
 */
import { getTimeline } from '../render';
import { getStoryTimeline } from '../story';
import type { Project } from '../types';
import { resolveSfx, type SfxId } from './sfx';

export interface SfxEvent {
  /** Absolute time (seconds) within the whole project's timeline. */
  time: number;
  id: SfxId;
}

export function getSfxEvents(project: Project): SfxEvent[] {
  const events: SfxEvent[] = [];
  const speedFactor = project.motionSpeed / 100;
  for (const seg of getTimeline(project).list) {
    if (seg.type !== 'scene' || !seg.scene || seg.scene.kind !== 'story') continue;
    const timeline = getStoryTimeline(seg.scene, speedFactor);
    for (const entry of timeline.entries) {
      const id = resolveSfx(entry.action);
      if (id !== 'none') events.push({ time: seg.start + entry.start, id });
    }
  }
  events.sort((a, b) => a.time - b.time);
  return events;
}
