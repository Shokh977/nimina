import { getTimeline } from '@/engine/render';
import type { IntroConfig, OutroConfig, Project } from '@/engine/types';

export function sceneStart(project: Project, id: number): number {
  const g = getTimeline(project).list.find((s) => s.type === 'scene' && s.scene?.id === id);
  return g ? g.start : 0;
}

export function segStartOf(project: Project, owner: IntroConfig | OutroConfig): number {
  const g = getTimeline(project).list.find((s) => s.owner === owner);
  return g ? g.start : 0;
}
