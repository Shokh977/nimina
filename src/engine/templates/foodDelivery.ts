/**
 * Food delivery & restaurant ordering — docs/TEMPLATE_PACK.md §"2. Food
 * delivery & restaurant ordering". Sunset palette, Island phone (rose),
 * Playful motion. Slots: menu (tall), dish-detail, cart, tracking-map.
 */
import { PRESETS } from '../constants';
import { createImageSlide, createTextSlide } from '../slides';
import type { Action, AssetMap, Project, Sprite, StorySlide } from '../types';
import { rr } from '../utils';
import type { TemplateBuildOptions, TemplateDef, TemplateSlot } from './types';

const INK = '#2B1608',
  GREY = '#8A6F5C',
  ACCENT = '#FF5A36',
  CREAM = '#FFF4EC';

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
  ctx.shadowColor = 'rgba(80,40,10,.1)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = '#fff';
  rr(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.restore();
}

function dish(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, base: string) {
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#FFE7A8');
  g.addColorStop(1, base);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Tall scrollable menu — real overflow for the story's scroll beat. */
export function makeMenuScreen(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 600;
  cv.height = 2200;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, 600, 2200);
  statusBar(ctx);
  ctx.fillStyle = INK;
  ctx.font = f(800, 52);
  ctx.fillText('Nonna Kitchen', 40, 166);
  ctx.fillStyle = GREY;
  ctx.font = f(500, 22);
  ctx.fillText('⭐ 4.8 · 20-30 min · Italian', 42, 202);

  const items: Array<[string, string, string, string]> = [
    ['Margherita pizza', 'San Marzano tomato, fior di latte', '$16.00', '#E4572E'],
    ['Truffle mushroom pizza', 'Wild mushroom, truffle oil, thyme', '$19.50', '#7A5C3E'],
    ['Spaghetti carbonara', 'Guanciale, pecorino, black pepper', '$17.00', '#F2C14E'],
    ['Garlic bread', 'Toasted focaccia, roasted garlic butter', '$5.50', '#D9A441'],
    ['Tiramisu', 'Espresso-soaked ladyfingers, mascarpone', '$8.00', '#6B4226'],
    ['Caprese salad', 'Buffalo mozzarella, basil, olive oil', '$9.50', '#5A8F4E'],
  ];
  items.forEach(([name, sub, price, col], i) => {
    const y = 260 + i * 300;
    card(ctx, 40, y, 520, 270, 30);
    dish(ctx, 300, y + 110, 92, col);
    ctx.fillStyle = INK;
    ctx.font = f(700, 30);
    ctx.textAlign = 'center';
    ctx.fillText(name, 300, y + 232);
    ctx.fillStyle = GREY;
    ctx.font = f(500, 19);
    const words = sub.split(' ');
    let line = '';
    const ly = y + 258;
    const lines: string[] = [];
    words.forEach((w) => {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > 460) {
        lines.push(line);
        line = w;
      } else line = test;
    });
    lines.push(line);
    lines.slice(0, 1).forEach((l) => ctx.fillText(l, 300, ly));
    ctx.fillStyle = ACCENT;
    ctx.font = f(800, 24);
    ctx.fillText(price, 300, y + 200);
    ctx.textAlign = 'left';
  });
  return cv;
}

/** A single dish, expanded — the story's `showScreen dish-detail` (modal)
 * beat. */
export function makeDishDetailScreen(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 600;
  cv.height = 1300;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, 600, 1300);
  dish(ctx, 300, 300, 260, '#E4572E');
  ctx.fillStyle = '#fff';
  rr(ctx, 0, 500, 600, 800, 0);
  ctx.beginPath();
  ctx.moveTo(0, 540);
  ctx.quadraticCurveTo(300, 470, 600, 540);
  ctx.lineTo(600, 1300);
  ctx.lineTo(0, 1300);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = f(800, 46);
  ctx.fillText('Margherita pizza', 46, 620);
  ctx.fillStyle = GREY;
  ctx.font = f(500, 23);
  ctx.fillText('San Marzano tomato, fior di latte,', 48, 660);
  ctx.fillText('fresh basil, extra virgin olive oil', 48, 690);
  ctx.fillStyle = ACCENT;
  ctx.font = f(800, 40);
  ctx.fillText('$16.00', 48, 758);

  ['Size: Large (14")', 'Crust: Thin & crispy', 'Add extra basil'].forEach((label, i) => {
    const y = 820 + i * 90;
    card(ctx, 46, y, 508, 70, 22);
    ctx.fillStyle = INK;
    ctx.font = f(600, 24);
    ctx.fillText(label, 72, y + 44);
    ctx.fillStyle = ACCENT;
    ctx.font = f(700, 22);
    ctx.textAlign = 'right';
    ctx.fillText('✓', 522, y + 44);
    ctx.textAlign = 'left';
  });

  ctx.fillStyle = ACCENT;
  rr(ctx, 46, 1160, 508, 100, 50);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = f(800, 28);
  ctx.textAlign = 'center';
  ctx.fillText('Add to cart · $16.00', 300, 1160 + 63);
  ctx.textAlign = 'left';
  return cv;
}

/** Cart / checkout screen. */
export function makeCartScreen(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 600;
  cv.height = 1300;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, 600, 1300);
  statusBar(ctx);
  ctx.fillStyle = INK;
  ctx.font = f(800, 52);
  ctx.fillText('Your cart', 40, 168);

  const items: Array<[string, string, string]> = [
    ['Margherita pizza', '1x', '$16.00'],
    ['Garlic bread', '1x', '$5.50'],
    ['Tiramisu', '1x', '$8.00'],
  ];
  items.forEach(([name, qty, price], i) => {
    const y = 230 + i * 120;
    card(ctx, 40, y, 520, 100, 26);
    ctx.fillStyle = INK;
    ctx.font = f(700, 26);
    ctx.fillText(name, 66, y + 42);
    ctx.fillStyle = GREY;
    ctx.font = f(500, 20);
    ctx.fillText(qty, 66, y + 74);
    ctx.fillStyle = INK;
    ctx.font = f(800, 26);
    ctx.textAlign = 'right';
    ctx.fillText(price, 520, y + 56);
    ctx.textAlign = 'left';
  });

  const totalY = 230 + items.length * 120 + 30;
  ctx.strokeStyle = '#EFD9C6';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(40, totalY);
  ctx.lineTo(560, totalY);
  ctx.stroke();
  ctx.fillStyle = GREY;
  ctx.font = f(500, 22);
  ctx.fillText('Delivery', 40, totalY + 44);
  ctx.textAlign = 'right';
  ctx.fillText('$2.99', 560, totalY + 44);
  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  ctx.font = f(800, 30);
  ctx.fillText('Total', 40, totalY + 92);
  ctx.textAlign = 'right';
  ctx.fillText('$32.49', 560, totalY + 92);
  ctx.textAlign = 'left';

  ctx.fillStyle = ACCENT;
  rr(ctx, 40, 1120, 520, 106, 53);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = f(800, 30);
  ctx.textAlign = 'center';
  ctx.fillText('Checkout · $32.49', 300, 1120 + 66);
  ctx.textAlign = 'left';
  return cv;
}

/** Live tracking map — the sprite (scooter) drives from the restaurant pin
 * to the house pin across this screen. */
export function makeTrackingMapScreen(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 600;
  cv.height = 1300;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#EFE6DC';
  ctx.fillRect(0, 0, 600, 1300);
  ctx.strokeStyle = 'rgba(43,22,8,.08)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 14; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * 100);
    ctx.lineTo(600, i * 100 - 60);
    ctx.stroke();
  }
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 90, 0);
    ctx.lineTo(i * 90 + 40, 1300);
    ctx.stroke();
  }
  ctx.fillStyle = ACCENT;
  ctx.beginPath();
  ctx.arc(600 * 0.22, 1300 * 0.82, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(600 * 0.72, 1300 * 0.32, 16, 0, Math.PI * 2);
  ctx.fill();

  card(ctx, 40, 90, 520, 150, 30);
  ctx.fillStyle = INK;
  ctx.font = f(700, 26);
  ctx.fillText('Your order is on the way', 66, 150);
  ctx.fillStyle = ACCENT;
  ctx.font = f(800, 40);
  ctx.fillText('12 min', 66, 200);
  ctx.fillStyle = GREY;
  ctx.font = f(500, 20);
  ctx.textAlign = 'right';
  ctx.fillText('Delivering to Maple St', 520, 200);
  ctx.textAlign = 'left';
  return cv;
}

export interface FoodDeliveryStrings {
  introTagline: string;
  cartHeadline: string;
  cartCallout: string;
  statementHeadline: string;
  outroCta: string;
  outroSmall: string;
}

export const DEFAULT_FOOD_DELIVERY_STRINGS: FoodDeliveryStrings = {
  introTagline: 'Dinner, *sorted*',
  cartHeadline: 'Checkout in *one tap*',
  cartCallout: 'Apple Pay & cards',
  statementHeadline: '*Hot* in 20 minutes.',
  outroCta: 'Order in *60 seconds*',
  outroSmall: 'On iPhone and Android',
};

function buildMenuStoryActions(): Action[] {
  return [
    { id: 'f1', type: 'launchApp', duration: 1.0, startMode: 'after-previous', easing: 'easeOutCubic', sfx: '', wallpaper: { kind: 'gradient', from: '#7A2B12', to: '#3D1509' }, iconPosition: { x: 0.5, y: 0.42 } },
    { id: 'f2', type: 'showScreen', duration: 0.5, startMode: 'after-previous', easing: 'easeInOutCubic', sfx: '', screenId: 'menu', transition: 'fade' },
    { id: 'f3', type: 'scroll', duration: 1.3, startMode: 'after-previous', easing: 'easeInOutCubic', sfx: '', from: 0, to: 0.55, overshoot: true },
    { id: 'f4', type: 'tap', duration: 0.7, startMode: 'after-previous', easing: 'easeOutCubic', sfx: '', x: 0.5, y: 0.62, press: 'both' },
    { id: 'f5', type: 'showScreen', duration: 0.6, startMode: 'after-previous', easing: 'easeInOutCubic', sfx: '', screenId: 'dish-detail', transition: 'modal' },
    { id: 'f6', type: 'tap', duration: 0.7, startMode: 'after-previous', easing: 'easeOutCubic', sfx: '', x: 0.5, y: 0.9, press: 'ripple' },
    { id: 'f7', type: 'notification', duration: 1.6, startMode: 'after-previous', easing: 'easeOutBack', sfx: '', title: 'Nonna Kitchen', body: 'Added to your cart' },
  ];
}

function buildTrackingStoryActions(): Action[] {
  return [
    // Establishes tracking-map as the current screen — without an initial
    // showScreen, this story slide has no screen showing at all (caught
    // visually: the map background never appeared, just a bare device
    // frame, before this fix).
    { id: 't0', type: 'showScreen', duration: 0.4, startMode: 'after-previous', easing: 'easeInOutCubic', sfx: '', screenId: 'tracking-map', transition: 'fade' },
    { id: 't1', type: 'sprite', duration: 2.2, startMode: 'after-previous', easing: 'easeInOutCubic', sfx: '', spriteId: 'scooter1' },
    { id: 't2', type: 'notification', duration: 1.8, startMode: 'after-previous', easing: 'easeOutBack', sfx: '', title: 'Nonna Kitchen', body: 'Your order has arrived!' },
    { id: 't3', type: 'iconAnim', duration: 1.0, startMode: 'with-previous', easing: 'easeOutBack', sfx: '', x: 0.92, y: 0.08, builtIn: 'bell', anim: 'ring' },
  ];
}

/**
 * `short` drops both story slides entirely, not just the marked-optional
 * text slide — two full story slides alone total ~12s even after
 * trimming, leaving no room to also hit 8-10s. Cart (with its stickers/
 * callout beat) is the one slide that reads as a complete idea on its
 * own without the story context around it. See Batch 1's write-up for
 * the measured before/after durations.
 */
function buildScenes(strings: FoodDeliveryStrings, variant: 'full' | 'short'): { scenes: Project['scenes']; slots: TemplateSlot[] } {
  let id = 1;
  const scenes: Project['scenes'] = [];
  const slots: TemplateSlot[] = [];

  const menuStory: StorySlide = {
    kind: 'story',
    id: id++,
    style: {},
    screens: [
      { id: 'menu', assetId: 'menu' },
      { id: 'dish-detail', assetId: 'dish-detail' },
    ],
    actions: buildMenuStoryActions(),
    sprites: [],
    cameraMode: 'auto',
    cameraKeys: [],
  };
  slots.push({ key: 'menu', label: 'Menu (tall)', hint: 'The full scrollable menu', targets: [{ sceneId: menuStory.id, screenId: 'menu' }] });
  slots.push({ key: 'dish-detail', label: 'Dish detail', hint: 'One dish, expanded — modal', targets: [{ sceneId: menuStory.id, screenId: 'dish-detail' }] });

  const cartSlide = createImageSlide(id++, 'cart', { headline: strings.cartHeadline, dur: 3.5, callout: strings.cartCallout, effect: 'stickers', stickers: '🍕🔥⭐', anim: 'pop' });
  slots.push({ key: 'cart', label: 'Cart', hint: 'The order summary before checkout', targets: [{ sceneId: cartSlide.id }] });

  const trackingStory: StorySlide = {
    kind: 'story',
    id: id++,
    style: {},
    screens: [{ id: 'tracking-map', assetId: 'tracking-map' }],
    actions: buildTrackingStoryActions(),
    sprites: [
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
      } as Sprite,
    ],
    cameraMode: 'auto',
    cameraKeys: [],
  };
  slots.push({ key: 'tracking-map', label: 'Tracking map', hint: 'A delivery map the scooter drives across', targets: [{ sceneId: trackingStory.id, screenId: 'tracking-map' }] });

  if (variant === 'short') {
    scenes.push(cartSlide);
    return { scenes, slots };
  }

  scenes.push(menuStory, cartSlide, trackingStory, createTextSlide(id++, { headline: strings.statementHeadline, dur: 2.2 }));
  return { scenes, slots };
}

export const FOOD_DELIVERY_TEMPLATE: TemplateDef = {
  id: 'food-delivery',
  name: 'Food delivery & restaurant ordering',
  description: 'Warm and appetite-forward — browse, order, and track a delivery in one continuous shot.',
  category: 'Food delivery',
  swatch: [PRESETS[6].a, PRESETS[6].b],
  durationSeconds: 21.7,
  build: (opts: TemplateBuildOptions = {}) => {
    const variant = opts.variant ?? 'full';
    const strings: FoodDeliveryStrings = { ...DEFAULT_FOOD_DELIVERY_STRINGS, ...(opts.strings as Partial<FoodDeliveryStrings> | undefined) };
    const { scenes, slots } = buildScenes(strings, variant);
    const project: Project = {
      format: '9:16',
      preset: 6,
      colors: { ...PRESETS[6] },
      font: 0,
      model: 'island',
      fcolor: 'rose',
      bgPattern: 'rays',
      shapes: true,
      grain: false,
      vignette: false,
      storyBars: false,
      hlStyle: 'marker',
      textPos: 'top',
      textAnim: 'letters',
      transition: 'bars',
      appName: 'Dash',
      intro: { on: true, dur: 2.2, tagline: strings.introTagline, style: {} },
      iconAssetId: null,
      outro: { on: true, dur: 3, cta: strings.outroCta, button: 'Order now', small: strings.outroSmall, style: {} },
      quality: '1080',
      music: null,
      volume: 0.8,
      ducking: true,
      scenes,
    };
    return { project, slots };
  },
  buildSampleAssets: buildFoodDeliverySampleAssets,
};

export function buildFoodDeliverySampleAssets(): AssetMap {
  return {
    menu: makeMenuScreen(),
    'dish-detail': makeDishDetailScreen(),
    cart: makeCartScreen(),
    'tracking-map': makeTrackingMapScreen(),
  };
}
