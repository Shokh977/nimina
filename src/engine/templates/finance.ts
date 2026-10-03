/**
 * Finance, banking & budgeting — docs/TEMPLATE_PACK.md §"4. Finance,
 * banking & budgeting". Midnight palette, Island phone (titanium), Sleek
 * motion. Slots: balance-home, transactions (tall), insights-chart,
 * transfer-success.
 */
import { DEFAULT_COUNTER, PRESETS } from '../constants';
import { createImageSlide } from '../slides';
import type { Action, AssetMap, Project, StorySlide } from '../types';
import { rr } from '../utils';
import type { TemplateBuildOptions, TemplateDef, TemplateSlot } from './types';

const INK = '#F3F4FF',
  GREY = '#8B93B8',
  ACCENT = '#7CF0FF',
  PANEL = '#141B33',
  BG = '#0B0F1F';

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

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.fillStyle = PANEL;
  rr(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.06)';
  ctx.lineWidth = 1.5;
  rr(ctx, x, y, w, h, r);
  ctx.stroke();
}

/** Balance overview — the counter overlay animates the balance number over
 * this screen at render time; the screenshot itself shows the settled
 * value so it still looks correct before that animation starts/if the
 * counter is ever removed. */
export function makeBalanceHomeScreen(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 600;
  cv.height = 1300;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, 600, 1300);
  statusBar(ctx);
  ctx.fillStyle = GREY;
  ctx.font = f(500, 24);
  ctx.fillText('Total balance', 42, 150);
  // No static balance number drawn here on purpose — the slide's live
  // counter overlay (see finance.ts's balanceSlide) renders the animated
  // amount at roughly this position; drawing a second, static number
  // underneath it produced illegible double-exposed text (caught
  // visually during Batch 1 QA). If this asset is ever used without a
  // counter attached, that's a real gap, not a silent one — the balance
  // amount just wouldn't show at all.
  ctx.fillStyle = '#4ADE80';
  ctx.font = f(700, 22);
  ctx.fillText('▲ 3.2% this month', 42, 258);

  const accounts: Array<[string, string, string]> = [
    ['Checking', '$4,120.10', '••4821'],
    ['Savings', '$8,360.20', '••1190'],
  ];
  accounts.forEach(([name, amt, tail], i) => {
    const y = 310 + i * 140;
    panel(ctx, 40, y, 520, 116, 26);
    ctx.fillStyle = INK;
    ctx.font = f(700, 26);
    ctx.fillText(name, 68, y + 46);
    ctx.fillStyle = GREY;
    ctx.font = f(500, 20);
    ctx.fillText(tail, 68, y + 78);
    ctx.fillStyle = ACCENT;
    ctx.font = f(800, 30);
    ctx.textAlign = 'right';
    ctx.fillText(amt, 520, y + 62);
    ctx.textAlign = 'left';
  });

  panel(ctx, 40, 630, 520, 200, 28);
  ctx.fillStyle = GREY;
  ctx.font = f(600, 22);
  ctx.fillText('QUICK ACTIONS', 68, 680);
  const actions = ['Send', 'Request', 'Top up'];
  actions.forEach((a, i) => {
    const x = 68 + i * 168;
    ctx.fillStyle = 'rgba(124,240,255,.14)';
    ctx.beginPath();
    ctx.arc(x + 40, 760, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ACCENT;
    ctx.font = f(800, 22);
    ctx.textAlign = 'center';
    ctx.fillText(a[0], x + 40, 768);
    ctx.fillStyle = INK;
    ctx.font = f(500, 18);
    ctx.fillText(a, x + 40, 812);
    ctx.textAlign = 'left';
  });
  return cv;
}

/** Tall scrollable transaction list. */
export function makeTransactionsScreen(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 600;
  cv.height = 2000;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, 600, 2000);
  statusBar(ctx);
  ctx.fillStyle = INK;
  ctx.font = f(800, 48);
  ctx.fillText('Transactions', 40, 160);

  const rows: Array<[string, string, string, string]> = [
    ['Whole Foods Market', 'Groceries', '-$84.20', '🛒'],
    ['Spotify', 'Subscriptions', '-$10.99', '🎵'],
    ['Payroll deposit', 'Income', '+$3,200.00', '💼'],
    ['Shell Gas Station', 'Transport', '-$42.10', '⛽'],
    ['Netflix', 'Subscriptions', '-$15.49', '🎬'],
    ['Blue Bottle Coffee', 'Dining', '-$6.75', '☕'],
    ['Amazon', 'Shopping', '-$128.40', '📦'],
    ['Gym membership', 'Health', '-$45.00', '💪'],
    ['Transfer from Savings', 'Transfer', '+$500.00', '🔁'],
    ['Electric Co.', 'Utilities', '-$96.30', '💡'],
  ];
  rows.forEach(([name, cat, amt, emoji], i) => {
    const y = 220 + i * 150;
    panel(ctx, 40, y, 520, 128, 26);
    ctx.font = f(400, 32);
    ctx.fillText(emoji, 66, y + 76);
    ctx.fillStyle = INK;
    ctx.font = f(700, 25);
    ctx.fillText(name, 132, y + 56);
    ctx.fillStyle = GREY;
    ctx.font = f(500, 20);
    ctx.fillText(cat, 132, y + 88);
    ctx.fillStyle = amt.startsWith('+') ? '#4ADE80' : INK;
    ctx.font = f(700, 25);
    ctx.textAlign = 'right';
    ctx.fillText(amt, 520, y + 70);
    ctx.textAlign = 'left';
  });
  return cv;
}

/** Spending-by-category chart. */
export function makeInsightsChartScreen(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 600;
  cv.height = 1300;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, 600, 1300);
  statusBar(ctx);
  ctx.fillStyle = INK;
  ctx.font = f(800, 48);
  ctx.fillText('Insights', 40, 160);
  ctx.fillStyle = GREY;
  ctx.font = f(500, 22);
  ctx.fillText('This month · $2,840 spent', 42, 196);

  panel(ctx, 40, 240, 520, 420, 30);
  const cats: Array<[string, number, string]> = [
    ['Groceries', 0.28, '#7CF0FF'],
    ['Rent', 0.35, '#8B5CF6'],
    ['Dining', 0.14, '#FDE047'],
    ['Transport', 0.11, '#4ADE80'],
    ['Other', 0.12, '#F472B6'],
  ];
  const cx = 300,
    cy = 420,
    r = 110;
  let a0 = -Math.PI / 2;
  cats.forEach(([, pct, col]) => {
    const a1 = a0 + pct * Math.PI * 2;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, a0, a1);
    ctx.closePath();
    ctx.fill();
    a0 = a1;
  });
  ctx.fillStyle = BG;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
  ctx.fill();

  cats.forEach(([name, pct, col], i) => {
    const y = 570 + i * 20;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(80, y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.font = f(500, 19);
    ctx.fillText(name, 100, y + 6);
    ctx.fillStyle = GREY;
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(pct * 100)}%`, 520, y + 6);
    ctx.textAlign = 'left';
  });
  return cv;
}

/** Transfer-complete screen — matches the story slide's `successCheck`. */
export function makeTransferSuccessScreen(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 600;
  cv.height = 1300;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, 600, 1300);
  statusBar(ctx);

  ctx.fillStyle = 'rgba(74,222,128,.12)';
  ctx.beginPath();
  ctx.arc(300, 480, 150, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#4ADE80';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.arc(300, 480, 100, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(255, 480);
  ctx.lineTo(288, 515);
  ctx.lineTo(350, 445);
  ctx.stroke();

  ctx.fillStyle = INK;
  ctx.font = f(800, 42);
  ctx.textAlign = 'center';
  ctx.fillText('Sent', 300, 680);
  ctx.fillStyle = ACCENT;
  ctx.font = f(800, 56);
  ctx.fillText('$250.00', 300, 748);
  ctx.fillStyle = GREY;
  ctx.font = f(500, 24);
  ctx.fillText('to Maya Chen · 2 seconds', 300, 790);
  ctx.textAlign = 'left';
  return cv;
}

export interface FinanceStrings {
  introTagline: string;
  balanceHeadline: string;
  transactionsCallout: string;
  chartHeadline: string;
  transferHeadline: string;
  outroCta: string;
}

export const DEFAULT_FINANCE_STRINGS: FinanceStrings = {
  introTagline: 'Money, made *calm*',
  balanceHeadline: 'Your money, *at a glance*',
  transactionsCallout: 'Categorized automatically',
  chartHeadline: 'See where it *actually goes*',
  transferHeadline: 'Sent in *2 seconds*',
  outroCta: 'Open an account *free*',
};

function buildTransferStoryActions(): Action[] {
  return [
    { id: 's1', type: 'tap', duration: 0.7, startMode: 'after-previous', easing: 'easeOutCubic', sfx: '', x: 0.5, y: 0.5, press: 'both' },
    { id: 's2', type: 'loading', duration: 0.7, startMode: 'after-previous', easing: 'easeOutCubic', sfx: '', style: 'spinner' },
    { id: 's3', type: 'showScreen', duration: 0.5, startMode: 'after-previous', easing: 'easeInOutCubic', sfx: '', screenId: 'transfer-success', transition: 'fade' },
    { id: 's4', type: 'successCheck', duration: 1.1, startMode: 'after-previous', easing: 'easeOutBack', sfx: '', x: 0.5, y: 0.37 },
  ];
}

/**
 * Finance has no slide explicitly marked optional in the spec — every beat
 * (balance, transactions, chart, transfer, ending) is core. Measured:
 * dropping only the transactions slide still totals ~17.5s, well over the
 * 8-10s short-cut target. Hitting it meant keeping just the balance slide
 * (the one with the live counter — the template's clearest single hero
 * moment) alongside intro/outro, and dropping transactions/chart/transfer
 * entirely for the short cut specifically. See Batch 1's write-up for the
 * measured before/after durations.
 */
function buildScenes(strings: FinanceStrings, variant: 'full' | 'short'): { scenes: Project['scenes']; slots: TemplateSlot[] } {
  let id = 1;
  const scenes: Project['scenes'] = [];
  const slots: TemplateSlot[] = [];

  const balanceSlide = createImageSlide(id++, 'balance-home', {
    headline: strings.balanceHeadline,
    anim: 'rise',
    dur: 3.2,
    counter: { ...DEFAULT_COUNTER, from: 0, to: 12480.3, format: 'currency', currencySymbol: '$', decimals: 2, at: 0.4, duration: 1.4, easing: 'easeOutCubic', x: 0.35, y: 0.17 },
  });
  slots.push({ key: 'balance-home', label: 'Balance home', hint: 'Account overview with the total balance', targets: [{ sceneId: balanceSlide.id }] });

  const transactionsSlide = createImageSlide(id++, 'transactions', { headline: 'Every transaction, *organized*', anim: 'slide', dur: 3.2, scroll: true, callout: strings.transactionsCallout, focus: { x: 0.5, y: 0.3 } });
  slots.push({ key: 'transactions', label: 'Transactions (tall)', hint: 'A real, scrollable transaction list', targets: [{ sceneId: transactionsSlide.id }] });

  const chartSlide = createImageSlide(id++, 'insights-chart', { headline: strings.chartHeadline, anim: 'spotlight', dur: 3.5, focus: { x: 0.5, y: 0.35 } });
  slots.push({ key: 'insights-chart', label: 'Insights chart', hint: 'Spending broken down by category', targets: [{ sceneId: chartSlide.id }] });

  const transferStory: StorySlide = {
    kind: 'story',
    id: id++,
    style: {},
    screens: [{ id: 'transfer-success', assetId: 'transfer-success' }],
    actions: buildTransferStoryActions(),
    sprites: [],
    cameraMode: 'auto',
    cameraKeys: [],
    hidden: false,
  };
  slots.push({ key: 'transfer-success', label: 'Transfer success', hint: 'The confirmation screen after sending money', targets: [{ sceneId: transferStory.id, screenId: 'transfer-success' }] });

  if (variant === 'short') {
    scenes.push(balanceSlide);
    return { scenes, slots };
  }

  scenes.push(balanceSlide, transactionsSlide, chartSlide, transferStory);
  return { scenes, slots };
}

export const FINANCE_TEMPLATE: TemplateDef = {
  id: 'finance',
  name: 'Finance, banking & budgeting',
  description: 'Sleek and restrained — a balance that ticks up, transactions sorted automatically, and a transfer sent in two seconds.',
  category: 'Finance',
  swatch: [PRESETS[7].a, PRESETS[7].b],
  durationSeconds: 18.4,
  build: (opts: TemplateBuildOptions = {}) => {
    const variant = opts.variant ?? 'full';
    const strings: FinanceStrings = { ...DEFAULT_FINANCE_STRINGS, ...(opts.strings as Partial<FinanceStrings> | undefined) };
    const { scenes, slots } = buildScenes(strings, variant);
    const project: Project = {
      format: '9:16',
      preset: 7,
      colors: { ...PRESETS[7] },
      font: 0,
      model: 'island',
      fcolor: 'titanium',
      bgPattern: 'grid',
      shapes: true,
      grain: false,
      vignette: false,
      storyBars: false,
      hlStyle: 'color',
      textPos: 'top',
      textAnim: 'rise',
      transition: 'wipe',
      appName: 'Ledger',
      intro: { on: true, dur: 2.5, tagline: strings.introTagline, style: {} },
      iconAssetId: null,
      // No confetti/sparkles anywhere in this template, per the spec's own
      // note — finance stays restrained even on success beats. Small print
      // stays generic (no invented regulatory/insurance claim like "FDIC-
      // insured") — that's a real compliance assertion a template must not
      // make on a fictional app's behalf, same reasoning as the marketing
      // site's placeholder legal pages in CLAUDE.md.
      outro: { on: true, dur: 3, cta: strings.outroCta, button: 'Get started', small: 'Bank-level security', style: {} },
      quality: '1080',
      ducking: true,
      motionSpeed: 100,
      scenes,
    };
    return { project, slots };
  },
  buildSampleAssets: buildFinanceSampleAssets,
};

export function buildFinanceSampleAssets(): AssetMap {
  return {
    'balance-home': makeBalanceHomeScreen(),
    transactions: makeTransactionsScreen(),
    'insights-chart': makeInsightsChartScreen(),
    'transfer-success': makeTransferSuccessScreen(),
  };
}
