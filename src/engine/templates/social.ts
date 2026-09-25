/**
 * Social, community & chat — docs/TEMPLATE_PACK.md §"5. Social, community
 * & chat". Grape palette, Island phone (theme), Playful motion.
 * Slots: feed (tall), post-detail, chat, profile.
 *
 * Spec gap found and fixed: `profile` is declared as a named slot but
 * never referenced anywhere in the beat table — shipping it as a slot
 * with no beat would mean the wizard asks for a screenshot the template
 * never shows. Added as its own short beat (slide 4) rather than quietly
 * dropping the slot.
 */
import { PRESETS } from '../constants';
import { createImageSlide, createTextSlide } from '../slides';
import type { AssetMap, CutoutLayer, Project } from '../types';
import { rr } from '../utils';
import type { TemplateBuildOptions, TemplateDef, TemplateSlot } from './types';

const INK = '#241033',
  GREY = '#7C6E8C',
  ACCENT = '#8B5CF6',
  BG = '#F7F3FC';

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
  ctx.shadowColor = 'rgba(60,20,90,.09)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = '#fff';
  rr(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.restore();
}

function avatar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, col: string) {
  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  g.addColorStop(0, col);
  g.addColorStop(1, ACCENT);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Tall scrollable social feed. */
export function makeFeedScreen(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 600;
  cv.height = 2200;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, 600, 2200);
  statusBar(ctx);
  ctx.fillStyle = INK;
  ctx.font = f(800, 46);
  ctx.fillText('Circle', 40, 156);

  const posts: Array<[string, string, string, number, string]> = [
    ['Maya Chen', '2h', 'Sunset from the rooftop tonight 🌆', 128, '#FDBA74'],
    ['Jordan Lee', '4h', 'Finally finished the mural! Took 3 weekends.', 342, '#93C5FD'],
    ['Priya Nair', '6h', 'Coffee + rain + a good book = perfect Sunday ☕', 89, '#FCA5A5'],
    ['Sam Okafor', '1d', 'New personal best on the trail run today 🏃', 210, '#86EFAC'],
  ];
  posts.forEach(([name, time, text, likes, col], i) => {
    const y = 200 + i * 470;
    card(ctx, 40, y, 520, 430, 30);
    avatar(ctx, 96, y + 56, 30, col);
    ctx.fillStyle = INK;
    ctx.font = f(700, 24);
    ctx.fillText(name, 140, y + 50);
    ctx.fillStyle = GREY;
    ctx.font = f(500, 19);
    ctx.fillText(time, 140, y + 76);
    ctx.fillStyle = col;
    rr(ctx, 66, y + 106, 468, 230, 24);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.font = f(600, 24);
    const words = text.split(' ');
    let line = '';
    const ly = y + 380;
    const lines: string[] = [];
    words.forEach((w) => {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > 460) {
        lines.push(line);
        line = w;
      } else line = test;
    });
    lines.push(line);
    lines.slice(0, 2).forEach((l, li) => ctx.fillText(l, 66, ly + li * 30));
    ctx.fillStyle = ACCENT;
    ctx.font = f(700, 20);
    ctx.fillText(`♥ ${likes}`, 66, y + 405);
  });
  return cv;
}

/** A single post, expanded — the cutout ("lift the post card out") target. */
export function makePostDetailScreen(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 600;
  cv.height = 1300;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, 600, 1300);
  statusBar(ctx);
  card(ctx, 40, 130, 520, 900, 32);
  avatar(ctx, 106, 200, 34, '#93C5FD');
  ctx.fillStyle = INK;
  ctx.font = f(700, 26);
  ctx.fillText('Jordan Lee', 154, 194);
  ctx.fillStyle = GREY;
  ctx.font = f(500, 20);
  ctx.fillText('4 hours ago', 154, 222);
  ctx.fillStyle = '#93C5FD';
  rr(ctx, 66, 260, 468, 440, 26);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = f(600, 25);
  ctx.fillText('Finally finished the mural!', 90, 720);
  ctx.fillText('Took 3 weekends.', 90, 754);
  ctx.fillStyle = ACCENT;
  ctx.font = f(800, 30);
  ctx.fillText('♥ 342', 90, 830);
  ctx.fillStyle = GREY;
  ctx.font = f(500, 22);
  ctx.fillText('28 comments · 12 shares', 90, 870);
  ctx.strokeStyle = '#EDE4F7';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(66, 910);
  ctx.lineTo(534, 910);
  ctx.stroke();
  ctx.fillStyle = GREY;
  ctx.font = f(500, 22);
  ctx.fillText('Add a comment…', 90, 970);
  return cv;
}

/** Chat thread — the "three message bubbles lift out" target. */
export function makeChatScreen(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 600;
  cv.height = 1300;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, 600, 1300);
  statusBar(ctx);
  avatar(ctx, 96, 130, 28, '#FCA5A5');
  ctx.fillStyle = INK;
  ctx.font = f(700, 26);
  ctx.fillText('Priya', 140, 138);
  ctx.fillStyle = '#22C55E';
  ctx.font = f(500, 18);
  ctx.fillText('online', 140, 162);

  const bubbles: Array<[string, 'in' | 'out', number]> = [
    ['Did you see the update? 👀', 'in', 220],
    ["It's so good 😍", 'out', 330],
    ["Can't stop reacting to everything", 'in', 430],
  ];
  bubbles.forEach(([text, dir, y]) => {
    ctx.font = f(600, 23);
    const w = Math.min(400, ctx.measureText(text).width + 60);
    const x = dir === 'in' ? 60 : 540 - w;
    ctx.fillStyle = dir === 'in' ? '#fff' : ACCENT;
    rr(ctx, x, y, w, 76, 26);
    ctx.fill();
    ctx.fillStyle = dir === 'in' ? INK : '#fff';
    ctx.fillText(text, x + 26, y + 46);
  });
  ctx.fillStyle = GREY;
  ctx.font = f(500, 22);
  ctx.fillText('Message', 66, 1220);
  card(ctx, 40, 1170, 520, 100, 50);
  ctx.fillStyle = GREY;
  ctx.fillText('Message', 76, 1228);
  ctx.fillStyle = ACCENT;
  ctx.beginPath();
  ctx.arc(500, 1220, 32, 0, Math.PI * 2);
  ctx.fill();
  return cv;
}

/** Profile screen — the spec's unused-but-declared slot, given a real beat. */
export function makeProfileScreen(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 600;
  cv.height = 1300;
  const ctx = cv.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 600, 400);
  g.addColorStop(0, '#8B5CF6');
  g.addColorStop(1, '#3B0F7A');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 600, 340);
  statusBar(ctx);
  avatar(ctx, 300, 240, 76, '#FDBA74');
  ctx.fillStyle = BG;
  ctx.fillRect(0, 340, 600, 960);
  ctx.fillStyle = INK;
  ctx.font = f(800, 38);
  ctx.textAlign = 'center';
  ctx.fillText('Maya Chen', 300, 410);
  ctx.fillStyle = GREY;
  ctx.font = f(500, 22);
  ctx.fillText('@mayachen · Joined 2023', 300, 444);
  const stats: Array<[string, string]> = [
    ['284', 'Posts'],
    ['12.4k', 'Followers'],
    ['891', 'Following'],
  ];
  stats.forEach(([n, l], i) => {
    const x = 130 + i * 170;
    ctx.fillStyle = INK;
    ctx.font = f(800, 32);
    ctx.fillText(n, x, 520);
    ctx.fillStyle = GREY;
    ctx.font = f(500, 19);
    ctx.fillText(l, x, 550);
  });
  ctx.textAlign = 'left';
  for (let i = 0; i < 6; i++) {
    const x = 40 + (i % 3) * 178,
      y = 610 + Math.floor(i / 3) * 178;
    ctx.fillStyle = ['#FDBA74', '#93C5FD', '#FCA5A5', '#86EFAC', '#C4B5FD', '#FDE68A'][i];
    rr(ctx, x, y, 166, 166, 20);
    ctx.fill();
  }
  return cv;
}

export interface SocialStrings {
  introTagline: string;
  feedHeadline: string;
  profileHeadline: string;
  statementHeadline: string;
  outroCta: string;
}

export const DEFAULT_SOCIAL_STRINGS: SocialStrings = {
  introTagline: 'Your people, *in one place*',
  feedHeadline: 'A feed that’s *actually yours*',
  profileHeadline: 'Your world, *your rules*',
  statementHeadline: 'Say more with *reactions*',
  outroCta: 'Join *free*',
};

function buildScenes(strings: SocialStrings, variant: 'full' | 'short'): { scenes: Project['scenes']; slots: TemplateSlot[] } {
  let id = 1;
  const scenes: Project['scenes'] = [];
  const slots: TemplateSlot[] = [];

  const feedSlide = createImageSlide(id++, 'feed', { headline: strings.feedHeadline, anim: 'slide', dur: 3.2, scroll: true });
  slots.push({ key: 'feed', label: 'Feed (tall)', hint: 'The full scrollable feed', targets: [{ sceneId: feedSlide.id }] });

  const postCutout: CutoutLayer = { id: 'post-lift', rect: { x: 0.11, y: 0.2, w: 0.78, h: 0.34 }, radius: 0.08, preset: 'liftOut', hollow: true, at: 0.3, stackIndex: 0 };
  const postSlide = createImageSlide(id++, 'post-detail', {
    headline: 'A moment *worth reacting to*',
    anim: 'pop',
    dur: 3.4,
    gesture: 'tap',
    effect: 'stickers',
    stickers: '❤️💕💖✨',
    cutouts: [postCutout],
    counter: { from: 0, to: 847, format: 'integer', currencySymbol: '', decimals: 0, at: 0.5, duration: 1.2, easing: 'easeOutCubic', x: 0.68, y: 0.62 },
  });
  slots.push({ key: 'post-detail', label: 'Post detail', hint: 'One post, expanded — the reaction moment', targets: [{ sceneId: postSlide.id }] });

  const chatCutouts: CutoutLayer[] = [
    { id: 'bub-1', rect: { x: 0.1, y: 0.16, w: 0.62, h: 0.08 }, radius: 0.3, preset: 'liftOut', hollow: false, at: 0.25, stackIndex: 0 },
    { id: 'bub-2', rect: { x: 0.28, y: 0.26, w: 0.62, h: 0.08 }, radius: 0.3, preset: 'liftOut', hollow: false, at: 0.55, stackIndex: 1 },
    { id: 'bub-3', rect: { x: 0.1, y: 0.35, w: 0.68, h: 0.08 }, radius: 0.3, preset: 'liftOut', hollow: false, at: 0.85, stackIndex: 2 },
  ];
  const chatSlide = createImageSlide(id++, 'chat', { headline: 'Every message, *alive*', anim: 'rise', dur: 3.6, cutouts: chatCutouts });
  slots.push({ key: 'chat', label: 'Chat', hint: 'A thread — the three bubbles lift out one by one', targets: [{ sceneId: chatSlide.id }] });

  const profileSlide = createImageSlide(id++, 'profile', { headline: strings.profileHeadline, anim: 'rise', dur: 3 });
  slots.push({ key: 'profile', label: 'Profile', hint: 'Your profile — posts, followers, grid', targets: [{ sceneId: profileSlide.id }] });

  if (variant === 'short') {
    scenes.push(postSlide, chatSlide);
    return { scenes, slots };
  }

  scenes.push(feedSlide, postSlide, chatSlide, profileSlide, createTextSlide(id++, { headline: strings.statementHeadline, dur: 2.2 }));
  return { scenes, slots };
}

export const SOCIAL_TEMPLATE: TemplateDef = {
  id: 'social',
  name: 'Social, community & chat',
  description: 'Playful and warm — a feed worth scrolling, a post worth reacting to, and messages that feel alive.',
  category: 'Social',
  swatch: [PRESETS[5].a, PRESETS[5].b],
  durationSeconds: 20.4,
  build: (opts: TemplateBuildOptions = {}) => {
    const variant = opts.variant ?? 'full';
    const strings: SocialStrings = { ...DEFAULT_SOCIAL_STRINGS, ...(opts.strings as Partial<SocialStrings> | undefined) };
    const { scenes, slots } = buildScenes(strings, variant);
    const project: Project = {
      format: '9:16',
      preset: 5,
      colors: { ...PRESETS[5] },
      font: 0,
      model: 'island',
      fcolor: 'theme',
      bgPattern: 'dots',
      shapes: true,
      grain: false,
      vignette: false,
      storyBars: false,
      hlStyle: 'marker',
      textPos: 'top',
      textAnim: 'pop',
      transition: 'iris',
      appName: 'Circle',
      intro: { on: variant === 'full', dur: 2.2, tagline: strings.introTagline, style: {} },
      iconAssetId: null,
      // OutroConfig has no badge field (only regular slides do) — the
      // spec's "+ badge 'New'" is folded into the small-print line instead
      // of dropped, since the intent (signal the app is new) survives.
      outro: { on: true, dur: 2.8, cta: strings.outroCta, button: 'Get started', small: 'New · free to join', style: {} },
      quality: '1080',
      music: null,
      volume: 0.8,
      ducking: true,
      scenes,
    };
    return { project, slots };
  },
  buildSampleAssets: buildSocialSampleAssets,
};

export function buildSocialSampleAssets(): AssetMap {
  return {
    feed: makeFeedScreen(),
    'post-detail': makePostDetailScreen(),
    chat: makeChatScreen(),
    profile: makeProfileScreen(),
  };
}
