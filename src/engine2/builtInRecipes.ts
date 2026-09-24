/**
 * The six scene recipes from Prompt 6. Each is a *structure* — a fixed
 * sequence of beats — filled from real content and varied by seed (layout
 * choice, camera direction, secondary decoration, timing offsets) and by
 * the chosen MotionStyle's parameters (styles.ts: spring feel, decoration
 * density, type scale, camera speed, rotation lean, hard cuts). Two apps'
 * screenshots through the same recipe differ both because the pixels
 * differ and because the seed/style choices differ.
 */
import { buildCameraTrack, STAGE_W } from './camera';
import { registerRecipe, screenLayer, cutoutLayer, track, headline, burst, ctaHoldStart } from './recipeKit';
import { registerRecipeV2, type SceneRecipe, type RecipeContext, type RecipeScreenshot } from './recipes';
import { rng } from './rng';
import { STYLES } from './styles';
import { roundRectPath } from './texture';
import type { LayerDef, ParticleBurstDef } from './types';

function pad(shots: RecipeScreenshot[], n: number): RecipeScreenshot[] {
  if (!shots.length) return [];
  const out: RecipeScreenshot[] = [];
  for (let i = 0; i < n; i++) out.push(shots[i % shots.length]);
  return out;
}

function pickCutout(shot: RecipeScreenshot, r: () => number): [number, number, number, number] {
  if (shot.cutouts?.length) {
    const c = shot.cutouts[Math.floor(r() * shot.cutouts.length)].rect;
    return c;
  }
  // No authored cutout — a reasonable default region (upper-middle third).
  return [0.14, 0.22 + r() * 0.15, 0.72, 0.16];
}

function textOr(texts: string[], i: number, fallback: string): string {
  return texts[i]?.trim() || fallback;
}

registerRecipe('recipeStatCard', (ctx, w, h, props) => {
  const { big, small } = props as unknown as { big: string; small: string };
  roundRectPath(ctx, 0, 0, w, h, 24);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.fillStyle = '#15161B';
  ctx.font = '800 44px "Bricolage Grotesque", Figtree, sans-serif';
  ctx.fillText(big, 22, h * 0.58);
  ctx.fillStyle = '#6B6F7D';
  ctx.font = '500 19px Figtree, sans-serif';
  ctx.fillText(small, 22, h * 0.58 + 30);
});

registerRecipe('recipeCountdown', (ctx, w, h, props) => {
  const { n } = props as unknown as { n: number };
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 120px "Bricolage Grotesque", Figtree, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(n), w / 2, h / 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
});

/** Feature reveal: hook -> device -> hero cutout -> benefit line -> CTA. */
const featureReveal: SceneRecipe = {
  id: 'featureReveal',
  label: 'Feature reveal',
  description: 'Hook text, then the device, a hero cutout of the feature, a benefit line, and a CTA.',
  minScreenshots: 1,
  build(ctx) {
    const r = rng(ctx.seed * 7919 + 11);
    const style = STYLES[ctx.styleId];
    const sign: 1 | -1 = r() < 0.5 ? 1 : -1;
    const shots = pad(ctx.content.screenshots, 1);
    const shot = shots[0];
    const rect = pickCutout(shot, r);
    const duration = 8.4;
    const layers: LayerDef[] = [
      screenLayer('device', 'Device', shot.id, { x: track(sign * 60, [{ at: 0.25, to: 0, spring: 'snappy' }]), rz: track(style.leansIntoRotation ? sign * 2 : 0) }),
      cutoutLayer('hero', 'Hero cutout', shot.id, rect, rect[2] * 700, rect[3] * 700, 26, {
        x: track(0, [{ at: 2.4, to: sign * 40, spring: 'wobbly', scaleBy: 'R' }]),
        y: track(-60, [{ at: 2.4, to: -100, spring: 'wobbly' }]),
        z: track(0, [{ at: 2.4, to: 260, spring: 'wobbly' }, { at: 6.2, to: 90, spring: 'gentle' }]),
        scale: track(0.001, [{ at: 2.4, to: 1.12, spring: 'bouncy' }]),
        opacity: track(0, [{ at: 2.4, to: 1, spring: 'snappy' }, { at: ctaHoldStart(duration) + 0.2, to: 0, spring: 'crisp' }]),
      }),
    ];
    const particles: ParticleBurstDef[] = style.decorationDensity > 0.4 ? [burst('spark', 2.6, 'hero', 'confetti', 5 + ctx.seed, style.decorationDensity)] : [];
    return {
      templateId: 'featureReveal',
      styleId: ctx.styleId,
      paletteId: ctx.paletteId,
      seed: ctx.seed,
      texts: [textOr(ctx.content.texts, 0, `Meet *${ctx.content.appName || 'the app'}*`), textOr(ctx.content.texts, 1, 'Built for how you actually work'), textOr(ctx.content.texts, 2, 'Try it free')],
      duration,
      ctaAt: ctaHoldStart(duration),
      beats: [headline(0.2, 2.1, 't1'), headline(4.4, ctaHoldStart(duration) - 0.2, 't2')],
      layers,
      particles,
      camera: buildCameraTrack({
        zoom: track(1, [{ at: 2.3, to: 1.18, spring: 'gentle' }, { at: 6.2, to: 1, spring: 'soft' }]),
        y: track(0, [{ at: 2.3, to: -60, spring: 'gentle' }, { at: 6.2, to: 0, spring: 'soft' }]),
        ry: track(0, [{ at: 3, to: sign * 3 * style.cameraSpeed, spring: 'soft' }, { at: 5.6, to: 0, spring: 'soft' }]),
      }),
      sign,
      align: r() < 0.5 ? 'center' : 'left',
    };
  },
};

/** Before/after: two screenshots (or two cutouts of one), cross-panned. */
const beforeAfter: SceneRecipe = {
  id: 'beforeAfter',
  label: 'Before / after',
  description: 'Two screenshots, panned from one to the other.',
  minScreenshots: 1,
  build(ctx) {
    const r = rng(ctx.seed * 4271 + 3);
    const style = STYLES[ctx.styleId];
    const shots = pad(ctx.content.screenshots, 2);
    const duration = 7.6;
    const layers: LayerDef[] = [
      screenLayer('before', 'Before', shots[0].id, {
        x: track(-STAGE_W * 0.42, []),
        opacity: track(0, [{ at: 0.15, to: 1, spring: 'snappy' }, { at: 3.6, to: 0.35, spring: 'gentle' }]),
      }),
      screenLayer('after', 'After', shots[1].id, {
        x: track(STAGE_W * 0.42, []),
        opacity: track(0, [{ at: 3.3, to: 1, spring: 'snappy' }]),
      }),
    ];
    return {
      templateId: 'beforeAfter',
      styleId: ctx.styleId,
      paletteId: ctx.paletteId,
      seed: ctx.seed,
      texts: [textOr(ctx.content.texts, 0, 'Before'), textOr(ctx.content.texts, 1, '*After*'), textOr(ctx.content.texts, 2, 'See the difference')],
      duration,
      ctaAt: ctaHoldStart(duration),
      beats: [headline(0.15, 3.1, 't1'), headline(3.3, ctaHoldStart(duration) - 0.2, 't2')],
      layers,
      particles: [],
      camera: buildCameraTrack({
        // Sleek/Bold's faster cameraSpeed makes the before->after pan
        // arrive sooner; Calm lingers longer on "before" first.
        x: track(-STAGE_W * 0.16, [{ at: 3.2 / style.cameraSpeed, to: STAGE_W * 0.16, spring: 'gentle' }, { at: 6.2, to: 0, spring: 'soft' }]),
        zoom: track(1.08, [{ at: 6.2, to: 1, spring: 'soft' }]),
      }),
      sign: r() < 0.5 ? 1 : -1,
      align: 'center',
    };
  },
};

/** Step-by-step flow: N screenshots shown in sequence. */
const stepByStep: SceneRecipe = {
  id: 'stepByStep',
  label: 'Step-by-step flow',
  description: 'Walks through several screenshots in sequence, one at a time.',
  minScreenshots: 1,
  build(ctx) {
    const r = rng(ctx.seed * 2609 + 9);
    const style = STYLES[ctx.styleId];
    const n = Math.min(4, Math.max(2, ctx.content.screenshots.length || 2));
    const shots = pad(ctx.content.screenshots, n);
    const stepDur = 1.7 / style.speed;
    const duration = 1 + n * stepDur + 1.6;
    const layers: LayerDef[] = shots.map((s, i) => {
      const at = 0.3 + i * stepDur;
      return screenLayer(`step${i}`, `Step ${i + 1}`, s.id, {
        scale: track(0.001, [{ at, to: 1, spring: 'bouncy' }]),
        opacity: track(0, [{ at, to: 1, spring: 'snappy' }, { at: at + stepDur - 0.15, to: 0, spring: 'crisp' }]),
        rz: track(style.leansIntoRotation ? (r() - 0.5) * 6 : 0),
      });
    });
    return {
      templateId: 'stepByStep',
      styleId: ctx.styleId,
      paletteId: ctx.paletteId,
      seed: ctx.seed,
      texts: [textOr(ctx.content.texts, 0, 'Three steps to *done*'), '', textOr(ctx.content.texts, 2, 'Get started')],
      duration,
      ctaAt: ctaHoldStart(duration),
      beats: [headline(0.1, 0.3 + stepDur, 't1')],
      layers,
      particles: [],
      camera: buildCameraTrack({ zoom: track(1, [{ at: duration - 1.4, to: 1.05, spring: 'soft' }]) }),
      sign: 1,
      align: 'center',
    };
  },
};

/** Stats showcase: device + floating stat cards. */
const statsShowcase: SceneRecipe = {
  id: 'statsShowcase',
  label: 'Stats showcase',
  description: 'The device with floating stat cards popping in around it.',
  minScreenshots: 1,
  build(ctx) {
    const r = rng(ctx.seed * 5417 + 21);
    const style = STYLES[ctx.styleId];
    const shot = pad(ctx.content.screenshots, 1)[0];
    const duration = 8;
    const statCount = 3;
    const layers: LayerDef[] = [screenLayer('device', 'Device', shot.id, { y: track(60, []) })];
    const statTexts = [
      ['+24%', 'this week'],
      ['12', 'day streak'],
      ['4.9★', 'rating'],
    ];
    for (let i = 0; i < statCount; i++) {
      const at = 1.4 + i * 0.18;
      const side: 1 | -1 = i % 2 === 0 ? 1 : -1;
      layers.push({
        id: `stat${i}`,
        label: `Stat ${i + 1}`,
        plane: 'popout',
        content: { kind: 'ui-element', recipe: 'recipeStatCard', props: { big: statTexts[i][0], small: statTexts[i][1] } },
        width: 220,
        height: 130,
        overrides: {},
        transform: {
          x: track(side * (260 + r() * 60), []),
          y: track(-260 + i * 240 + r() * 40, []),
          z: track(0, [{ at, to: 140 + r() * 80, spring: 'wobbly' }]),
          scale: track(0.6, [{ at, to: 1, spring: 'wobbly', scaleBy: 'stag' }]),
          rz: track(side * 4 * (style.leansIntoRotation ? 1 : 0.3)),
          opacity: track(0, [{ at, to: 1, spring: 'snappy', scaleBy: 'stag' }, { at: ctaHoldStart(duration), to: 0, spring: 'crisp' }]),
        },
      });
    }
    return {
      templateId: 'statsShowcase',
      styleId: ctx.styleId,
      paletteId: ctx.paletteId,
      seed: ctx.seed,
      texts: [textOr(ctx.content.texts, 0, 'The *numbers* speak'), '', textOr(ctx.content.texts, 2, 'See your stats')],
      duration,
      ctaAt: ctaHoldStart(duration),
      beats: [headline(0.15, 1.3, 't1')],
      layers,
      particles: [],
      camera: buildCameraTrack({ zoom: track(1, [{ at: 1.4, to: 1.1, spring: 'gentle' }, { at: 6, to: 1, spring: 'soft' }]) }),
      sign: 1,
      align: 'center',
    };
  },
};

/** Chat demo: cutout "bubbles" lift out of a chat screenshot in sequence. */
const chatDemo: SceneRecipe = {
  id: 'chatDemo',
  label: 'Chat demo',
  description: 'Cutout pieces of a chat/message screenshot lift out one by one.',
  minScreenshots: 1,
  build(ctx) {
    const r = rng(ctx.seed * 3301 + 17);
    const style = STYLES[ctx.styleId];
    const shot = pad(ctx.content.screenshots, 1)[0];
    const duration = 7.4;
    const rects: [number, number, number, number][] = shot.cutouts?.length ? shot.cutouts.slice(0, 3).map((c) => c.rect) : [[0.06, 0.2, 0.6, 0.1], [0.32, 0.34, 0.56, 0.1], [0.06, 0.48, 0.5, 0.1]];
    const layers: LayerDef[] = [screenLayer('device', 'Device', shot.id, { rz: track(2) })];
    rects.forEach((rect, i) => {
      const at = 1.2 + i * 0.35;
      layers.push(cutoutLayer(`bubble${i}`, `Bubble ${i + 1}`, shot.id, rect, rect[2] * 700, rect[3] * 700, 24, {
        x: track(0, [{ at, to: (r() - 0.5) * 120, spring: 'bouncy', scaleBy: 'R' }]),
        z: track(0, [{ at, to: 180 + r() * 90, spring: 'bouncy' }]),
        scale: track(0.001, [{ at, to: 1, spring: 'bouncy' }]),
        opacity: track(0, [{ at, to: 1, spring: 'snappy' }]),
      }));
    });
    return {
      templateId: 'chatDemo',
      styleId: ctx.styleId,
      paletteId: ctx.paletteId,
      seed: ctx.seed,
      texts: [textOr(ctx.content.texts, 0, '*Reactions* are here'), '', textOr(ctx.content.texts, 2, 'Update now')],
      duration,
      ctaAt: ctaHoldStart(duration),
      beats: [headline(0.35, 4.6, 't1')],
      layers,
      particles: style.decorationDensity > 0.3 ? [burst('hearts', 2.0, `bubble${Math.min(1, rects.length - 1)}`, 'hearts', 11 + ctx.seed, style.decorationDensity)] : [],
      camera: buildCameraTrack({ zoom: track(1, [{ at: 1.2, to: 1.16, spring: 'gentle' }, { at: 5.2, to: 1, spring: 'soft' }]) }),
      sign: 1,
      align: 'center',
    };
  },
};

/** Announcement countdown: a number counts down, then "live now" + CTA. */
const announcementCountdown: SceneRecipe = {
  id: 'announcementCountdown',
  label: 'Announcement countdown',
  description: 'A countdown number, then the device and a CTA.',
  minScreenshots: 1,
  build(ctx) {
    const r = rng(ctx.seed * 6203 + 5);
    const style = STYLES[ctx.styleId];
    const shot = pad(ctx.content.screenshots, 1)[0];
    const duration = 7.2;
    const steps = [3, 2, 1];
    const numberLayers: LayerDef[] = steps.map((n, i) => {
      const at = 0.2 + i * 0.7;
      return {
        id: `num${n}`,
        label: `Count ${n}`,
        plane: 'popout',
        content: { kind: 'ui-element', recipe: 'recipeCountdown', props: { n } },
        width: 300,
        height: 300,
        overrides: {},
        transform: {
          scale: track(0.001, [{ at, to: 1, spring: 'bouncy' }]),
          opacity: track(0, [{ at, to: 1, spring: 'snappy' }, { at: at + 0.6, to: 0, spring: 'crisp' }]),
        },
      };
    });
    const deviceAt = 0.2 + steps.length * 0.7;
    return {
      templateId: 'announcementCountdown',
      styleId: ctx.styleId,
      paletteId: ctx.paletteId,
      seed: ctx.seed,
      texts: [textOr(ctx.content.texts, 0, `*${ctx.content.appName || 'It'}* is live`), '', textOr(ctx.content.texts, 2, 'Get it now')],
      duration,
      ctaAt: ctaHoldStart(duration),
      beats: [headline(deviceAt + 0.1, ctaHoldStart(duration) - 0.2, 't1')],
      layers: [...numberLayers, screenLayer('device', 'Device', shot.id, { scale: track(0.001, [{ at: deviceAt, to: 1, spring: 'bouncy' }]), rz: track(style.leansIntoRotation ? (r() - 0.5) * 4 : 0) })],
      particles: style.decorationDensity > 0.4 ? [burst('confetti', deviceAt + 0.1, 'device', 'confetti', 31 + ctx.seed, style.decorationDensity)] : [],
      camera: buildCameraTrack({ zoom: track(1, [{ at: deviceAt, to: 1.1, spring: 'gentle' }, { at: deviceAt + 3, to: 1, spring: 'soft' }]) }),
      sign: 1,
      align: 'center',
    };
  },
};

[featureReveal, beforeAfter, stepByStep, statsShowcase, chatDemo, announcementCountdown].forEach(registerRecipeV2);

export type { RecipeContext };
