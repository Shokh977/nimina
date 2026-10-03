/**
 * E-commerce & retail — docs/TEMPLATE_PACK.md §"6. E-commerce & retail".
 * Candy palette, Island phone (midnight), Bold motion.
 * Slots: shop-home (tall), product, cart, order-confirmed.
 */
import { PRESETS } from '../constants';
import { createImageSlide, createTextSlide } from '../slides';
import type { Action, AssetMap, CutoutLayer, Project, StorySlide } from '../types';
import { rr } from '../utils';
import type { TemplateBuildOptions, TemplateDef, TemplateSlot } from './types';

const INK = '#2A1030',
  GREY = '#8C7593',
  ACCENT = '#FF3E7F',
  BG = '#FFF6FA';

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
  ctx.shadowColor = 'rgba(90,10,50,.09)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = '#fff';
  rr(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.restore();
}

function productSwatch(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, '#fff');
  g.addColorStop(1, col);
  ctx.fillStyle = g;
  rr(ctx, x, y, w, h, 24);
  ctx.fill();
}

export function makeShopHomeScreen(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 600;
  cv.height = 2200;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, 600, 2200);
  statusBar(ctx);
  ctx.fillStyle = INK;
  ctx.font = f(800, 50);
  ctx.fillText('Lumen', 40, 160);
  ctx.fillStyle = ACCENT;
  rr(ctx, 40, 200, 520, 300, 30);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = f(800, 34);
  ctx.fillText('New season drop', 70, 340);
  ctx.font = f(500, 22);
  ctx.fillText('Up to 40% off', 70, 378);

  const products: Array<[string, string, string]> = [
    ['Cloud sneaker', '$88', '#FFD6E8'],
    ['Studio hoodie', '$64', '#D6E8FF'],
    ['Trail jacket', '$112', '#D6FFE8'],
    ['Everyday tote', '$46', '#FFEBD6'],
  ];
  products.forEach(([name, price, col], i) => {
    const x = 40 + (i % 2) * 268,
      y = 560 + Math.floor(i / 2) * 380;
    card(ctx, x, y, 250, 350, 28);
    productSwatch(ctx, x + 15, y + 15, 220, 220, col);
    ctx.fillStyle = INK;
    ctx.font = f(700, 24);
    ctx.fillText(name, x + 20, y + 275);
    ctx.fillStyle = ACCENT;
    ctx.font = f(800, 26);
    ctx.fillText(price, x + 20, y + 312);
  });
  return cv;
}

export function makeProductScreen(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 600;
  cv.height = 1300;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, 600, 1300);
  productSwatch(ctx, 0, 0, 600, 560, '#FFD6E8');
  card(ctx, 0, 500, 600, 800, 0);
  ctx.beginPath();
  ctx.moveTo(0, 540);
  ctx.quadraticCurveTo(300, 470, 600, 540);
  ctx.lineTo(600, 1300);
  ctx.lineTo(0, 1300);
  ctx.closePath();
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = f(800, 42);
  ctx.fillText('Cloud sneaker', 46, 620);
  ctx.fillStyle = GREY;
  ctx.font = f(500, 22);
  ctx.fillText('Knit upper, memory foam sole', 48, 656);
  ctx.fillStyle = ACCENT;
  ctx.font = f(800, 38);
  ctx.fillText('$88.00', 48, 720);

  ['Size 9', 'Color: Blush', 'Free returns within 30 days'].forEach((label, i) => {
    const y = 780 + i * 88;
    card(ctx, 46, y, 508, 68, 22);
    ctx.fillStyle = INK;
    ctx.font = f(600, 23);
    ctx.fillText(label, 72, y + 42);
  });

  ctx.fillStyle = ACCENT;
  rr(ctx, 46, 1140, 508, 100, 50);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = f(800, 28);
  ctx.textAlign = 'center';
  ctx.fillText('Add to bag · $88.00', 300, 1140 + 63);
  ctx.textAlign = 'left';
  return cv;
}

export function makeCartScreen(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 600;
  cv.height = 1300;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, 600, 1300);
  statusBar(ctx);
  ctx.fillStyle = INK;
  ctx.font = f(800, 48);
  ctx.fillText('Your bag', 40, 168);

  const items: Array<[string, string, string]> = [
    ['Cloud sneaker · 9', '1x', '$88.00'],
    ['Studio hoodie · M', '1x', '$64.00'],
  ];
  items.forEach(([name, qty, price], i) => {
    const y = 230 + i * 130;
    card(ctx, 40, y, 520, 110, 26);
    productSwatch(ctx, 60, y + 15, 80, 80, '#FFD6E8');
    ctx.fillStyle = INK;
    ctx.font = f(700, 24);
    ctx.fillText(name, 160, y + 44);
    ctx.fillStyle = GREY;
    ctx.font = f(500, 19);
    ctx.fillText(qty, 160, y + 74);
    ctx.fillStyle = INK;
    ctx.font = f(800, 24);
    ctx.textAlign = 'right';
    ctx.fillText(price, 520, y + 58);
    ctx.textAlign = 'left';
  });

  const totalY = 230 + items.length * 130 + 30;
  ctx.strokeStyle = '#F5D9E5';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(40, totalY);
  ctx.lineTo(560, totalY);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = f(800, 28);
  ctx.fillText('Total', 40, totalY + 50);
  ctx.textAlign = 'right';
  ctx.fillText('$152.00', 560, totalY + 50);
  ctx.textAlign = 'left';

  ctx.fillStyle = ACCENT;
  rr(ctx, 40, 1130, 520, 100, 50);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = f(800, 28);
  ctx.textAlign = 'center';
  ctx.fillText('Checkout · $152.00', 300, 1130 + 63);
  ctx.textAlign = 'left';
  return cv;
}

export function makeOrderConfirmedScreen(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 600;
  cv.height = 1300;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, 600, 1300);
  statusBar(ctx);
  ctx.fillStyle = 'rgba(255,62,127,.12)';
  ctx.beginPath();
  ctx.arc(300, 480, 150, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 7;
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
  ctx.fillText('Order confirmed', 300, 660);
  ctx.fillStyle = GREY;
  ctx.font = f(500, 24);
  ctx.fillText('Arriving in 3-5 business days', 300, 700);
  ctx.fillStyle = ACCENT;
  ctx.font = f(800, 34);
  ctx.fillText('$152.00', 300, 760);
  ctx.textAlign = 'left';
  return cv;
}

export interface EcommerceStrings {
  introTagline: string;
  shopHeadline: string;
  productReturns: string;
  productRating: string;
  statementHeadline: string;
  outroCta: string;
}

export const DEFAULT_ECOMMERCE_STRINGS: EcommerceStrings = {
  introTagline: 'Lumen',
  shopHeadline: 'Shop *the drop*',
  productReturns: 'Free returns',
  productRating: '⭐ 4.9',
  statementHeadline: 'New arrivals, *every week*',
  outroCta: 'Shop *now*',
};

function buildCheckoutActions(): Action[] {
  return [
    { id: 'e1', type: 'tap', duration: 0.7, startMode: 'after-previous', easing: 'easeOutCubic', sfx: '', x: 0.5, y: 0.88, press: 'both' },
    { id: 'e2', type: 'showScreen', duration: 0.5, startMode: 'after-previous', easing: 'easeInOutCubic', sfx: '', screenId: 'cart', transition: 'modal' },
    { id: 'e3', type: 'tap', duration: 0.7, startMode: 'after-previous', easing: 'easeOutCubic', sfx: '', x: 0.5, y: 0.87, press: 'ripple' },
    { id: 'e4', type: 'loading', duration: 0.6, startMode: 'after-previous', easing: 'easeOutCubic', sfx: '', style: 'spinner' },
    { id: 'e5', type: 'showScreen', duration: 0.5, startMode: 'after-previous', easing: 'easeInOutCubic', sfx: '', screenId: 'order-confirmed', transition: 'fade' },
    { id: 'e6', type: 'successCheck', duration: 1.0, startMode: 'after-previous', easing: 'easeOutBack', sfx: '', x: 0.5, y: 0.37 },
  ];
}

function buildScenes(strings: EcommerceStrings, variant: 'full' | 'short'): { scenes: Project['scenes']; slots: TemplateSlot[] } {
  let id = 1;
  const scenes: Project['scenes'] = [];
  const slots: TemplateSlot[] = [];

  const shopSlide = createImageSlide(id++, 'shop-home', { headline: strings.shopHeadline, anim: 'slide', dur: 3.2, scroll: true });
  slots.push({ key: 'shop-home', label: 'Shop home (tall)', hint: 'The storefront — a grid of products', targets: [{ sceneId: shopSlide.id }] });

  const productCutout: CutoutLayer = { id: 'product-lift', rect: { x: 0.1, y: 0.06, w: 0.8, h: 0.34 }, radius: 0.1, preset: 'popReturn', hollow: false, at: 0.3, stackIndex: 0 };
  const productSlide = createImageSlide(id++, 'product', {
    headline: 'Details *that matter*',
    anim: 'pop',
    dur: 3,
    effect: 'stickers',
    // Spec asks for two literal text stickers ("Free returns", "⭐ 4.9") —
    // the sticker system is emoji-only (up to 5 graphemes), not arbitrary
    // text, so this splits across the two fields that *do* take text:
    // `badge` for the rating, `callout` for "Free returns" below.
    stickers: '🏷️⭐',
    badge: strings.productRating,
    callout: strings.productReturns,
    focus: { x: 0.5, y: 0.16 },
    cutouts: [productCutout],
  });
  slots.push({ key: 'product', label: 'Product', hint: 'One product, expanded', targets: [{ sceneId: productSlide.id }] });

  const checkoutStory: StorySlide = {
    kind: 'story',
    id: id++,
    style: {},
    screens: [
      { id: 'cart', assetId: 'cart' },
      { id: 'order-confirmed', assetId: 'order-confirmed' },
    ],
    actions: buildCheckoutActions(),
    sprites: [],
    cameraMode: 'auto',
    cameraKeys: [],
    hidden: false,
  };
  // Story starts on the product screen (previous scene's own screenshot),
  // so it needs its own copy of that screen to tap "Add to bag" from —
  // reuses the product slot's asset rather than declaring a duplicate one.
  checkoutStory.screens.unshift({ id: 'product', assetId: 'product' });
  checkoutStory.actions.unshift({ id: 'e0', type: 'showScreen', duration: 0.01, startMode: 'after-previous', easing: 'linear', sfx: '', screenId: 'product', transition: 'none' });
  slots.push({ key: 'cart', label: 'Cart', hint: 'The bag before checkout', targets: [{ sceneId: checkoutStory.id, screenId: 'cart' }] });
  slots.push({ key: 'order-confirmed', label: 'Order confirmed', hint: 'The confirmation screen after checkout', targets: [{ sceneId: checkoutStory.id, screenId: 'order-confirmed' }] });

  if (variant === 'short') {
    scenes.push(productSlide, checkoutStory);
    return { scenes, slots };
  }

  scenes.push(shopSlide, productSlide, checkoutStory, createTextSlide(id++, { headline: strings.statementHeadline, dur: 2.2 }));
  return { scenes, slots };
}

export const ECOMMERCE_TEMPLATE: TemplateDef = {
  id: 'ecommerce',
  name: 'E-commerce & retail',
  description: 'Bold and confident — browse the drop, admire a product, check out with a shine.',
  category: 'E-commerce',
  swatch: [PRESETS[8].a, PRESETS[8].b],
  durationSeconds: 17.2,
  build: (opts: TemplateBuildOptions = {}) => {
    const variant = opts.variant ?? 'full';
    const strings: EcommerceStrings = { ...DEFAULT_ECOMMERCE_STRINGS, ...(opts.strings as Partial<EcommerceStrings> | undefined) };
    const { scenes, slots } = buildScenes(strings, variant);
    const project: Project = {
      format: '9:16',
      preset: 8,
      colors: { ...PRESETS[8] },
      font: 0,
      model: 'island',
      fcolor: 'midnight',
      bgPattern: 'rays',
      shapes: true,
      grain: false,
      vignette: false,
      storyBars: false,
      hlStyle: 'color',
      textPos: 'top',
      textAnim: 'pop',
      transition: 'bars',
      appName: strings.introTagline,
      intro: { on: variant === 'full', dur: 2, tagline: strings.introTagline, style: {} },
      iconAssetId: null,
      // Shine sweep (spec's ending flourish) adapted to sparkles — see
      // docs/TEMPLATE_PACK.md §1d: appears once, nothing else reuses it,
      // so it's a one-template flourish, not worth a dedicated effect.
      outro: { on: true, dur: 2.8, cta: strings.outroCta, button: 'Shop now', small: '', style: { transition: 'flash' } },
      quality: '1080',
      ducking: true,
      motionSpeed: 100,
      scenes,
    };
    return { project, slots };
  },
  buildSampleAssets: buildEcommerceSampleAssets,
};

export function buildEcommerceSampleAssets(): AssetMap {
  return {
    'shop-home': makeShopHomeScreen(),
    product: makeProductScreen(),
    cart: makeCartScreen(),
    'order-confirmed': makeOrderConfirmedScreen(),
  };
}
