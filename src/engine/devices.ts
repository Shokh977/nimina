/**
 * Device frame geometry/drawing, on-screen gesture indicators, badges and
 * callouts. Ported from legacy/promo-studio.html's
 * screenBox/imgRect/frameColor/drawDevice/focusLocal/drawGesture/
 * drawBadge/drawCallout.
 */
import { FCOLORS, MODELS } from './constants';
import type { FontDef, FrameColorId, FrameColorResolved, ImageAsset, ImgRect, ModelKey, ResolvedStyle, ScreenBox, ImageSlide } from './types';
import { clamp, cover, easeInOutCubic, easeOutBack, easeOutCubic, fontStr, imgH, imgW, rgba, rr, shade, slug } from './utils';

export function screenBox(PW: number, PH: number, model: ModelKey) {
  const m = MODELS[model];
  if (m.cut === 'none') return { x: -PW / 2, y: -PH / 2, w: PW, h: PH, r: PW * m.r };
  if (m.cut === 'browser') {
    const bar = PH * 0.085;
    return { x: -PW / 2, y: -PH / 2 + bar, w: PW, h: PH - bar, r: 0, bar };
  }
  const b = PW * m.bez;
  return { x: -PW / 2 + b, y: -PH / 2 + b, w: PW - 2 * b, h: PH - 2 * b, r: PW * m.sr };
}

export function imgRect(img: ImageAsset, sb: { w: number; h: number }, scroll = 0): ImgRect {
  const r = cover(imgW(img), imgH(img), sb.w, sb.h);
  if (scroll > 0 && r.h > sb.h) r.y = -(r.h - sb.h) * scroll;
  return r;
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

export function drawDevice(
  ctx: CanvasRenderingContext2D,
  img: ImageAsset | null,
  PW: number,
  PH: number,
  style: ResolvedStyle,
  appName: string,
  scroll = 0,
  /** Replaces the default "cover-fit `img`, with a scroll offset" screen
   * content with custom drawing — used by the story-slide renderer, which
   * needs to blend between two screens mid-transition. Receives the
   * already-computed screen box (in the same local/rotated coordinate
   * space `ctx` is currently transformed into) and must fill it. When
   * omitted, behavior is identical to before this parameter existed. */
  paintScreenOverride?: (ctx: CanvasRenderingContext2D, sb: ScreenBox) => void,
): void {
  const m = MODELS[style.model],
    fc = frameColor(style.fcolor, style.colors.accent),
    sb = screenBox(PW, PH, style.model);
  const shadow = () => {
    ctx.shadowColor = 'rgba(8,10,24,0.4)';
    ctx.shadowBlur = Math.max(PW, PH) * 0.06;
    ctx.shadowOffsetY = Math.max(PW, PH) * 0.03;
  };
  const paintScreen = () => {
    if (paintScreenOverride) {
      paintScreenOverride(ctx, sb);
      return;
    }
    ctx.fillStyle = '#0B0B0E';
    ctx.fillRect(sb.x, sb.y, sb.w, sb.h);
    if (img) {
      const r = imgRect(img, sb, scroll);
      ctx.drawImage(img, sb.x + r.x, sb.y + r.y, r.w, r.h);
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
    rr(ctx, sb.x, sb.y, sb.w, sb.h, sb.r);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();
    ctx.save();
    rr(ctx, sb.x, sb.y, sb.w, sb.h, sb.r);
    ctx.clip();
    paintScreen();
    ctx.restore();
    return;
  }
  if (m.cut === 'browser') {
    const rad = PH * m.r;
    ctx.save();
    shadow();
    rr(ctx, -PW / 2, -PH / 2, PW, PH, rad);
    ctx.fillStyle = fc.chrome;
    ctx.fill();
    ctx.restore();
    ctx.save();
    rr(ctx, -PW / 2, -PH / 2, PW, PH, rad);
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
    rr(ctx, -uw / 2, cy - uh / 2, uw, uh, uh / 2);
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
    rr(ctx, PW * 0.22, -PH / 2 - PW * 0.008, PW * 0.12, PW * 0.014, PW * 0.006);
    ctx.fill();
  } else if (m.cut === 'punch') {
    rr(ctx, PW / 2 - PW * 0.007, -PH * 0.22, PW * 0.02, PH * 0.12, PW * 0.008);
    ctx.fill();
    rr(ctx, PW / 2 - PW * 0.007, -PH * 0.06, PW * 0.02, PH * 0.06, PW * 0.008);
    ctx.fill();
  } else {
    rr(ctx, -PW / 2 - PW * 0.013, -PH * 0.24, PW * 0.02, PH * 0.07, PW * 0.008);
    ctx.fill();
    rr(ctx, -PW / 2 - PW * 0.013, -PH * 0.14, PW * 0.02, PH * 0.07, PW * 0.008);
    ctx.fill();
    rr(ctx, PW / 2 - PW * 0.007, -PH * 0.18, PW * 0.02, PH * 0.11, PW * 0.008);
    ctx.fill();
  }
  const bodyR = PW * m.r,
    rim = PW * 0.014;
  ctx.save();
  shadow();
  rr(ctx, -PW / 2, -PH / 2, PW, PH, bodyR);
  ctx.fillStyle = fc.body;
  ctx.fill();
  ctx.restore();
  rr(ctx, -PW / 2 + rim * 0.4, -PH / 2 + rim * 0.4, PW - rim * 0.8, PH - rim * 0.8, bodyR - rim * 0.4);
  ctx.lineWidth = PW * 0.005;
  ctx.strokeStyle = fc.edge;
  ctx.stroke();
  rr(ctx, -PW / 2 + rim, -PH / 2 + rim, PW - rim * 2, PH - rim * 2, bodyR - rim);
  ctx.fillStyle = '#050507';
  ctx.fill();
  ctx.save();
  rr(ctx, sb.x, sb.y, sb.w, sb.h, sb.r);
  ctx.clip();
  paintScreen();
  ctx.restore();

  ctx.fillStyle = '#000';
  if (m.cut === 'island') {
    // Deliberate deviation from legacy/promo-studio.html (confirmed
    // byte-identical there: `sb.y + PW*0.035`, height `PW*0.085`) — that
    // positioning put the pill's bottom edge ~0.12*PW below the screen
    // top, well past the status bar and into real screenshot content
    // (covering 1-2 lines of a real header, confirmed visually against
    // captured live screenshots). Pulled up to sit near sb.y like
    // notch/punch already do, and shortened so its extent (~0.07*PW below
    // sb.y) matches theirs instead of overlapping app content.
    rr(ctx, -PW * 0.15, sb.y + PW * 0.005, PW * 0.3, PW * 0.065, PW * 0.0325);
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

export function focusLocal(focus: { x: number; y: number }, img: ImageAsset, PW: number, PH: number, scroll: number, model: ModelKey) {
  const sb = screenBox(PW, PH, model),
    r = imgRect(img, sb, scroll);
  return { x: sb.x + r.x + focus.x * r.w, y: sb.y + r.y + focus.y * r.h };
}

/** Maps a normalized (0-1, 0-1, 0-1, 0-1) rect within the *full* source
 * screenshot — a CutoutLayer's `rect`, same convention as `focus` above —
 * into the local (device-centered, pre-rotation) coordinate space, sized in
 * on-screen pixels at the image's current cover-fit scale. Cutout rendering
 * (src/engine/cutouts.ts) uses this for the cutout's *rest* position; the
 * source pixels it actually samples still come from `img` at full
 * resolution, independent of this on-screen size. */
export function cutoutLocal(rect: { x: number; y: number; w: number; h: number }, img: ImageAsset, PW: number, PH: number, scroll: number, model: ModelKey) {
  const sb = screenBox(PW, PH, model),
    r = imgRect(img, sb, scroll);
  return {
    x: sb.x + r.x + rect.x * r.w,
    y: sb.y + r.y + rect.y * r.h,
    w: rect.w * r.w,
    h: rect.h * r.h,
  };
}

export function drawGesture(
  ctx: CanvasRenderingContext2D,
  scene: ImageSlide,
  img: ImageAsset | null,
  local: number,
  PW: number,
  PH: number,
  scroll: number,
  style: ResolvedStyle,
): void {
  if (!scene.gesture || scene.gesture === 'none' || !img) return;
  const f = focusLocal(scene.focus, img, PW, PH, scroll, style.model),
    gx = f.x,
    gy = f.y;
  const lt = local - scene.dur * 0.42,
    fr = Math.min(PW, PH * 0.5) * 0.075;
  const finger = (x: number, y: number, a: number, s: number) => {
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.shadowColor = 'rgba(0,0,0,.3)';
    ctx.shadowBlur = fr * 0.6;
    ctx.shadowOffsetY = fr * 0.15;
    ctx.beginPath();
    ctx.arc(x, y, fr * s, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = fr * 0.14;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.restore();
  };
  if (scene.gesture === 'tap') {
    const appear = clamp((lt + 0.35) / 0.35),
      leave = 1 - clamp((lt - 0.55) / 0.3);
    const s = lt < 0 ? 1.3 - 0.3 * easeOutCubic(appear) : lt < 0.15 ? 1 - 0.15 * (lt / 0.15) : 0.85 + 0.15 * clamp((lt - 0.15) / 0.2);
    for (let k = 0; k < 2; k++) {
      const p = clamp((lt - k * 0.15) / 0.8);
      if (p > 0 && p < 1) {
        ctx.save();
        ctx.globalAlpha *= 1 - p;
        ctx.strokeStyle = style.colors.accent;
        ctx.lineWidth = fr * 0.18;
        ctx.beginPath();
        ctx.arc(gx, gy, fr * (1 + p * 2.6), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
    finger(gx, gy, Math.min(appear, leave), s);
  } else {
    const up = scene.gesture === 'swipeUp',
      dist = up ? PH * 0.14 : PW * 0.28;
    const appear = clamp((lt + 0.3) / 0.3),
      leave = 1 - clamp((lt - 0.75) / 0.3);
    const p = easeInOutCubic(clamp(lt / 0.65));
    const sx = up ? gx : gx + dist / 2,
      sy = up ? gy + dist / 2 : gy;
    const cx = up ? sx : sx - dist * p,
      cy = up ? sy - dist * p : sy;
    if (p > 0) {
      const g = ctx.createLinearGradient(sx, sy, cx, cy);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(255,255,255,0.6)');
      ctx.save();
      ctx.globalAlpha *= Math.min(appear, leave);
      ctx.strokeStyle = g;
      ctx.lineCap = 'round';
      ctx.lineWidth = fr * 1.2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(cx, cy);
      ctx.stroke();
      ctx.restore();
    }
    finger(cx, cy, Math.min(appear, leave), 1);
  }
}

export function drawBadge(ctx: CanvasRenderingContext2D, text: string, size: number, rot: number, alpha: number, style: ResolvedStyle, font: FontDef): void {
  const c = style.colors;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.rotate(rot);
  ctx.font = fontStr(font.h === 400 ? 400 : 800, size, font.name);
  const w = ctx.measureText(text).width + size * 1.4,
    h = size * 1.9;
  ctx.shadowColor = 'rgba(0,0,0,.25)';
  ctx.shadowBlur = size * 0.8;
  ctx.shadowOffsetY = size * 0.25;
  rr(ctx, -w / 2, -h / 2, w, h, h / 2);
  ctx.fillStyle = c.accent;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = c.a;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, size * 0.05);
  ctx.restore();
  ctx.textAlign = 'left';
}

export function drawCallout(
  ctx: CanvasRenderingContext2D,
  text: string,
  tx: number,
  ty: number,
  local: number,
  alpha: number,
  W: number,
  H: number,
  style: ResolvedStyle,
  font: FontDef,
): void {
  const e = clamp((local - 1.0) / 0.6);
  if (e <= 0 || alpha <= 0) return;
  const c = style.colors,
    size = Math.min(W, H) * 0.036;
  ctx.font = fontStr(font.h === 400 ? 400 : 700, size, font.name);
  const bw = ctx.measureText(text).width + size * 1.5,
    bh = size * 2.1;
  const side = tx < W / 2 ? -1 : 1;
  let bx = tx + side * Math.min(W, H) * 0.26 - bw / 2;
  bx = clamp(bx, W * 0.03, W * 0.97 - bw);
  const by = clamp(ty - Math.min(W, H) * 0.16, H * 0.03, H * 0.97 - bh);
  const sx = side < 0 ? bx + bw * 0.7 : bx + bw * 0.3,
    sy = by + bh;
  const cx = (sx + tx) / 2 + side * Math.min(W, H) * 0.06,
    cy = Math.min(sy, ty) - Math.min(W, H) * 0.02;
  const q = (u: number): [number, number] => [
    (1 - u) * (1 - u) * sx + 2 * (1 - u) * u * cx + u * u * tx,
    (1 - u) * (1 - u) * sy + 2 * (1 - u) * u * cy + u * u * ty,
  ];
  const endU = 0.9 * easeInOutCubic(e);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = c.text;
  ctx.lineWidth = size * 0.16;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0,0,0,.25)';
  ctx.shadowBlur = size * 0.4;
  ctx.beginPath();
  for (let i = 0; i <= 30; i++) {
    const [x, y] = q((endU * i) / 30);
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.stroke();
  if (e >= 1) {
    const [x1, y1] = q(0.9),
      [x0, y0] = q(0.84),
      a = Math.atan2(y1 - y0, x1 - x0),
      hl = size * 0.55;
    ctx.beginPath();
    ctx.moveTo(x1 - Math.cos(a - 0.5) * hl, y1 - Math.sin(a - 0.5) * hl);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x1 - Math.cos(a + 0.5) * hl, y1 - Math.sin(a + 0.5) * hl);
    ctx.stroke();
  }
  const pop = easeOutBack(clamp((local - 1.2) / 0.45));
  if (pop > 0) {
    ctx.translate(bx + bw / 2, by + bh / 2);
    ctx.scale(pop, pop);
    rr(ctx, -bw / 2, -bh / 2, bw, bh, bh / 2);
    ctx.fillStyle = c.text;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = c.a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, size * 0.05);
  }
  ctx.restore();
  ctx.textAlign = 'left';
}
