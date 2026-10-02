'use client';

import EditorShell from '@/components/editor/EditorShell';
import { createDefaultProject } from '@/engine/project';
import { createImageSlide, createTextSlide } from '@/engine/slides';
import type { Project } from '@/engine/types';

/** English-only project with no asset references (so hydration makes no
 * Storage requests), never edited (so autosave never fires). */
const PROJECT: Project = {
  ...createDefaultProject(),
  appName: 'Habit',
  intro: { on: true, dur: 2.5, tagline: 'Build better *habits*', style: {} },
  outro: { on: true, dur: 3, cta: 'Start your *streak* today', button: 'Download free', small: 'Free on iOS and Android', style: {} },
  scenes: [
    createImageSlide(1, null, { headline: 'Track every *habit*', sub: 'One tap a day.' }),
    createImageSlide(2, null, { headline: 'See your *progress*', badge: 'NEW' }),
    createTextSlide(3, { headline: 'Stay *consistent*' }),
  ],
};

/**
 * Page-weight harness: the real EditorShell (the same component tree
 * /editor/[id] renders) without the auth/DB lookup in front of it, so the
 * editor's transfer size can be measured on a production build without a
 * signed-in session.
 */
export default function EditorWeightHarness() {
  return <EditorShell userEmail="weight@harness.local" projectId="weight-harness" projectName="Weight harness" initialProject={PROJECT} plan="pro" />;
}
