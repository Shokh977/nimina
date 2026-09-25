/**
 * SaaS & web app (browser frame) — docs/TEMPLATE_PACK.md §"10. SaaS & web
 * app". Night palette, browser then phone, Sleek motion.
 * Slots: dashboard, detail-view, settings, mobile-companion.
 *
 * Adaptation found and made: "mobile-companion on a phone beside the
 * browser" asks for two different screenshots (a browser and a phone)
 * composited in one frame — `layout: 'fan'` only repeats the *same*
 * image across multiple devices, classic has no multi-source-in-one-frame
 * compositing. Rendered as its own single phone-framed slide instead; the
 * headline ("And in your pocket") carries the companion relationship
 * narratively rather than showing both devices at once.
 */
import { PRESETS } from '../constants';
import { createImageSlide, createTextSlide } from '../slides';
import type { AssetMap, CutoutLayer, Project } from '../types';
import { rr } from '../utils';
import type { TemplateBuildOptions, TemplateDef, TemplateSlot } from './types';

const INK = '#F5F7FF',
  GREY = '#8B93B8',
  ACCENT = '#3B82F6',
  PANEL = '#141B33',
  BG = '#06070C';

function f(w: number, s: number) {
  return `${w} ${s}px Figtree, system-ui, sans-serif`;
}

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.fillStyle = PANEL;
  rr(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.06)';
  ctx.lineWidth = 1.5;
  rr(ctx, x, y, w, h, r);
  ctx.stroke();
}

export function makeDashboardScreen(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 1200;
  cv.height = 760;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, 1200, 760);
  panel(ctx, 0, 0, 220, 760, 0);
  ctx.fillStyle = INK;
  ctx.font = f(800, 26);
  ctx.fillText('Vector', 32, 56);
  ['Overview', 'Analytics', 'Deploys', 'Team', 'Settings'].forEach((label, i) => {
    ctx.fillStyle = i === 0 ? ACCENT : GREY;
    ctx.font = f(600, 18);
    ctx.fillText(label, 32, 130 + i * 48);
  });

  ctx.fillStyle = INK;
  ctx.font = f(800, 32);
  ctx.fillText('Overview', 260, 70);
  const stats: Array<[string, string, string]> = [
    ['Requests / min', '48.2k', '+12%'],
    ['Error rate', '0.02%', '-4%'],
    ['P95 latency', '112ms', '-8%'],
  ];
  stats.forEach(([label, val, delta], i) => {
    const x = 260 + i * 300;
    panel(ctx, x, 110, 270, 150, 20);
    ctx.fillStyle = GREY;
    ctx.font = f(500, 16);
    ctx.fillText(label, x + 24, 150);
    ctx.fillStyle = INK;
    ctx.font = f(800, 36);
    ctx.fillText(val, x + 24, 200);
    ctx.fillStyle = '#4ADE80';
    ctx.font = f(700, 15);
    ctx.fillText(delta, x + 24, 232);
  });

  panel(ctx, 260, 290, 900, 400, 24);
  ctx.fillStyle = INK;
  ctx.font = f(700, 20);
  ctx.fillText('Traffic — last 7 days', 292, 330);
  const pts = [0.4, 0.55, 0.5, 0.7, 0.62, 0.8, 0.74];
  ctx.beginPath();
  pts.forEach((v, i) => {
    const x = 300 + (760 / (pts.length - 1)) * i,
      y = 620 - v * 240;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.stroke();
  return cv;
}

export function makeDetailViewScreen(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 1200;
  cv.height = 760;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, 1200, 760);
  panel(ctx, 0, 0, 220, 760, 0);
  ctx.fillStyle = INK;
  ctx.font = f(800, 26);
  ctx.fillText('Vector', 32, 56);

  ctx.fillStyle = INK;
  ctx.font = f(800, 32);
  ctx.fillText('Analytics', 260, 70);
  panel(ctx, 260, 110, 900, 560, 28);
  ctx.fillStyle = GREY;
  ctx.font = f(600, 18);
  ctx.fillText('MONTHLY ACTIVE USERS', 296, 170);
  ctx.fillStyle = ACCENT;
  ctx.font = f(800, 90);
  ctx.fillText('284,940', 296, 270);
  ctx.fillStyle = '#4ADE80';
  ctx.font = f(700, 20);
  ctx.fillText('▲ 18.4% vs last month', 296, 310);

  const bars = [0.4, 0.55, 0.5, 0.72, 0.62, 0.85, 0.95];
  bars.forEach((v, i) => {
    const x = 320 + i * 110,
      h = v * 260;
    ctx.fillStyle = i === bars.length - 1 ? ACCENT : 'rgba(59,130,246,.35)';
    rr(ctx, x, 620 - h, 70, h, 10);
    ctx.fill();
  });
  return cv;
}

export function makeSettingsScreen(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 1200;
  cv.height = 760;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, 1200, 760);
  panel(ctx, 0, 0, 220, 760, 0);
  ctx.fillStyle = INK;
  ctx.font = f(800, 26);
  ctx.fillText('Vector', 32, 56);

  ctx.fillStyle = INK;
  ctx.font = f(800, 32);
  ctx.fillText('Settings', 260, 70);
  const rows: Array<[string, string, boolean]> = [
    ['Email notifications', 'Weekly digest and alerts', true],
    ['Dark mode', 'Match system appearance', true],
    ['Two-factor auth', 'Require a code at sign-in', false],
    ['Beta features', 'Try new features early', false],
  ];
  rows.forEach(([label, sub, on], i) => {
    const y = 120 + i * 110;
    panel(ctx, 260, y, 900, 90, 20);
    ctx.fillStyle = INK;
    ctx.font = f(700, 22);
    ctx.fillText(label, 292, y + 38);
    ctx.fillStyle = GREY;
    ctx.font = f(500, 17);
    ctx.fillText(sub, 292, y + 64);
    const tx = 1080,
      ty = y + 45;
    ctx.fillStyle = on ? ACCENT : '#33395A';
    rr(ctx, tx - 40, ty - 16, 80, 32, 16);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(on ? tx + 12 : tx - 12, ty, 12, 0, Math.PI * 2);
    ctx.fill();
  });
  return cv;
}

export function makeMobileCompanionScreen(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 600;
  cv.height = 1300;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, 600, 1300);
  ctx.fillStyle = INK;
  ctx.font = f(700, 24);
  ctx.textBaseline = 'middle';
  ctx.fillText('9:41', 48, 52);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK;
  ctx.font = f(800, 40);
  ctx.fillText('Vector', 40, 160);
  panel(ctx, 40, 210, 520, 180, 26);
  ctx.fillStyle = GREY;
  ctx.font = f(500, 20);
  ctx.fillText('Requests / min', 66, 260);
  ctx.fillStyle = INK;
  ctx.font = f(800, 46);
  ctx.fillText('48.2k', 66, 320);
  ctx.fillStyle = '#4ADE80';
  ctx.font = f(700, 18);
  ctx.fillText('+12% today', 66, 358);

  panel(ctx, 40, 420, 520, 400, 26);
  ctx.fillStyle = GREY;
  ctx.font = f(600, 18);
  ctx.fillText('RECENT DEPLOYS', 66, 462);
  const deploys: Array<[string, string, string]> = [
    ['main', '2 min ago', '#4ADE80'],
    ['staging', '1 hour ago', '#4ADE80'],
    ['hotfix/auth', '3 hours ago', '#FBBF24'],
  ];
  deploys.forEach(([branch, time, col], i) => {
    const y = 500 + i * 90;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(78, y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.font = f(700, 22);
    ctx.fillText(branch, 100, y + 6);
    ctx.fillStyle = GREY;
    ctx.font = f(500, 17);
    ctx.textAlign = 'right';
    ctx.fillText(time, 520, y + 6);
    ctx.textAlign = 'left';
  });
  return cv;
}

export interface SaasStrings {
  introHeadline: string;
  dashboardCallout: string;
  detailHeadline: string;
  settingsHeadline: string;
  mobileHeadline: string;
  outroCta: string;
}

export const DEFAULT_SAAS_STRINGS: SaasStrings = {
  introHeadline: 'Ship faster. *Guess less.*',
  dashboardCallout: '48.2k requests/min',
  detailHeadline: 'Numbers that *actually move*',
  settingsHeadline: 'Flip it *on*',
  mobileHeadline: 'And in *your pocket*',
  outroCta: 'Try it free for *14 days*',
};

function buildScenes(strings: SaasStrings, variant: 'full' | 'short'): { scenes: Project['scenes']; slots: TemplateSlot[] } {
  let id = 1;
  const scenes: Project['scenes'] = [];
  const slots: TemplateSlot[] = [];

  const dashboardSlide = createImageSlide(id++, 'dashboard', {
    headline: 'Everything, *one glance away*',
    anim: 'rise',
    dur: 3.4,
    camera: 'push',
    callout: strings.dashboardCallout,
    focus: { x: 0.35, y: 0.24 },
    style: { model: 'browser', fcolor: 'silver' },
  });
  slots.push({ key: 'dashboard', label: 'Dashboard', hint: 'The main dashboard, in a browser frame', targets: [{ sceneId: dashboardSlide.id }] });

  const detailCutout: CutoutLayer = { id: 'chart-lift', rect: { x: 0.24, y: 0.18, w: 0.6, h: 0.55 }, radius: 0.05, preset: 'zoomHero', hollow: false, at: 0.3, stackIndex: 0 };
  const detailSlide = createImageSlide(id++, 'detail-view', {
    headline: strings.detailHeadline,
    anim: 'pop',
    dur: 3.6,
    cutouts: [detailCutout],
    style: { model: 'browser', fcolor: 'silver' },
    counter: { from: 0, to: 284940, format: 'integer', currencySymbol: '', decimals: 0, at: 0.4, duration: 1.5, easing: 'easeOutCubic', x: 0.46, y: 0.32 },
  });
  slots.push({ key: 'detail-view', label: 'Detail view', hint: 'Analytics detail — the chart card lifts out', targets: [{ sceneId: detailSlide.id }] });

  const settingsSlide = createImageSlide(id++, 'settings', {
    headline: strings.settingsHeadline,
    anim: 'slide',
    dur: 3,
    gesture: 'tap',
    focus: { x: 0.9, y: 0.16 },
    style: { model: 'browser', fcolor: 'silver' },
  });
  slots.push({ key: 'settings', label: 'Settings', hint: 'A settings row with a toggle — shown already on', targets: [{ sceneId: settingsSlide.id }] });

  const mobileSlide = createImageSlide(id++, 'mobile-companion', { headline: strings.mobileHeadline, anim: 'rise', dur: 3, style: { model: 'island', fcolor: 'silver' } });
  slots.push({ key: 'mobile-companion', label: 'Mobile companion', hint: 'The same app, on a phone', targets: [{ sceneId: mobileSlide.id }] });

  if (variant === 'short') {
    scenes.push(dashboardSlide, detailSlide);
    return { scenes, slots };
  }

  scenes.push(createTextSlide(id++, { headline: strings.introHeadline, dur: 2.2 }), dashboardSlide, detailSlide, settingsSlide, mobileSlide);
  return { scenes, slots };
}

export const SAAS_TEMPLATE: TemplateDef = {
  id: 'saas',
  name: 'SaaS & web app',
  description: 'Sleek and restrained — a dashboard, the numbers behind it, and a companion in your pocket.',
  category: 'SaaS',
  swatch: [PRESETS[3].a, PRESETS[3].b],
  durationSeconds: 18,
  build: (opts: TemplateBuildOptions = {}) => {
    const variant = opts.variant ?? 'full';
    const strings: SaasStrings = { ...DEFAULT_SAAS_STRINGS, ...(opts.strings as Partial<SaasStrings> | undefined) };
    const { scenes, slots } = buildScenes(strings, variant);
    const project: Project = {
      format: '9:16',
      preset: 3,
      colors: { ...PRESETS[3] },
      font: 0,
      model: 'browser',
      fcolor: 'silver',
      bgPattern: 'grid',
      shapes: true,
      grain: false,
      vignette: false,
      storyBars: false,
      hlStyle: 'color',
      textPos: 'top',
      textAnim: 'rise',
      transition: 'wipe',
      appName: 'Vector',
      intro: { on: false, dur: 2, tagline: '', style: {} },
      iconAssetId: null,
      outro: { on: true, dur: 2.8, cta: strings.outroCta, button: 'Start free trial', small: 'No credit card required', style: {} },
      quality: '1080',
      music: null,
      volume: 0.8,
      ducking: true,
      scenes,
    };
    return { project, slots };
  },
  buildSampleAssets: buildSaasSampleAssets,
};

export function buildSaasSampleAssets(): AssetMap {
  return {
    dashboard: makeDashboardScreen(),
    'detail-view': makeDetailViewScreen(),
    settings: makeSettingsScreen(),
    'mobile-companion': makeMobileCompanionScreen(),
  };
}
