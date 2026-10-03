/**
 * Demo content for the /dev/engine comparison page only — not part of the
 * production app. Ported from legacy/promo-studio.html's makeSample() and
 * the scene setup in its boot().
 *
 * makeSample() procedurally draws a fake habit-tracker screenshot on a
 * canvas (no network/image assets needed), exactly like the prototype uses
 * to populate the editor before a user uploads anything.
 */
import { PRESETS } from '@/engine/constants';
import { createImageSlide, createTextSlide } from '@/engine/slides';
import type { AssetMap, Project } from '@/engine/types';
import { rr } from '@/engine/utils';

type SampleKind = 'today' | 'stats' | 'streak';

export function makeSample(kind: SampleKind): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 600;
  cv.height = 1300;
  const ctx = cv.getContext('2d')!;
  const ink = '#15171C',
    grey = '#7A7F8C',
    acc = '#5B5BF7';
  const f = (w: number, s: number) => `${w} ${s}px Figtree, system-ui, sans-serif`;
  const ring = (cx: number, cy: number, r: number, lw: number, p: number, track: string, col: string) => {
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.strokeStyle = track;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    if (p > 0) {
      ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
      ctx.stroke();
    }
  };
  const status = (col: string) => {
    ctx.fillStyle = col;
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
  };
  const card = (X: number, Y: number, w: number, h: number, r: number) => {
    ctx.save();
    ctx.shadowColor = 'rgba(20,20,40,.07)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = '#fff';
    rr(ctx, X, Y, w, h, r);
    ctx.fill();
    ctx.restore();
  };
  const tabbar = (active: number) => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 1170, 600, 130);
    ctx.fillStyle = '#ECECF2';
    ctx.fillRect(0, 1170, 600, 2);
    [0, 1, 2, 3].forEach((i) => {
      ctx.fillStyle = i === active ? acc : '#C3C5D0';
      rr(ctx, 88 + i * 128, 1205, 40, 40, 12);
      ctx.fill();
    });
    ctx.fillStyle = '#15171C';
    rr(ctx, 210, 1276, 180, 8, 4);
    ctx.fill();
  };

  if (kind === 'streak') {
    const g = ctx.createLinearGradient(0, 0, 600, 1300);
    g.addColorStop(0, '#6D6BFF');
    g.addColorStop(1, '#3325C9');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 600, 1300);
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const cols = ['#FFD23F', '#FF8A3D', '#2FE3A6', '#FF7EB6', '#FFFFFF'];
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = cols[i % 5];
      ctx.save();
      ctx.translate(rnd() * 600, 120 + rnd() * 700);
      ctx.rotate(rnd() * 3);
      ctx.fillRect(-6, -3, 12 + rnd() * 8, 7);
      ctx.restore();
    }
    status('#fff');
    ctx.fillStyle = 'rgba(255,255,255,.14)';
    ctx.beginPath();
    ctx.arc(300, 540, 200, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(300, 540, 150, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = acc;
    ctx.font = f(800, 150);
    ctx.textAlign = 'center';
    ctx.fillText('21', 300, 592);
    ctx.fillStyle = '#fff';
    ctx.font = f(800, 46);
    ctx.fillText('day streak!', 300, 820);
    ctx.globalAlpha = 0.85;
    ctx.font = f(500, 26);
    ctx.fillText('You showed up three weeks', 300, 875);
    ctx.fillText('in a row. Keep it going.', 300, 912);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    rr(ctx, 60, 1090, 480, 100, 50);
    ctx.fill();
    ctx.fillStyle = acc;
    ctx.font = f(800, 30);
    ctx.fillText('Share streak', 300, 1151);
    ctx.textAlign = 'left';
    return cv;
  }

  ctx.fillStyle = '#F6F6F9';
  ctx.fillRect(0, 0, 600, 1300);
  status(ink);

  if (kind === 'today') {
    ctx.fillStyle = ink;
    ctx.font = f(800, 60);
    ctx.fillText('Today', 40, 170);
    ctx.fillStyle = grey;
    ctx.font = f(500, 24);
    ctx.fillText('Tuesday, June 3', 42, 210);
    const g = ctx.createLinearGradient(40, 250, 560, 420);
    g.addColorStop(0, '#6D6BFF');
    g.addColorStop(1, '#4A3FE0');
    ctx.fillStyle = g;
    rr(ctx, 40, 250, 520, 170, 34);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = f(800, 46);
    ctx.fillText('3 of 5', 76, 328);
    ctx.globalAlpha = 0.85;
    ctx.font = f(500, 24);
    ctx.fillText('habits done today', 78, 368);
    ctx.globalAlpha = 1;
    ring(470, 335, 50, 12, 0.6, 'rgba(255,255,255,.25)', '#fff');
    const habits: Array<[string, string, number, string]> = [
      ['Morning walk', '12-day streak', 1, '#22B573'],
      ['Read 20 pages', '5-day streak', 1, '#FF8A3D'],
      ['Drink water', '6 of 8 glasses', 0.75, '#2FA8FF'],
      ['Stretch', '9-day streak', 1, '#E056A0'],
      ['Journal', 'Not yet today', 0, '#8C8FA0'],
    ];
    habits.forEach(([n, s, p, col], i) => {
      const y = 452 + i * 140;
      card(40, y, 520, 118, 28);
      if (p >= 1) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(100, y + 59, 25, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(89, y + 60);
        ctx.lineTo(97, y + 68);
        ctx.lineTo(112, y + 51);
        ctx.stroke();
      } else ring(100, y + 59, 22, 6, p, '#E6E7EE', col);
      ctx.fillStyle = ink;
      ctx.font = f(700, 28);
      ctx.fillText(n, 146, y + 55);
      ctx.fillStyle = grey;
      ctx.font = f(500, 21);
      ctx.fillText(s, 146, y + 88);
    });
    tabbar(0);
  } else {
    ctx.fillStyle = ink;
    ctx.font = f(800, 60);
    ctx.fillText('This week', 40, 170);
    ctx.fillStyle = grey;
    ctx.font = f(500, 24);
    ctx.fillText('May 28 to June 3', 42, 210);
    card(40, 250, 520, 520, 34);
    ctx.fillStyle = ink;
    ctx.font = f(800, 80);
    ctx.fillText('86%', 76, 350);
    ctx.fillStyle = grey;
    ctx.font = f(500, 24);
    ctx.fillText('of habits completed', 78, 390);
    const vals = [0.6, 0.8, 0.7, 1, 0.9, 0.5, 0.85],
      days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    vals.forEach((v, i) => {
      const bx = 88 + i * 64,
        bh = 250 * v;
      ctx.fillStyle = '#ECECF6';
      rr(ctx, bx, 450, 40, 250, 12);
      ctx.fill();
      ctx.fillStyle = i === 3 ? '#22B573' : acc;
      rr(ctx, bx, 700 - bh, 40, bh, 12);
      ctx.fill();
      ctx.fillStyle = grey;
      ctx.font = f(600, 20);
      ctx.textAlign = 'center';
      ctx.fillText(days[i], bx + 20, 740);
      ctx.textAlign = 'left';
    });
    const stats: Array<[number, string, string, string]> = [
      [40, '21', 'best streak', '#FF8A3D'],
      [310, '142', 'check-ins', acc],
    ];
    stats.forEach(([X, n, l, col]) => {
      card(X, 800, 250, 170, 28);
      ctx.fillStyle = col;
      ctx.font = f(800, 56);
      ctx.fillText(n, X + 28, 880);
      ctx.fillStyle = grey;
      ctx.font = f(500, 22);
      ctx.fillText(l, X + 30, 920);
    });
    card(40, 1000, 520, 130, 28);
    ctx.fillStyle = '#22B573';
    rr(ctx, 70, 1030, 70, 70, 20);
    ctx.fill();
    ctx.fillStyle = grey;
    ctx.font = f(500, 21);
    ctx.fillText('Top habit', 166, 1055);
    ctx.fillStyle = ink;
    ctx.font = f(700, 28);
    ctx.fillText('Morning walk', 166, 1092);
    tabbar(1);
  }
  return cv;
}

/** Builds the same demo project the prototype boots with (three sample
 * screenshots + a text slide), for side-by-side comparison with
 * legacy/promo-studio.html. */
export function buildDemoProject(): { project: Project; assets: AssetMap } {
  const assets: AssetMap = {
    today: makeSample('today'),
    stats: makeSample('stats'),
    streak: makeSample('streak'),
  };

  let uid = 1;
  const project: Project = {
    format: '9:16',
    preset: 0,
    colors: { ...PRESETS[0] },
    font: 0,
    model: 'island',
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
    appName: 'Tally',
    intro: { on: true, dur: 2.5, tagline: 'Tiny habits, *counted.*', style: {} },
    iconAssetId: null,
    outro: {
      on: true,
      dur: 3,
      cta: 'Start your *streak* today',
      button: 'Download free',
      small: 'On iPhone and Android',
      style: { theme: '5', bgPattern: 'rays' },
    },
    quality: '1080',
    ducking: true,
    motionSpeed: 100,
    scenes: [
      createImageSlide(uid++, 'today', {
        headline: 'Build habits that *actually stick*',
        sub: 'One tap to check in. No guilt, just progress.',
        anim: 'rise',
        gesture: 'tap',
        callout: 'Tap to check in',
        focus: { x: 0.17, y: 0.61 },
        dur: 4,
      }),
      createTextSlide(uid++, {
        headline: 'Small wins, *every single day.*',
        dur: 2.5,
        camera: 'push',
        effect: 'sparkles',
        style: { theme: '3', textAnim: 'letters', transition: 'flash', bgPattern: 'dots' },
      }),
      createImageSlide(uid++, 'stats', {
        headline: 'Your whole week *at a glance*',
        sub: 'Streaks, trends and your best days.',
        anim: 'spotlight',
        dur: 4,
        focus: { x: 0.5, y: 0.44 },
        style: { transition: 'iris', bgPattern: 'grid', textAnim: 'type' },
      }),
      createImageSlide(uid++, 'streak', {
        headline: 'Keep the *streak* alive',
        sub: 'Celebrate every milestone.',
        anim: 'pop',
        layout: 'fan',
        badge: 'New',
        effect: 'confetti',
        camera: 'shake',
        dur: 4,
        style: { theme: '5', transition: 'bars', textAnim: 'pop', bgPattern: 'rays', fcolor: 'rose' },
      }),
    ],
  };

  return { project, assets };
}
