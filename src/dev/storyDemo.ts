/**
 * Demo content for the /dev/engine page's story-slide tab — not part of the
 * production app. Builds a single-slide project that exercises every story
 * action type in one continuous phone shot: launch app -> splash loading ->
 * scroll a tall menu -> tap an item (camera pushes in) -> cart slides in ->
 * tap pay -> success check -> map screen with a scooter driving to a house
 * pin -> notification -> bell rings.
 */
import { PRESETS } from '@/engine/constants';
import type { Action, AssetMap, Project, Sprite, StorySlide } from '@/engine/types';
import { rr } from '@/engine/utils';

const INK = '#15171C',
  GREY = '#7A7F8C',
  ACCENT = '#FF6A3D';

function f(w: number, s: number) {
  return `${w} ${s}px Figtree, system-ui, sans-serif`;
}

/** Small rounded-square app icon with a fork/knife glyph — no image assets. */
function makeAppIcon(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 256;
  const ctx = cv.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 256, 256);
  g.addColorStop(0, '#FF8A5B');
  g.addColorStop(1, ACCENT);
  ctx.fillStyle = g;
  rr(ctx, 0, 0, 256, 256, 58);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(96, 70);
  ctx.lineTo(96, 130);
  ctx.moveTo(80, 70);
  ctx.lineTo(80, 105);
  ctx.moveTo(112, 70);
  ctx.lineTo(112, 105);
  ctx.moveTo(96, 130);
  ctx.lineTo(96, 190);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(162, 92, 22, Math.PI * 1.05, Math.PI * 0.1, true);
  ctx.lineTo(162, 190);
  ctx.stroke();
  return cv;
}

/** Tall scrollable restaurant menu — 2400px tall vs. a 1300px screen, so
 * the `scroll` action has real overflow to reveal. */
function makeMenuScreen(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 600;
  cv.height = 2400;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#F6F6F9';
  ctx.fillRect(0, 0, 600, 2400);

  ctx.fillStyle = INK;
  ctx.font = f(800, 56);
  ctx.fillText('Menu', 40, 130);
  ctx.fillStyle = GREY;
  ctx.font = f(500, 24);
  ctx.fillText('Tonino’s Pizzeria • 12 min away', 42, 168);

  const items: Array<[string, string, string]> = [
    ['Margherita', 'Tomato, mozzarella, basil', '$14'],
    ['Pepperoni supreme', 'Double pepperoni, chili oil', '$16'],
    ['Truffle mushroom', 'Wild mushroom, truffle oil', '$18'],
    ['Four cheese', 'Mozzarella, gorgonzola, parmesan', '$17'],
    ['BBQ chicken', 'Chicken, red onion, bbq sauce', '$16'],
    ['Veggie garden', 'Peppers, olives, spinach', '$15'],
    ['Spicy diavola', 'Salami, chili, mozzarella', '$16'],
    ['Classic calzone', 'Ham, mozzarella, ricotta', '$15'],
  ];
  const top = 260,
    rowH = 280;
  items.forEach(([name, desc, price], i) => {
    const y = top + i * rowH;
    ctx.save();
    ctx.shadowColor = 'rgba(20,20,40,.07)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#fff';
    rr(ctx, 40, y, 520, rowH - 24, 26);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#ECECF6';
    rr(ctx, 66, y + 26, 140, 140, 22);
    ctx.fill();

    ctx.fillStyle = INK;
    ctx.font = f(700, 30);
    ctx.fillText(name, 230, y + 74);
    ctx.fillStyle = GREY;
    ctx.font = f(500, 21);
    ctx.fillText(desc, 230, y + 108);
    ctx.fillStyle = ACCENT;
    ctx.font = f(800, 28);
    ctx.fillText(price, 230, y + 150);
  });
  return cv;
}

/** Cart summary with a Pay button. */
function makeCartScreen(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 600;
  cv.height = 1300;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#F6F6F9';
  ctx.fillRect(0, 0, 600, 1300);

  ctx.fillStyle = INK;
  ctx.font = f(800, 52);
  ctx.fillText('Your cart', 40, 130);

  const items: Array<[string, string, string]> = [
    ['BBQ chicken pizza', '1x', '$16.00'],
    ['Garlic bread', '1x', '$5.50'],
  ];
  items.forEach(([name, qty, price], i) => {
    const y = 210 + i * 130;
    ctx.save();
    ctx.shadowColor = 'rgba(20,20,40,.07)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#fff';
    rr(ctx, 40, y, 520, 108, 24);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = INK;
    ctx.font = f(700, 27);
    ctx.fillText(name, 68, y + 46);
    ctx.fillStyle = GREY;
    ctx.font = f(500, 21);
    ctx.fillText(qty, 68, y + 80);
    ctx.fillStyle = INK;
    ctx.font = f(700, 27);
    ctx.textAlign = 'right';
    ctx.fillText(price, 520, y + 62);
    ctx.textAlign = 'left';
  });

  const totalY = 210 + items.length * 130 + 40;
  ctx.strokeStyle = '#E6E7EE';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(40, totalY);
  ctx.lineTo(560, totalY);
  ctx.stroke();
  ctx.fillStyle = GREY;
  ctx.font = f(500, 24);
  ctx.fillText('Total', 40, totalY + 60);
  ctx.fillStyle = INK;
  ctx.font = f(800, 34);
  ctx.textAlign = 'right';
  ctx.fillText('$21.50', 560, totalY + 66);
  ctx.textAlign = 'left';

  // Pay button, centered around normalized (0.5, 0.86) — matches the
  // `tap` action's x/y below.
  const btnW = 480,
    btnH = 108,
    btnX = 300 - btnW / 2,
    btnY = 1300 * 0.86 - btnH / 2;
  const g = ctx.createLinearGradient(btnX, btnY, btnX + btnW, btnY);
  g.addColorStop(0, '#FF8A5B');
  g.addColorStop(1, ACCENT);
  ctx.fillStyle = g;
  rr(ctx, btnX, btnY, btnW, btnH, btnH / 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = f(800, 30);
  ctx.textAlign = 'center';
  ctx.fillText('Pay $21.50', 300, btnY + btnH / 2 + 10);
  ctx.textAlign = 'left';
  return cv;
}

/** Map background with a road grid and a house pin marking the delivery
 * destination — the scooter Sprite's path (defined separately, in screen-box
 * space) ends near the same normalized position as this pin. */
function makeMapScreen(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 600;
  cv.height = 1300;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#E8ECE4';
  ctx.fillRect(0, 0, 600, 1300);

  ctx.strokeStyle = '#D3D9CC';
  ctx.lineWidth = 3;
  for (let x = 40; x < 600; x += 90) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 1300);
    ctx.stroke();
  }
  for (let y = 40; y < 1300; y += 90) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(600, y);
    ctx.stroke();
  }
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.moveTo(150, 1120);
  ctx.quadraticCurveTo(240, 950, 240, 800);
  ctx.quadraticCurveTo(240, 620, 350, 550);
  ctx.quadraticCurveTo(430, 500, 432, 390);
  ctx.stroke();

  // house pin, at normalized (0.72, 0.30) — same spot the scooter path ends.
  const hx = 600 * 0.72,
    hy = 1300 * 0.3;
  ctx.fillStyle = '#3B4A3A';
  ctx.beginPath();
  ctx.moveTo(hx - 46, hy + 10);
  ctx.lineTo(hx, hy - 46);
  ctx.lineTo(hx + 46, hy + 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  rr(ctx, hx - 34, hy + 4, 68, 56, 6);
  ctx.fill();
  ctx.fillStyle = ACCENT;
  rr(ctx, hx - 12, hy + 28, 24, 32, 3);
  ctx.fill();

  ctx.fillStyle = INK;
  ctx.font = f(700, 26);
  ctx.textAlign = 'center';
  ctx.fillText('Delivering to Maple St', 300, 1240);
  ctx.textAlign = 'left';
  return cv;
}

export function buildStoryDemoProject(): { project: Project; assets: AssetMap } {
  const assets: AssetMap = {
    appicon: makeAppIcon(),
    menu: makeMenuScreen(),
    cart: makeCartScreen(),
    map: makeMapScreen(),
  };

  const actions: Action[] = [
    {
      id: 'a1',
      type: 'launchApp',
      duration: 1.3,
      startMode: 'after-previous',
      easing: 'easeOutCubic',
      sfx: '',
      iconAssetId: 'appicon',
      wallpaper: { kind: 'gradient', from: '#2B2F77', to: '#171A3D' },
      iconPosition: { x: 0.5, y: 0.42 },
    },
    {
      id: 'a2',
      type: 'loading',
      duration: 1.0,
      startMode: 'after-previous',
      easing: 'easeOutBack',
      sfx: '',
      style: 'splash',
      logoAssetId: 'appicon',
    },
    {
      id: 'a3',
      type: 'showScreen',
      duration: 0.6,
      startMode: 'after-previous',
      easing: 'easeInOutCubic',
      sfx: '',
      screenId: 'menu',
      transition: 'fade',
    },
    {
      id: 'a4',
      type: 'scroll',
      duration: 1.4,
      startMode: 'after-previous',
      easing: 'easeInOutCubic',
      sfx: '',
      from: 0,
      to: 0.62,
      overshoot: true,
    },
    {
      id: 'a5',
      type: 'tap',
      duration: 0.9,
      startMode: 'after-previous',
      easing: 'easeOutCubic',
      sfx: '',
      x: 0.5,
      y: 0.633,
      press: 'both',
    },
    {
      id: 'a6',
      type: 'showScreen',
      duration: 0.7,
      startMode: 'after-previous',
      easing: 'easeInOutCubic',
      sfx: '',
      screenId: 'cart',
      transition: 'modal',
    },
    {
      id: 'a7',
      type: 'tap',
      duration: 0.8,
      startMode: 'after-previous',
      easing: 'easeOutCubic',
      sfx: '',
      x: 0.5,
      y: 0.86,
      press: 'ripple',
    },
    {
      id: 'a8',
      type: 'successCheck',
      duration: 1.1,
      startMode: 'after-previous',
      easing: 'easeOutBack',
      sfx: '',
      x: 0.5,
      y: 0.5,
    },
    {
      id: 'a9',
      type: 'showScreen',
      duration: 0.6,
      startMode: 'after-previous',
      easing: 'easeInOutCubic',
      sfx: '',
      screenId: 'map',
      transition: 'fade',
    },
    {
      id: 'a10',
      type: 'sprite',
      duration: 2.6,
      startMode: 'after-previous',
      easing: 'easeInOutCubic',
      sfx: '',
      spriteId: 'scooter1',
    },
    {
      id: 'a11',
      type: 'notification',
      duration: 2.4,
      startMode: 'after-previous',
      easing: 'easeOutBack',
      sfx: '',
      title: 'Dash',
      body: 'Your order has arrived!',
    },
    {
      id: 'a12',
      type: 'iconAnim',
      duration: 1.0,
      startMode: 'with-previous',
      easing: 'easeOutBack',
      sfx: '',
      x: 0.92,
      y: 0.08,
      builtIn: 'bell',
      anim: 'ring',
    },
  ];

  const sprites: Sprite[] = [
    {
      id: 'scooter1',
      source: { kind: 'builtin', name: 'scooter' },
      path: [
        { x: 0.22, y: 0.82 },
        { x: 0.4, y: 0.62 },
        { x: 0.58, y: 0.48 },
        { x: 0.72, y: 0.32 },
      ],
      size: 0.14,
      rotateAlongPath: true,
      easing: 'easeInOutCubic',
    },
  ];

  const storySlide: StorySlide = {
    kind: 'story',
    id: 1,
    style: {},
    screens: [
      { id: 'menu', assetId: 'menu' },
      { id: 'cart', assetId: 'cart' },
      { id: 'map', assetId: 'map' },
    ],
    actions,
    sprites,
    cameraMode: 'auto',
    cameraKeys: [],
    hidden: false,
  };

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
    appName: 'Dash',
    intro: { on: false, dur: 2.5, tagline: '', style: {} },
    iconAssetId: 'appicon',
    outro: { on: false, dur: 3, cta: '', button: '', small: '', style: {} },
    quality: '1080',
    ducking: true,
    motionSpeed: 100,
    scenes: [storySlide],
  };

  return { project, assets };
}
