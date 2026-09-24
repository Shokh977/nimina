/**
 * Standing visual-regression fixtures (CLAUDE.md rule 7) — two deliberately
 * minimal projects that a rendering-pipeline change must be checked
 * against: 'dark' (a dark, hand-tuned palette — what every test in this
 * codebase used before this fixture existed) and 'light' (a real,
 * near-white screenshot in a device frame — the case that actually exposed
 * three real bugs in one session: a bloom pass that glowed the whole
 * screen, a selective-bloom fix that let the background bleed through, and
 * OutputPass silently re-applying tone mapping regardless of any
 * material's `toneMapped` flag). Both fixtures share the same palette and
 * device so the *only* variable between them is the screenshot's own
 * content brightness — the narrowest, most direct reproduction of the bug
 * class this check exists to catch, not a general "does the whole app
 * render right" suite.
 *
 * Consumed by /dev/visual-regression (renders + samples in the browser,
 * where the actual WebGL/Canvas2D pipeline lives) and driven by
 * scripts/visual-regression.mjs (the Playwright runner `npm run
 * visual-regression` invokes) — see that script's own doc comment for the
 * full preview+export flow.
 */
import { generateVariations } from './remix';
import { buildSampleScreenshots } from './sampleContent';
import type { ImageAsset, SceneProjectV2 } from './types';

export interface RegressionSample {
  label: string;
  /** Fraction (0-1) of the render's width/height — resolution-independent,
   * so the same fixture can be sampled at preview size and export size. */
  xFrac: number;
  yFrac: number;
  expected: [number, number, number];
  /** Max per-channel deviation to still count as a pass. Preview and
   * export use different tolerances (the runner supplies its own),
   * this is just the fixture's own recommended default. */
  tolerance: number;
}

export interface RegressionFixture {
  id: 'dark' | 'light';
  label: string;
  build(): { project: SceneProjectV2; assets: Record<string, ImageAsset> };
  samples: RegressionSample[];
  /** Seconds into the timeline to render/sample at — after every entrance
   * has settled, before the camera's own push-in move (which would shift
   * framing and invalidate the fixed sample coordinates below). */
  sampleAtT: number;
}

function buildFixtureProject(screenshotId: string, screenshots: ReturnType<typeof buildSampleScreenshots>): SceneProjectV2 {
  const { fitness, shopping } = screenshots;
  const [project] = generateVariations(
    {
      recipeId: 'featureReveal',
      content: { screenshots: [fitness, shopping], texts: ['Regression check', 'OK'], appName: undefined },
      seed: 1,
      paletteId: 'midnight',
      styleId: 'calm',
      locks: {},
    },
    1,
  );
  project.device = { model: 'island', frameColor: 'midnight' };
  project.layers = project.layers.map((l) => (l.id === 'device' && l.content.kind === 'screenshot' ? { ...l, content: { ...l.content, slotId: screenshotId } } : l));
  return project;
}

export function getRegressionFixtures(): RegressionFixture[] {
  const screenshots = buildSampleScreenshots();
  return [
    {
      id: 'dark',
      label: 'Dark, hand-tuned palette (fitness sample, near-black #0B3A33 background)',
      build: () => ({ project: buildFixtureProject(screenshots.fitness.id, screenshots), assets: { [screenshots.fitness.id]: screenshots.fitness.image, [screenshots.shopping.id]: screenshots.shopping.image } }),
      // y=0.75: below the "streak" cards (rgba(255,255,255,0.07) over the
      // page background — a genuinely different, correct color, not a bug;
      // an earlier version of this fixture sampled y=0.656, which lands on
      // one of those cards and was chasing the wrong "expected" value).
      // Empirically verified via /dev/visual-regression's __calibrate hook.
      samples: [{ label: 'screenshot background', xFrac: 0.625, yFrac: 0.75, expected: [11, 58, 51], tolerance: 6 }],
      sampleAtT: 1.5,
    },
    {
      id: 'light',
      label: 'Real near-white screenshot on a light background (shopping sample, #FFF8F2)',
      build: () => ({ project: buildFixtureProject(screenshots.shopping.id, screenshots), assets: { [screenshots.fitness.id]: screenshots.fitness.image, [screenshots.shopping.id]: screenshots.shopping.image } }),
      samples: [{ label: 'screenshot background', xFrac: 0.625, yFrac: 0.656, expected: [255, 248, 242], tolerance: 6 }],
      sampleAtT: 1.5,
    },
  ];
}
