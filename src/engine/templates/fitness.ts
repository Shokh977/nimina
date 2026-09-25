/**
 * Fitness & workout tracking — docs/TEMPLATE_PACK.md §"1. Fitness &
 * workout tracking". Mint palette, Android (punch) device, Bold motion.
 * Slots: today (tall), workout-detail, progress-chart, streak-success.
 */
import { PRESETS } from '../constants';
import { createImageSlide, createTextSlide } from '../slides';
import type { Action, AssetMap, Project, Sprite, StorySlide } from '../types';
import { rr } from '../utils';
import type { TemplateBuildOptions, TemplateDef, TemplateSlot } from './types';

const INK = '#12241C',
  GREY = '#6E7B76',
  ACCENT = '#16A34A',
  ACCENT_LIGHT = '#DCFCE7';

function f(w: number, s: number) {
  return `${w} ${s}px Figtree, system-ui, sans-serif`;
}

function statusBar(ctx: CanvasRenderingContext2D, dark = false) {
  ctx.fillStyle = dark ? '#fff' : INK;
  ctx.font = f(700, 24);
  ctx.textBaseline = 'middle';
  ctx.fillText('9:41', 48, 52);
  rr(ctx, 500, 42, 44, 21, 6);
  ctx.fill();
  [0, 1, 2, 3].forEach((i) => {
    rr(ctx, 424 + i * 11, 58 - (i + 1) * 5, 7, (i + 1) * 5, 2);
    ctx.fill();
  });
  ctx.textBaseline = 'alphabetic';
}

function card(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.save();
  ctx.shadowColor = 'rgba(20,40,30,.08)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = '#fff';
  rr(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.restore();
}

/** Home screen — today's workout plan, a "Start workout" CTA at the
 * bottom (matches the story slide's tap target). */
export function makeTodayScreen(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 600;
  cv.height = 1300;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#F5FBF7';
  ctx.fillRect(0, 0, 600, 1300);
  statusBar(ctx);
  ctx.fillStyle = INK;
  ctx.font = f(800, 56);
  ctx.fillText('Today', 40, 168);
  ctx.fillStyle = GREY;
  ctx.font = f(500, 24);
  ctx.fillText('Push day · Upper body', 42, 206);

  card(ctx, 40, 246, 520, 150, 30);
  ctx.fillStyle = ACCENT_LIGHT;
  ctx.beginPath();
  ctx.arc(490, 246 + 75, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ACCENT;
  ctx.font = f(800, 30);
  ctx.textAlign = 'center';
  ctx.fillText('4', 490, 246 + 84);
  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  ctx.font = f(800, 34);
  ctx.fillText('4 exercises', 72, 246 + 60);
  ctx.fillStyle = GREY;
  ctx.font = f(500, 22);
  ctx.fillText('~38 minutes', 72, 246 + 96);

  const exercises: Array<[string, string, boolean]> = [
    ['Bench press', '4 sets × 8 reps', false],
    ['Incline dumbbell press', '3 sets × 10 reps', false],
    ['Cable fly', '3 sets × 12 reps', false],
    ['Tricep pushdown', '3 sets × 15 reps', false],
  ];
  exercises.forEach(([name, sub], i) => {
    const y = 432 + i * 128;
    card(ctx, 40, y, 520, 108, 26);
    ctx.strokeStyle = '#D7E8DE';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(96, y + 54, 24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.font = f(700, 27);
    ctx.fillText(name, 142, y + 48);
    ctx.fillStyle = GREY;
    ctx.font = f(500, 20);
    ctx.fillText(sub, 142, y + 78);
  });

  card(ctx, 40, 960, 520, 106, 53);
  ctx.fillStyle = ACCENT;
  rr(ctx, 40, 960, 520, 106, 53);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = f(800, 30);
  ctx.textAlign = 'center';
  ctx.fillText('Start workout', 300, 960 + 66);
  ctx.textAlign = 'left';
  return cv;
}

/** Mid-workout screen — a set actively being logged, matches the story's
 * `showScreen workout-detail` beat and the standalone close-up slide. */
export function makeWorkoutDetailScreen(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 600;
  cv.height = 1300;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#F5FBF7';
  ctx.fillRect(0, 0, 600, 1300);
  statusBar(ctx);
  ctx.fillStyle = GREY;
  ctx.font = f(600, 22);
  ctx.fillText('← Push day', 42, 130);
  ctx.fillStyle = INK;
  ctx.font = f(800, 44);
  ctx.fillText('Bench press', 40, 190);
  ctx.fillStyle = ACCENT;
  ctx.font = f(700, 24);
  ctx.fillText('Set 2 of 4', 42, 226);

  card(ctx, 40, 270, 520, 260, 32);
  ctx.fillStyle = GREY;
  ctx.font = f(600, 22);
  ctx.textAlign = 'center';
  ctx.fillText('WEIGHT', 190, 330);
  ctx.fillText('REPS', 410, 330);
  ctx.fillStyle = INK;
  ctx.font = f(800, 64);
  ctx.fillText('185', 190, 410);
  ctx.fillText('8', 410, 410);
  ctx.fillStyle = GREY;
  ctx.font = f(500, 22);
  ctx.fillText('lb', 190, 440);
  ctx.fillText('reps', 410, 440);
  ctx.strokeStyle = '#E4EFE8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(300, 300);
  ctx.lineTo(300, 490);
  ctx.stroke();
  ctx.textAlign = 'left';

  ['Set 1', 'Set 2', 'Set 3', 'Set 4'].forEach((label, i) => {
    const y = 570 + i * 92;
    const done = i < 1;
    card(ctx, 40, y, 520, 74, 22);
    ctx.fillStyle = done ? ACCENT : '#D7E8DE';
    ctx.beginPath();
    ctx.arc(90, y + 37, 20, 0, Math.PI * 2);
    ctx.fill();
    if (done) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(81, y + 38);
      ctx.lineTo(87, y + 45);
      ctx.lineTo(100, y + 29);
      ctx.stroke();
    }
    ctx.fillStyle = i === 1 ? INK : GREY;
    ctx.font = f(i === 1 ? 700 : 500, 24);
    ctx.fillText(label, 130, y + 45);
    ctx.fillStyle = GREY;
    ctx.font = f(500, 20);
    ctx.textAlign = 'right';
    ctx.fillText(done ? '185 lb × 8' : '—', 520, y + 43);
    ctx.textAlign = 'left';
  });

  ctx.fillStyle = ACCENT;
  rr(ctx, 40, 1140, 520, 100, 50);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = f(800, 28);
  ctx.textAlign = 'center';
  ctx.fillText('Log set', 300, 1140 + 63);
  ctx.textAlign = 'left';
  return cv;
}

/** Strength-over-time chart. */
export function makeProgressChartScreen(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 600;
  cv.height = 1300;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#F5FBF7';
  ctx.fillRect(0, 0, 600, 1300);
  statusBar(ctx);
  ctx.fillStyle = INK;
  ctx.font = f(800, 52);
  ctx.fillText('Progress', 40, 168);
  ctx.fillStyle = GREY;
  ctx.font = f(500, 24);
  ctx.fillText('Bench press · 12 weeks', 42, 206);

  card(ctx, 40, 246, 520, 420, 32);
  ctx.fillStyle = INK;
  ctx.font = f(800, 60);
  ctx.fillText('+42 lb', 76, 340);
  ctx.fillStyle = ACCENT;
  ctx.font = f(700, 24);
  ctx.fillText('▲ since week 1', 78, 374);

  const pts = [140, 145, 150, 152, 158, 162, 165, 170, 172, 178, 180, 182];
  const gx = 76,
    gy = 610,
    gw = 448,
    gh = 190;
  const max = 190,
    min = 130;
  ctx.beginPath();
  pts.forEach((v, i) => {
    const x = gx + (gw / (pts.length - 1)) * i;
    const y = gy - ((v - min) / (max - min)) * gh;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
  const last = pts[pts.length - 1];
  const lx = gx + gw,
    ly = gy - ((last - min) / (max - min)) * gh;
  ctx.fillStyle = ACCENT;
  ctx.beginPath();
  ctx.arc(lx, ly, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 4;
  ctx.stroke();

  const stats: Array<[number, string, string]> = [
    [40, '32', 'workouts'],
    [310, '96%', 'consistency'],
  ];
  stats.forEach(([x, n, l]) => {
    card(ctx, x, 700, 250, 150, 26);
    ctx.fillStyle = INK;
    ctx.font = f(800, 48);
    ctx.fillText(n, x + 28, 700 + 70);
    ctx.fillStyle = GREY;
    ctx.font = f(500, 20);
    ctx.fillText(l, x + 30, 700 + 108);
  });
  return cv;
}

/** Celebration screen — a completed streak milestone. */
export function makeStreakSuccessScreen(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 600;
  cv.height = 1300;
  const ctx = cv.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 600, 1300);
  g.addColorStop(0, '#16A34A');
  g.addColorStop(1, '#0B3A22');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 600, 1300);
  statusBar(ctx, true);

  ctx.fillStyle = 'rgba(255,255,255,.14)';
  ctx.beginPath();
  ctx.arc(300, 480, 190, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(300, 480, 145, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ACCENT;
  ctx.font = f(800, 130);
  ctx.textAlign = 'center';
  ctx.fillText('30', 300, 528);
  ctx.fillStyle = '#fff';
  ctx.font = f(800, 44);
  ctx.fillText('day streak!', 300, 750);
  ctx.globalAlpha = 0.85;
  ctx.font = f(500, 26);
  ctx.fillText('Consistency beats intensity.', 300, 800);
  ctx.fillText("You've shown up every day.", 300, 836);
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#fff';
  rr(ctx, 60, 1050, 480, 100, 50);
  ctx.fill();
  ctx.fillStyle = ACCENT;
  ctx.font = f(800, 30);
  ctx.fillText('Share your streak', 300, 1112);
  ctx.textAlign = 'left';
  return cv;
}

export interface FitnessStrings {
  introTagline: string;
  detailHeadline: string;
  detailCallout: string;
  chartHeadline: string;
  statementHeadline: string;
  streakHeadline: string;
  streakBadge: string;
  outroCta: string;
  outroSmall: string;
}

export const DEFAULT_FITNESS_STRINGS: FitnessStrings = {
  introTagline: 'Train like you *mean it*',
  detailHeadline: 'Every set, *counted*',
  detailCallout: 'Log a set in one tap',
  chartHeadline: 'Watch yourself get *stronger*',
  statementHeadline: 'No guesswork. *Just progress.*',
  streakHeadline: 'Every day, *logged*',
  streakBadge: '30-day streak',
  outroCta: 'Start your *first workout*',
  outroSmall: 'On iPhone and Android',
};

function buildStoryActions(): Action[] {
  return [
    { id: 'a1', type: 'launchApp', duration: 1.0, startMode: 'after-previous', easing: 'easeOutCubic', sfx: '', wallpaper: { kind: 'gradient', from: '#123322', to: '#0A1D14' }, iconPosition: { x: 0.5, y: 0.42 } },
    { id: 'a2', type: 'loading', duration: 0.6, startMode: 'after-previous', easing: 'easeOutBack', sfx: '', style: 'skeleton' },
    { id: 'a3', type: 'showScreen', duration: 0.5, startMode: 'after-previous', easing: 'easeInOutCubic', sfx: '', screenId: 'today', transition: 'fade' },
    { id: 'a4', type: 'scroll', duration: 0.9, startMode: 'after-previous', easing: 'easeInOutCubic', sfx: '', from: 0, to: 0.3 },
    { id: 'a5', type: 'tap', duration: 0.7, startMode: 'after-previous', easing: 'easeOutCubic', sfx: '', x: 0.5, y: 0.798, press: 'both' },
    { id: 'a6', type: 'showScreen', duration: 0.5, startMode: 'after-previous', easing: 'easeInOutCubic', sfx: '', screenId: 'workout-detail', transition: 'push' },
  ];
}

/**
 * `short` isn't "drop the one slide marked optional" here — doing only
 * that still totals ~23s (measured), because a story slide's own action
 * durations add up fast regardless of which slides around it are cut.
 * Hitting the spec's actual 8-10s target meant keeping just the intro,
 * one hero beat (the streak payoff — confetti, badge, the emotional peak),
 * and the outro, and dropping the story/detail/chart slides entirely
 * rather than only the marked-optional text slide. Reported, not silent —
 * see the Batch 1 write-up for the exact before/after numbers.
 */
function buildScenes(strings: FitnessStrings, variant: 'full' | 'short'): { scenes: Project['scenes']; slots: TemplateSlot[] } {
  let id = 1;
  const scenes: Project['scenes'] = [];
  const slots: TemplateSlot[] = [];

  const storySlide: StorySlide = {
    kind: 'story',
    id: id++,
    style: {},
    screens: [
      { id: 'today', assetId: 'today' },
      { id: 'workout-detail', assetId: 'workout-detail' },
    ],
    actions: buildStoryActions(),
    sprites: [] as Sprite[],
    cameraMode: 'auto',
    cameraKeys: [
      { actionId: 'a5', target: { x: 0.5, y: 0.798 }, zoom: 1.18 },
      { actionId: 'a6', target: { x: 0.5, y: 0.5 }, zoom: 1 },
    ],
  };
  slots.push({ key: 'today', label: 'Today (tall)', hint: "Today's workout list — the scroll/tap beat needs real overflow", targets: [{ sceneId: storySlide.id, screenId: 'today' }] });

  const detailSlide = createImageSlide(id++, 'workout-detail', {
    headline: strings.detailHeadline,
    anim: 'rise',
    gesture: 'swipeUp',
    callout: strings.detailCallout,
    focus: { x: 0.5, y: 0.44 },
    dur: 3.2,
  });
  slots.push({
    key: 'workout-detail',
    label: 'Workout detail',
    hint: 'An active set being logged — also appears mid-story',
    targets: [
      { sceneId: storySlide.id, screenId: 'workout-detail' },
      { sceneId: detailSlide.id },
    ],
  });

  const chartSlide = createImageSlide(id++, 'progress-chart', { headline: strings.chartHeadline, anim: 'spotlight', dur: 3.5, focus: { x: 0.5, y: 0.46 }, camera: 'push' });
  slots.push({ key: 'progress-chart', label: 'Progress chart', hint: 'Strength trending up over weeks', targets: [{ sceneId: chartSlide.id }] });

  const streakSlide = createImageSlide(id++, 'streak-success', {
    headline: strings.streakHeadline,
    anim: 'pop',
    dur: 3.5,
    effect: 'confetti',
    badge: strings.streakBadge,
    camera: 'shake',
  });
  slots.push({ key: 'streak-success', label: 'Streak success', hint: 'The 30-day-streak celebration screen', targets: [{ sceneId: streakSlide.id }] });

  if (variant === 'short') {
    scenes.push(streakSlide);
    return { scenes, slots };
  }

  scenes.push(storySlide, detailSlide, chartSlide, createTextSlide(id++, { headline: strings.statementHeadline, dur: 2.2, style: { theme: '3', textAnim: 'letters', transition: 'flash' } }), streakSlide);
  return { scenes, slots };
}

export const FITNESS_TEMPLATE: TemplateDef = {
  id: 'fitness',
  name: 'Fitness & workout tracking',
  description: 'Bold, driving energy — a workout logged in real time, progress that trends up, and a streak worth celebrating.',
  category: 'Fitness',
  swatch: [PRESETS[2].a, PRESETS[2].b],
  durationSeconds: 21.3,
  previewVideo9x16: '/template-previews/fitness/preview-9x16.mp4',
  previewVideo16x9: '/template-previews/fitness/preview-16x9.mp4',
  build: (opts: TemplateBuildOptions = {}) => {
    const variant = opts.variant ?? 'full';
    const strings: FitnessStrings = { ...DEFAULT_FITNESS_STRINGS, ...(opts.strings as Partial<FitnessStrings> | undefined) };
    const { scenes, slots } = buildScenes(strings, variant);
    const project: Project = {
      format: '9:16',
      preset: 2,
      colors: { ...PRESETS[2] },
      font: 0,
      model: 'punch',
      fcolor: 'graphite',
      bgPattern: 'glow',
      shapes: true,
      grain: false,
      vignette: false,
      storyBars: false,
      hlStyle: 'marker',
      textPos: 'top',
      textAnim: 'rise',
      transition: 'wipe',
      appName: 'Surge',
      intro: { on: true, dur: 2.2, tagline: strings.introTagline, style: {} },
      iconAssetId: null,
      outro: { on: true, dur: 2.5, cta: strings.outroCta, button: 'Download free', small: strings.outroSmall, style: {} },
      quality: '1080',
      music: null,
      volume: 0.8,
      ducking: true,
      scenes,
    };
    return { project, slots };
  },
};

/** Every procedural screen this template's slots need, keyed the same way
 * as the slots' `key` — used to build a working preview (dev tooling,
 * gallery, exported preview video) before any user uploads anything. */
export function buildFitnessSampleAssets(): AssetMap {
  return {
    today: makeTodayScreen(),
    'workout-detail': makeWorkoutDetailScreen(),
    'progress-chart': makeProgressChartScreen(),
    'streak-success': makeStreakSuccessScreen(),
  };
}
