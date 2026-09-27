/**
 * Productivity, tasks & notes — docs/TEMPLATE_PACK.md §"7. Productivity,
 * tasks & notes". Cobalt palette, browser + card mix, Sleek motion.
 * Slots: task-list (tall), task-detail, calendar, done-state.
 *
 * Spec conflict found and fixed: slide 3 is labeled "Screenshot" but asks
 * for "a type-text action showing text being entered" — `typeText` only
 * exists as a StorySlide action, a plain ImageSlide can't run one. Built
 * as a minimal two-action story slide (showScreen + typeText) instead —
 * reads almost identically to a static zoomed screenshot, but the typing
 * beat is real.
 */
import { PRESETS } from '../constants';
import { createImageSlide, createTextSlide } from '../slides';
import type { Action, AssetMap, Project, StorySlide } from '../types';
import { rr } from '../utils';
import type { TemplateBuildOptions, TemplateDef, TemplateSlot } from './types';

const INK = '#12162B',
  GREY = '#6E7590',
  ACCENT = '#3347FF',
  BG = '#F6F7FC';

function f(w: number, s: number) {
  return `${w} ${s}px Figtree, system-ui, sans-serif`;
}

function statusBar(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = INK;
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
  ctx.shadowColor = 'rgba(10,20,60,.08)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#fff';
  rr(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.restore();
}

export function makeTaskListScreen(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 600;
  cv.height = 2000;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, 600, 2000);
  statusBar(ctx);
  ctx.fillStyle = INK;
  ctx.font = f(800, 48);
  ctx.fillText('Today', 40, 160);
  ctx.fillStyle = GREY;
  ctx.font = f(500, 22);
  ctx.fillText('6 tasks · 2 done', 42, 196);

  const tasks: Array<[string, string, boolean]> = [
    ['Send Q3 report', 'Due 5:00 PM', true],
    ['Review design proofs', 'Due today', false],
    ['Book flight to Austin', 'Due tomorrow', false],
    ['Call with Priya', '2:30 PM', true],
    ['Update roadmap doc', 'Due Friday', false],
    ['Pay invoice #2291', 'Due Monday', false],
  ];
  tasks.forEach(([name, sub, done], i) => {
    const y = 250 + i * 130;
    card(ctx, 40, y, 520, 108, 24);
    ctx.strokeStyle = done ? ACCENT : '#D8DCF0';
    ctx.fillStyle = done ? ACCENT : '#fff';
    ctx.lineWidth = 4;
    rr(ctx, 66, y + 34, 40, 40, 12);
    if (done) ctx.fill();
    else ctx.stroke();
    if (done) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(76, y + 55);
      ctx.lineTo(84, y + 63);
      ctx.lineTo(98, y + 45);
      ctx.stroke();
    }
    ctx.fillStyle = done ? GREY : INK;
    ctx.font = f(700, 25);
    ctx.fillText(name, 130, y + 50);
    ctx.fillStyle = GREY;
    ctx.font = f(500, 20);
    ctx.fillText(sub, 130, y + 80);
  });
  return cv;
}

export function makeTaskDetailScreen(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 600;
  cv.height = 1300;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, 600, 1300);
  statusBar(ctx);
  ctx.fillStyle = GREY;
  ctx.font = f(600, 22);
  ctx.fillText('← Today', 42, 130);
  ctx.fillStyle = INK;
  ctx.font = f(800, 40);
  ctx.fillText('Review design proofs', 40, 190);

  card(ctx, 40, 240, 520, 300, 28);
  ctx.fillStyle = GREY;
  ctx.font = f(600, 20);
  ctx.fillText('DUE DATE', 68, 290);
  ctx.fillStyle = INK;
  ctx.font = f(700, 28);
  ctx.fillText('Today, 5:00 PM', 68, 330);
  ctx.strokeStyle = '#EAECF7';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(68, 360);
  ctx.lineTo(532, 360);
  ctx.stroke();
  ctx.fillStyle = GREY;
  ctx.font = f(600, 20);
  ctx.fillText('ASSIGNEE', 68, 400);
  ctx.fillStyle = INK;
  ctx.font = f(700, 26);
  ctx.fillText('You', 68, 436);
  ctx.strokeStyle = '#EAECF7';
  ctx.beginPath();
  ctx.moveTo(68, 466);
  ctx.lineTo(532, 466);
  ctx.stroke();
  ctx.fillStyle = GREY;
  ctx.font = f(600, 20);
  ctx.fillText('PRIORITY', 68, 506);
  ctx.fillStyle = ACCENT;
  ctx.font = f(700, 26);
  ctx.fillText('High', 68, 542);

  card(ctx, 40, 580, 520, 160, 28);
  ctx.fillStyle = GREY;
  ctx.font = f(600, 20);
  ctx.fillText('NOTES', 68, 620);
  ctx.fillStyle = INK;
  ctx.font = f(500, 22);
  ctx.fillText('Check the new logo lockup', 68, 656);
  ctx.fillText('before sending to print.', 68, 686);
  return cv;
}

export function makeCalendarScreen(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 1000;
  cv.height = 680;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, 1000, 680);
  ctx.fillStyle = INK;
  ctx.font = f(800, 32);
  ctx.fillText('June 2026', 40, 60);
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  days.forEach((d, i) => {
    ctx.fillStyle = GREY;
    ctx.font = f(600, 16);
    ctx.textAlign = 'center';
    ctx.fillText(d, 76 + i * 128, 100);
  });
  const events = [3, 8, 12, 15, 15, 20, 24];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 7; col++) {
      const day = row * 7 + col + 1;
      if (day > 28) continue;
      const x = 76 + col * 128,
        y = 150 + row * 120;
      ctx.fillStyle = GREY;
      ctx.font = f(500, 18);
      ctx.textAlign = 'left';
      ctx.fillText(String(day), x - 30, y);
      if (events.includes(day)) {
        ctx.fillStyle = ACCENT;
        rr(ctx, x - 30, y + 12, 90, 22, 6);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = f(600, 13);
        ctx.fillText('Meeting', x - 24, y + 27);
      }
    }
  }
  ctx.textAlign = 'left';
  return cv;
}

export function makeDoneStateScreen(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 600;
  cv.height = 1300;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, 600, 1300);
  statusBar(ctx);
  ctx.fillStyle = 'rgba(51,71,255,.1)';
  ctx.beginPath();
  ctx.arc(300, 480, 160, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(230, 480);
  ctx.lineTo(280, 530);
  ctx.lineTo(380, 420);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = f(800, 40);
  ctx.textAlign = 'center';
  ctx.fillText('Inbox zero', 300, 660);
  ctx.fillStyle = GREY;
  ctx.font = f(500, 24);
  ctx.fillText('Every task, done for today.', 300, 700);
  ctx.textAlign = 'left';
  return cv;
}

export interface ProductivityStrings {
  introHeadline: string;
  taskListHeadline: string;
  taskListCallout: string;
  calendarHeadline: string;
  doneHeadline: string;
  outroCta: string;
}

export const DEFAULT_PRODUCTIVITY_STRINGS: ProductivityStrings = {
  introHeadline: 'Your day, *under control*',
  taskListHeadline: 'One tap, *done*',
  taskListCallout: 'One tap to complete',
  calendarHeadline: 'Works on *every device*',
  doneHeadline: 'Inbox zero, *finally*',
  outroCta: 'Get started *free*',
};

function buildTaskDetailActions(): Action[] {
  return [
    { id: 'p1', type: 'showScreen', duration: 0.5, startMode: 'after-previous', easing: 'easeInOutCubic', sfx: '', screenId: 'task-detail', transition: 'none' },
    { id: 'p2', type: 'typeText', duration: 1.4, startMode: 'after-previous', easing: 'easeInOutCubic', sfx: '', x: 0.12, y: 0.253, width: 0.5, text: 'Tomorrow, 9:00 AM', charsPerSecond: 14 },
  ];
}

function buildScenes(strings: ProductivityStrings, variant: 'full' | 'short'): { scenes: Project['scenes']; slots: TemplateSlot[] } {
  let id = 1;
  const scenes: Project['scenes'] = [];
  const slots: TemplateSlot[] = [];

  const taskListSlide = createImageSlide(id++, 'task-list', { headline: strings.taskListHeadline, anim: 'rise', dur: 3.4, gesture: 'tap', callout: strings.taskListCallout, focus: { x: 0.17, y: 0.29 } });
  slots.push({ key: 'task-list', label: "Task list (tall)", hint: "Today's task list", targets: [{ sceneId: taskListSlide.id }] });

  const taskDetailStory: StorySlide = {
    kind: 'story',
    id: id++,
    style: {},
    screens: [{ id: 'task-detail', assetId: 'task-detail' }],
    actions: buildTaskDetailActions(),
    sprites: [],
    cameraMode: 'manual',
    cameraKeys: [{ time: 0, target: { x: 0.5, y: 0.26 }, zoom: 1.35 }],
    hidden: false,
  };
  slots.push({ key: 'task-detail', label: 'Task detail', hint: 'One task, expanded — the due-date field gets typed into', targets: [{ sceneId: taskDetailStory.id, screenId: 'task-detail' }] });

  const calendarSlide = createImageSlide(id++, 'calendar', { headline: strings.calendarHeadline, anim: 'rise', dur: 3, style: { model: 'browser', fcolor: 'graphite' } });
  slots.push({ key: 'calendar', label: 'Calendar', hint: 'The calendar view, in a browser frame', targets: [{ sceneId: calendarSlide.id }] });

  const doneSlide = createImageSlide(id++, 'done-state', { headline: strings.doneHeadline, anim: 'pop', dur: 3, effect: 'sparkles' });
  slots.push({ key: 'done-state', label: 'Done state', hint: 'The "all tasks complete" screen', targets: [{ sceneId: doneSlide.id }] });

  if (variant === 'short') {
    scenes.push(taskListSlide, doneSlide);
    return { scenes, slots };
  }

  scenes.push(createTextSlide(id++, { headline: strings.introHeadline, dur: 2.2 }), taskListSlide, taskDetailStory, calendarSlide, doneSlide);
  return { scenes, slots };
}

export const PRODUCTIVITY_TEMPLATE: TemplateDef = {
  id: 'productivity',
  name: 'Productivity, tasks & notes',
  description: 'Sleek and calm — tasks completed in one tap, due dates set fast, and inbox zero within reach.',
  category: 'Productivity',
  swatch: [PRESETS[0].a, PRESETS[0].b],
  durationSeconds: 16.1,
  build: (opts: TemplateBuildOptions = {}) => {
    const variant = opts.variant ?? 'full';
    const strings: ProductivityStrings = { ...DEFAULT_PRODUCTIVITY_STRINGS, ...(opts.strings as Partial<ProductivityStrings> | undefined) };
    const { scenes, slots } = buildScenes(strings, variant);
    const project: Project = {
      format: '9:16',
      preset: 0,
      colors: { ...PRESETS[0] },
      font: 0,
      model: 'card',
      fcolor: 'graphite',
      bgPattern: 'grid',
      shapes: true,
      grain: false,
      vignette: false,
      storyBars: false,
      hlStyle: 'underline',
      textPos: 'top',
      textAnim: 'rise',
      transition: 'none',
      appName: 'Flow',
      intro: { on: false, dur: 2, tagline: '', style: {} },
      iconAssetId: null,
      outro: { on: true, dur: 2.6, cta: strings.outroCta, button: 'Get started', small: '', style: {} },
      quality: '1080',
      music: null,
      volume: 0.8,
      ducking: true,
      motionSpeed: 100,
      scenes,
    };
    return { project, slots };
  },
  buildSampleAssets: buildProductivitySampleAssets,
};

export function buildProductivitySampleAssets(): AssetMap {
  return {
    'task-list': makeTaskListScreen(),
    'task-detail': makeTaskDetailScreen(),
    calendar: makeCalendarScreen(),
    'done-state': makeDoneStateScreen(),
  };
}
