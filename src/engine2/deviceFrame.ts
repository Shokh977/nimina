/**
 * Device frame chrome (Tier 1 must-have #1) — 6 models (island/notch/punch
 * phones, tablet, browser, card "no frame") x 6 frame colors. Ported 1:1
 * from src/engine/devices.ts + constants.ts's MODELS/FCOLORS (classic
 * engine) rather than cross-imported, so engine2 stays fully self-contained
 * once classic is eventually deleted (CLAUDE.md: "delete the classic
 * engine only after everything it did works in v2"). The pixel math is
 * unchanged from the original — same screenBox/frameColor/drawDevice
 * geometry — which is what keeps a framed screenshot visually identical to
 * classic's for the same model/color/image.
 *
 * v2 doesn't redraw this per frame the way classic's drawScene does — a
 * screenshot layer's content is static, so sceneBuilder.ts bakes this once
 * (at build time, and again on a palette change if frameColor is 'theme')
 * into an offscreen canvas and hands it to Three.js as a CanvasTexture.
 */
import type { ImageAsset } from './types';
import { roundRectPath } from './texture';

export type ModelKey = 'island' | 'notch' | 'punch' | 'tablet' | 'browser' | 'card';
export type FrameColorId = 'graphite' | 'silver' | 'titanium' | 'midnight' | 'rose' | 'theme';
type FrameCut = 'island' | 'notch' | 'punch' | 'cam' | 'browser' | 'none';

interface ModelDef {
  label: string;
  /** width / height ratio of the device. */
  ratio: number;
  /** body corner radius, as a fraction of width. */
  r: number;
  /** bezel thickness, as a fraction of width. */
  bez: number;
  /** screen corner radius, as a fraction of width. */
  sr: number;
  cut: FrameCut;
}

export const MODELS: Record<ModelKey, ModelDef> = {
  island: { label: 'Island phone', ratio: 0.486, r: 0.165, bez: 0.04, sr: 0.125, cut: 'island' },
  notch: { label: 'Notch phone', ratio: 0.486, r: 0.155, bez: 0.042, sr: 0.115, cut: 'notch' },
  punch: { label: 'Android', ratio: 0.465, r: 0.11, bez: 0.032, sr: 0.085, cut: 'punch' },
  tablet: { label: 'Tablet', ratio: 0.72, r: 0.075, bez: 0.05, sr: 0.035, cut: 'cam' },
  browser: { label: 'Browser', ratio: 1.5, r: 0.03, bez: 0, sr: 0, cut: 'browser' },
  card: { label: 'No frame', ratio: 0.486, r: 0.09, bez: 0, sr: 0.09, cut: 'none' },
};

interface FrameColorDef {
  id: FrameColorId;
  label: string;
  /** absent for the 'theme' entry, which is resolved dynamically from the
   * active palette's accent color. */
  body?: string;
  btn?: string;
  edge?: string;
  chrome?: string;
  chromeInk?: string;
}

export const FCOLORS: FrameColorDef[] = [
  { id: 'graphite', label: 'Graphite', body: '#2A2C33', btn: '#1A1C21', edge: 'rgba(255,255,255,.12)', chrome: '#2A2D34', chromeInk: '#A9AFBC' },
  { id: 'silver', label: 'Silver', body: '#DADDE2', btn: '#B9BEC6', edge: 'rgba(255,255,255,.75)', chrome: '#F1F2F5', chromeInk: '#6B7180' },
  { id: 'titanium', label: 'Titanium', body: '#B9AF9F', btn: '#9C9282', edge: 'rgba(255,255,255,.4)', chrome: '#ECE7DE', chromeInk: '#6E665A' },
  { id: 'midnight', label: 'Midnight', body: '#1F2A44', btn: '#141C30', edge: 'rgba(255,255,255,.14)', chrome: '#243150', chromeInk: '#A7B3D1' },
  { id: 'rose', label: 'Rose', body: '#E6B5B0', btn: '#D19A94', edge: 'rgba(255,255,255,.55)', chrome: '#F7E4E1', chromeInk: '#8A5B57' },
  { id: 'theme', label: 'Theme' },
];

interface FrameColorResolved {
  body: string;
  btn: string;
  edge: string;
  chrome: string;
  chromeInk: string;
}

export interface ScreenBox {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  bar?: number;
}
interface ImgRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function hexRGB(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h,
    16,
  );
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(hex: string, a: number): string {
  const [r, g, b] = hexRGB(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function shade(hex: string, amt: number): string {
  const clamp = (v: number, a = 0, b = 255) => Math.min(b, Math.max(a, v));
  const f = (v: number) => Math.round(clamp(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt));
  return (
    '#' +
    hexRGB(hex)
      .map(f)
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  );
}

/** "background-size: cover" fit of an iw x ih image into bw x bh,
 * horizontally centered, top-aligned vertically (matches classic's
 * utils.ts cover() exactly, including its asymmetric centering — a
 * screenshot's top content matters more than its bottom). */
function cover(iw: number, ih: number, bw: number, bh: number): { x: number; y: number; w: number; h: number } {
  const s = Math.max(bw / iw, bh / ih),
    w = iw * s,
    h = ih * s;
  return { x: (bw - w) / 2, y: 0, w, h };
}

function imgWH(img: ImageAsset): { w: number; h: number } {
  return 'naturalWidth' in img && img.naturalWidth ? { w: img.naturalWidth, h: img.naturalHeight } : { w: img.width, h: img.height };
}

const slug = (s: string | null | undefined) =>
  (s || 'app')
    .replace(/\*/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'app';

export function screenBox(PW: number, PH: number, model: ModelKey): ScreenBox {
  const m = MODELS[model];
  if (m.cut === 'none') return { x: -PW / 2, y: -PH / 2, w: PW, h: PH, r: PW * m.r };
  if (m.cut === 'browser') {
    const bar = PH * 0.085;
    return { x: -PW / 2, y: -PH / 2 + bar, w: PW, h: PH - bar, r: 0, bar };
  }
  const b = PW * m.bez;
  return { x: -PW / 2 + b, y: -PH / 2 + b, w: PW - 2 * b, h: PH - 2 * b, r: PW * m.sr };
}

function imgRect(img: ImageAsset, sb: { w: number; h: number }): ImgRect {
  const { w, h } = imgWH(img);
  return cover(w, h, sb.w, sb.h);
}

export function frameColor(fcolor: FrameColorId, accent: string): FrameColorResolved {
  const f = FCOLORS.find((c) => c.id === fcolor) || FCOLORS[0];
  if (f.id !== 'theme') return f as FrameColorResolved;
  return {
    body: accent,
    btn: shade(accent, -0.22),
    edge: 'rgba(255,255,255,.35)',
    chrome: shade(accent, 0.78),
    chromeInk: shade(accent, -0.55),
  };
}

/** Given the box a screenshot layer's own (unframed) plane already
 * occupies — SOURCE_W x SOURCE_H for every existing v2 template — returns
 * the full device body's pixel dimensions such that
 * `screenBox(w, h, model)` exactly reproduces that same box. This is what
 * lets a device-frame companion mesh size itself to align perfectly with
 * the existing screenshot mesh without that mesh (or any template) having
 * to change at all — inverts screenBox's bezel math above. */
export function deviceOuterSize(screenW: number, screenH: number, model: ModelKey): { w: number; h: number } {
  const m = MODELS[model];
  if (m.cut === 'none') return { w: screenW, h: screenH };
  if (m.cut === 'browser') return { w: screenW, h: screenH / 0.915 };
  const w = screenW / (1 - 2 * m.bez);
  const b = w * m.bez;
  return { w, h: screenH + 2 * b };
}

/**
 * Draws a full device frame + cover-fit screenshot into ctx, which must
 * already be translated so (0,0) is the device's center (same convention
 * classic's drawScene uses before calling this). Ported 1:1 from
 * src/engine/devices.ts's drawDevice — scroll and the story-slide
 * paint-override hook are dropped (not yet a v2 concept); everything else
 * (shadow, body, bezel, edge highlight, notch/island/punch/camera cutouts,
 * browser chrome + traffic lights + url pill) is unchanged.
 */
export function drawDevice(ctx: CanvasRenderingContext2D, img: ImageAsset | null, PW: number, PH: number, model: ModelKey, fcolor: FrameColorId, accent: string, appName: string): void {
  const m = MODELS[model],
    fc = frameColor(fcolor, accent),
    sb = screenBox(PW, PH, model);
  const shadow = () => {
    ctx.shadowColor = 'rgba(8,10,24,0.4)';
    ctx.shadowBlur = Math.max(PW, PH) * 0.06;
    ctx.shadowOffsetY = Math.max(PW, PH) * 0.03;
  };
  const rrFill = (x: number, y: number, w: number, h: number, r: number) => {
    roundRectPath(ctx, x, y, w, h, r);
  };
  const paintScreen = () => {
    ctx.fillStyle = '#0B0B0E';
    ctx.fillRect(sb.x, sb.y, sb.w, sb.h);
    if (img) {
      const r = imgRect(img, sb);
      ctx.drawImage(img as CanvasImageSource, sb.x + r.x, sb.y + r.y, r.w, r.h);
    }
    const g = ctx.createLinearGradient(sb.x, sb.y, sb.x + sb.w, sb.y + sb.h);
    g.addColorStop(0, 'rgba(255,255,255,0.10)');
    g.addColorStop(0.35, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(sb.x, sb.y, sb.w, sb.h);
  };

  if (m.cut === 'none') {
    ctx.save();
    shadow();
    rrFill(sb.x, sb.y, sb.w, sb.h, sb.r);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();
    ctx.save();
    rrFill(sb.x, sb.y, sb.w, sb.h, sb.r);
    ctx.clip();
    paintScreen();
    ctx.restore();
    return;
  }
  if (m.cut === 'browser') {
    const rad = PH * m.r;
    ctx.save();
    shadow();
    rrFill(-PW / 2, -PH / 2, PW, PH, rad);
    ctx.fillStyle = fc.chrome;
    ctx.fill();
    ctx.restore();
    ctx.save();
    rrFill(-PW / 2, -PH / 2, PW, PH, rad);
    ctx.clip();
    ctx.beginPath();
    ctx.rect(sb.x, sb.y, sb.w, sb.h);
    ctx.clip();
    paintScreen();
    ctx.restore();
    const bar = sb.bar as number,
      cy = -PH / 2 + bar / 2,
      dr = bar * 0.12;
    ['#FF5F57', '#FEBC2E', '#28C840'].forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(-PW / 2 + bar * 0.5 + i * dr * 3.2, cy, dr, 0, Math.PI * 2);
      ctx.fill();
    });
    const uw = PW * 0.42,
      uh = bar * 0.54;
    rrFill(-uw / 2, cy - uh / 2, uw, uh, uh / 2);
    ctx.fillStyle = rgba(fc.chromeInk, 0.14);
    ctx.fill();
    ctx.fillStyle = fc.chromeInk;
    ctx.font = `600 ${bar * 0.3}px Figtree, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(slug(appName) + '.app', 0, cy + bar * 0.01);
    ctx.textAlign = 'left';
    ctx.fillStyle = rgba(fc.chromeInk, 0.2);
    ctx.fillRect(-PW / 2, sb.y - 1, PW, Math.max(1, PH * 0.002));
    return;
  }

  ctx.fillStyle = fc.btn;
  if (m.cut === 'cam') {
    rrFill(PW * 0.22, -PH / 2 - PW * 0.008, PW * 0.12, PW * 0.014, PW * 0.006);
    ctx.fill();
  } else if (m.cut === 'punch') {
    rrFill(PW / 2 - PW * 0.007, -PH * 0.22, PW * 0.02, PH * 0.12, PW * 0.008);
    ctx.fill();
    rrFill(PW / 2 - PW * 0.007, -PH * 0.06, PW * 0.02, PH * 0.06, PW * 0.008);
    ctx.fill();
  } else {
    rrFill(-PW / 2 - PW * 0.013, -PH * 0.24, PW * 0.02, PH * 0.07, PW * 0.008);
    ctx.fill();
    rrFill(-PW / 2 - PW * 0.013, -PH * 0.14, PW * 0.02, PH * 0.07, PW * 0.008);
    ctx.fill();
    rrFill(PW / 2 - PW * 0.007, -PH * 0.18, PW * 0.02, PH * 0.11, PW * 0.008);
    ctx.fill();
  }
  const bodyR = PW * m.r,
    rim = PW * 0.014;
  ctx.save();
  shadow();
  rrFill(-PW / 2, -PH / 2, PW, PH, bodyR);
  ctx.fillStyle = fc.body;
  ctx.fill();
  ctx.restore();
  rrFill(-PW / 2 + rim * 0.4, -PH / 2 + rim * 0.4, PW - rim * 0.8, PH - rim * 0.8, bodyR - rim * 0.4);
  ctx.lineWidth = PW * 0.005;
  ctx.strokeStyle = fc.edge;
  ctx.stroke();
  rrFill(-PW / 2 + rim, -PH / 2 + rim, PW - rim * 2, PH - rim * 2, bodyR - rim);
  ctx.fillStyle = '#050507';
  ctx.fill();
  ctx.save();
  rrFill(sb.x, sb.y, sb.w, sb.h, sb.r);
  ctx.clip();
  paintScreen();
  ctx.restore();

  ctx.fillStyle = '#000';
  if (m.cut === 'island') {
    rrFill(-PW * 0.15, sb.y + PW * 0.035, PW * 0.3, PW * 0.085, PW * 0.0425);
    ctx.fill();
  } else if (m.cut === 'notch') {
    const nw = PW * 0.5,
      nh = PW * 0.07,
      nr = PW * 0.035,
      top = sb.y - 1;
    ctx.beginPath();
    ctx.moveTo(-nw / 2 - nr, top);
    ctx.quadraticCurveTo(-nw / 2, top, -nw / 2, top + nr * 0.8);
    ctx.lineTo(-nw / 2, top + nh - nr);
    ctx.quadraticCurveTo(-nw / 2, top + nh, -nw / 2 + nr, top + nh);
    ctx.lineTo(nw / 2 - nr, top + nh);
    ctx.quadraticCurveTo(nw / 2, top + nh, nw / 2, top + nh - nr);
    ctx.lineTo(nw / 2, top + nr * 0.8);
    ctx.quadraticCurveTo(nw / 2, top, nw / 2 + nr, top);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1A1C24';
    ctx.beginPath();
    ctx.arc(nw * 0.22, top + nh * 0.45, PW * 0.014, 0, Math.PI * 2);
    ctx.fill();
  } else if (m.cut === 'punch') {
    ctx.beginPath();
    ctx.arc(0, sb.y + PW * 0.05, PW * 0.026, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.08)';
    ctx.lineWidth = PW * 0.004;
    ctx.stroke();
  } else if (m.cut === 'cam') {
    ctx.fillStyle = '#1A1C24';
    ctx.beginPath();
    ctx.arc(0, -PH / 2 + (sb.y + PH / 2) / 2, PW * 0.009, 0, Math.PI * 2);
    ctx.fill();
  }
}
