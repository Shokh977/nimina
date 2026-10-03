import { beatTimes } from '@/engine/audio/clips';
import { getTimeline } from '@/engine/render';
import type { AudioClip, Project } from '@/engine/types';

const MIN_DUR = 0.5;

export interface SegmentDurations {
  intro?: number;
  outro?: number;
  scenes: Record<number, number>;
}

/** Beat times of the music clip on a timeline that may grow — so a slide
 * near the end can still snap past the current end of the video. */
export function clipBeats(clip: AudioClip, bufferDuration: number): number[] {
  return beatTimes(clip, 1e4, bufferDuration).map((b) => b.t);
}

/**
 * New (stored) durations that put every slide boundary on the nearest beat,
 * walking left to right so each slide keeps roughly its length. Story
 * slides keep theirs (their length comes from their actions); boundaries
 * with no beat within one beat (before the music starts, after it stops)
 * are left alone. Durations are stored before Motion speed is applied, as
 * the Timeline's own trim does.
 */
export function snapDurationsToBeats(project: Project, beats: number[], beatLength: number): SegmentDurations {
  const speed = project.motionSpeed / 100;
  const out: SegmentDurations = { scenes: {} };
  let cursor = 0;
  for (const seg of getTimeline(project).list) {
    const target = cursor + seg.dur;
    const fixed = seg.type === 'scene' && seg.scene!.kind === 'story';
    let best: number | null = null;
    if (!fixed) {
      for (const b of beats) {
        if (b - cursor < MIN_DUR - 1e-6) continue;
        if (Math.abs(b - target) <= beatLength + 1e-6 && (best === null || Math.abs(b - target) < Math.abs(best - target))) best = b;
      }
    }
    if (best === null) {
      cursor = target;
      continue;
    }
    const stored = Math.round((best - cursor) * speed * 1000) / 1000;
    if (seg.type === 'intro') out.intro = stored;
    else if (seg.type === 'outro') out.outro = stored;
    else out.scenes[seg.scene!.id] = stored;
    cursor += stored / speed;
  }
  return out;
}
