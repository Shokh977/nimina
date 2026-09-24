/**
 * Standing visual-regression fixtures (CLAUDE.md rule 7) — classic engine
 * (src/engine/) equivalent of what was previously Engine v2's WebGL-pipeline
 * harness (bloom/tone-mapping/occlusion checks that only made sense for a
 * Three.js compositor, which classic doesn't have — it's a plain 2D canvas
 * renderer). Repointed at what's actually worth automatically guarding for
 * this engine: (1) rendering drift in the ported-from-the-prototype 2D
 * drawing code, and (2) color drift introduced by the video export pipeline
 * (WebCodecs H.264 encode/decode is a real, common source of subtle
 * limited-range/full-range or BT.601/BT.709 color-matrix bugs that would
 * otherwise only be caught by eyeballing a downloaded file).
 *
 * Two fixtures, deliberately different code paths: the classic multi-slide
 * demo (image slides + a text slide, gradient gemoetric background) and the
 * 9:16-only story-format demo (device chrome, map/notification/loading
 * story actions, its own overlay code). Both reuse the existing dev sample
 * builders (src/dev/sampleProject.ts, src/dev/storyDemo.ts) rather than
 * building new content, so what's checked is exactly what a human eyeballs
 * on /dev/engine.
 */
import { FORMATS } from '@/engine/constants';
import type { AssetMap, Project } from '@/engine/types';
import { buildDemoProject } from './sampleProject';
import { buildStoryDemoProject } from './storyDemo';

export interface RegressionSample {
  label: string;
  xFrac: number;
  yFrac: number;
  expected: [number, number, number];
  tolerance: number;
}

export interface RegressionFixture {
  id: string;
  label: string;
  build(): { project: Project; assets: AssetMap };
  /** Seconds into the timeline to sample — chosen so the sampled regions
   * are past any enter animation and settled. */
  sampleAtT: number;
  samples: RegressionSample[];
}

export function getRegressionFixtures(): RegressionFixture[] {
  return [
    {
      id: 'classic-demo',
      label: 'Habit-tracker demo (image slides + text slide, Cobalt preset gradient)',
      build: buildDemoProject,
      sampleAtT: 1.0,
      samples: [
        // Top-left corner of frame — clear of the phone device frame and
        // any card/text, so it's just drawBg's gradient + pattern for the
        // Cobalt preset (PRESETS[0]: a:#3347FF, b:#0C1662). Values here
        // calibrated by sampling the real render at /dev/engine (t=1.0),
        // not hand-computed — the gradient/pattern interaction isn't a
        // simple linear blend to predict analytically.
        { label: 'background gradient (top-left corner)', xFrac: 0.02, yFrac: 0.02, expected: [70, 84, 232], tolerance: 8 },
        { label: 'background gradient (bottom-center)', xFrac: 0.5, yFrac: 0.98, expected: [36, 50, 170], tolerance: 8 },
      ],
    },
    {
      id: 'story-demo',
      label: 'Story-format demo (device chrome, story actions, own overlay code)',
      build: buildStoryDemoProject,
      sampleAtT: 1.0,
      samples: [
        // Same background preset as the classic-demo fixture (shared
        // top-left corner value) plus one point unique to the story
        // format's own device-chrome/status-bar drawing, which the classic
        // fixture never exercises.
        { label: 'background gradient (top-left corner)', xFrac: 0.02, yFrac: 0.02, expected: [70, 84, 232], tolerance: 8 },
        { label: 'device chrome (status bar area)', xFrac: 0.5, yFrac: 0.1, expected: [5, 5, 7], tolerance: 8 },
      ],
    },
  ];
}

/** Shared preview-canvas sizing so the dev page and the calibration/sampling
 * logic agree on what a given xFrac/yFrac lands on. */
export function previewCanvasSize(project: Project, scale: number): { width: number; height: number } {
  const fmt = FORMATS[project.format];
  return { width: Math.round(fmt.w * scale), height: Math.round(fmt.h * scale) };
}
