/**
 * Per-slide layout and drawing: the image/text slide bodies, plus the intro
 * and outro cards. Ported from legacy/promo-studio.html's
 * layout/geom/neighborImg/drawIcon/drawScene/drawTextSlide/drawIntro/
 * drawOutro, and the newScene/newTextSlide factories.
 */
import { FONTS, MODELS, SLIDE_DEFAULTS } from './constants';
import { drawCutoutHollows, drawCutouts } from './cutouts';
import { calloutGeometry, drawBadge, drawCallout, drawCounter, drawDevice, drawDevice3D, drawGesture, focusLocal, formatCounterValue } from './devices';
import { drawEffect, STICKER_SPOTS } from './effects';
import { byZ, hasOverride, placeElement, textBox, type Box, type ElementKey, type ElementMap, type Parent, type TextLayer } from './elements';
import { currentTextLocale } from './locales';
import { resolveMotion3d } from './pose3d';
import { drawWords, layoutWords, textDur } from './text';
import type { AssetMap, ClassicSlide, EffectBox, Format, FontDef, ImageAsset, ImageSlide, LayoutRegion, ModelKey, Project, ResolvedStyle, Slide, TextPos, TextSlide } from './types';
import { clamp, easeInCubic, easeInOutCubic, easeOutBack, easeOutCubic, fontStr, graphemes, imgH, imgW, rgba, rr } from './utils';

/* ---------- layout ---------- */

/** Layout for the text locale being rendered (locales.ts): text sizes
 * scaled by its fontScale, and for right-to-left languages the 16:9
 * side-by-side layout mirrored — text column on the right, right-aligned,
 * device on the left. Identical to layoutRules() for the default locale. */
export function layout(W: number, H: number, format: Format, textPos: TextPos): LayoutRegion {
  const L = layoutRules(W, H, format, textPos);
  const loc = currentTextLocale();
  if (loc.fontScale !== 1) {
    L.hSize *= loc.fontScale;
    L.sSize *= loc.fontScale;
  }
  if (loc.dir === 'rtl' && L.mode === 'side') {
    // Mirror both columns; textX becomes the text column's right edge.
    L.textX = W - L.textX;
    L.cx = W - L.cx;
    L.edge = L.edge === 'left' ? 'right' : 'left';
    L.align = 'right';
  }
  return L;
}

function layoutRules(W: number, H: number, format: Format, textPos: TextPos): LayoutRegion {
  if (format === '9:16') {
    if (textPos === 'bottom') return { mode: 'stack', edge: 'bottom', textX: W / 2, textY: H * 0.725, textW: W * 0.84, hSize: W * 0.083, sSize: W * 0.04, align: 'center', PH: H * 0.6, maxW: W * 0.86, cx: W / 2, cy: H * 0.37 };
    if (textPos === 'center') return { mode: 'stack', edge: 'top', textX: W / 2, textY: H * 0.29, textW: W * 0.84, hSize: W * 0.083, sSize: W * 0.04, align: 'center', PH: H * 0.5, maxW: W * 0.86, cx: W / 2, cy: H * 0.72 };
    return { mode: 'stack', edge: 'top', textX: W / 2, textY: H * 0.075, textW: W * 0.84, hSize: W * 0.083, sSize: W * 0.04, align: 'center', PH: H * 0.6, maxW: W * 0.86, cx: W / 2, cy: H * 0.635 };
  }
  if (format === '1:1') {
    if (textPos === 'bottom') return { mode: 'stack', edge: 'bottom', textX: W / 2, textY: H * 0.7, textW: W * 0.86, hSize: W * 0.066, sSize: W * 0.033, align: 'center', PH: H * 0.92, maxW: W * 0.8, cx: W / 2, cy: H * 0.21 };
    if (textPos === 'center') return { mode: 'stack', edge: 'top', textX: W / 2, textY: H * 0.315, textW: W * 0.86, hSize: W * 0.066, sSize: W * 0.033, align: 'center', PH: H * 0.72, maxW: W * 0.8, cx: W / 2, cy: H * 0.73 };
    return { mode: 'stack', edge: 'top', textX: W / 2, textY: H * 0.065, textW: W * 0.86, hSize: W * 0.066, sSize: W * 0.033, align: 'center', PH: H * 0.92, maxW: W * 0.8, cx: W / 2, cy: H * 0.79 };
  }
  // 16:9's side-by-side layout is already vertically centered in both of
  // its existing options (textY: null, device cy: H*0.5) — the top/bottom
  // choice there is really "which side holds the text," a question
  // 'center' doesn't answer, so it falls back to the same left-text
  // arrangement as the default (non-bottom) option.
  if (textPos === 'bottom') return { mode: 'side', edge: 'right', textX: W * 0.52, textY: null, textW: W * 0.42, hSize: H * 0.095, sSize: H * 0.044, align: 'left', PH: H * 0.86, maxW: W * 0.44, cx: W * 0.27, cy: H * 0.5 };
  return { mode: 'side', edge: 'left', textX: W * 0.075, textY: null, textW: W * 0.43, hSize: H * 0.095, sSize: H * 0.044, align: 'left', PH: H * 0.86, maxW: W * 0.44, cx: W * 0.73, cy: H * 0.5 };
}

export function geom(L: LayoutRegion, model: ModelKey) {
  const m = MODELS[model];
  let PH = L.PH,
    PW = PH * m.ratio;
  if (PW > L.maxW) {
    PW = L.maxW;
    PH = PW / m.ratio;
  }
  return { PW, PH };
}

/** Fan layout: default group scale and how far the two side devices sit
 * from the center one (as a fraction of PW, by device shape). */
const FAN_SCALE = 0.88;
/** Side devices keep at least this much clear space from the canvas edge,
 * as a fraction of the canvas's short side. */
const FAN_EDGE_MARGIN = 0.04;
/** How far the spread may shrink (fraction of its default) before the
 * whole group scales down instead — below this the side devices hide
 * almost entirely behind the center one. */
const FAN_MIN_SPREAD = 0.7;

/**
 * Fan-group geometry that keeps both side devices fully on canvas with a
 * safe margin, in every format/size: the spread shrinks first, and only
 * if that isn't enough does the whole group scale down. Side devices are
 * drawn at 0.84x, rotated +/-0.11rad and offset +/-spread (drawScene), so
 * each one's horizontal half-extent is its rotated bounding box's.
 * `fk` is the group scale (FAN_SCALE unless it had to shrink).
 */
export function fanGeometry(L: LayoutRegion, model: ModelKey, W: number, H: number, PW: number, PH: number): { spread: number; fk: number } {
  const base = PW * (MODELS[model].ratio > 1 ? 0.35 : 0.64);
  const room = Math.min(L.cx, W - L.cx) - Math.min(W, H) * FAN_EDGE_MARGIN;
  const halfSide = 0.42 * PW * Math.cos(0.11) + 0.42 * PH * Math.sin(0.11);
  let fk = FAN_SCALE,
    spread = base;
  if ((spread + halfSide) * fk > room) spread = Math.max(base * FAN_MIN_SPREAD, room / fk - halfSide);
  if ((spread + halfSide) * fk > room) fk = room / (spread + halfSide);
  return { spread, fk };
}

/** Headline/subtitle layout for an image slide, plus where the block
 * starts. With `fit`, the sizes shrink (never below MIN_TEXT_FIT of the
 * layout's) until the block fits the room the layout leaves it: above the
 * device for top text, down to the canvas bottom for bottom text, the
 * canvas height for side-by-side. Used on still exports wider than their
 * layout's own video format, where width-based text sizes would otherwise
 * run into the device — the device keeps its size; the copy gives way. */
const MIN_TEXT_FIT = 0.55;
export function sceneTextLayout(ctx: CanvasRenderingContext2D, scene: ClassicSlide, L: LayoutRegion, font: FontDef, H: number, deviceTop: number, fit: boolean, wrap?: { W: number; h?: number; s?: number }) {
  // `wrap`: custom wrap widths (fractions of the canvas width W) set by
  // resizing a text element on the canvas (elements.ts).
  const hW = wrap?.h !== undefined ? wrap.h * wrap.W : L.textW;
  const sW = wrap?.s !== undefined ? wrap.s * wrap.W : L.textW;
  const lay = (k: number) => {
    const hSize = L.hSize * k;
    const hl = layoutWords(ctx, scene.headline, hW, hSize, font.name, font.h);
    const sl = scene.sub ? layoutWords(ctx, scene.sub, sW, L.sSize * k, font.name, font.s) : null;
    const gap = hSize * 0.35;
    return { hl, sl, gap, blockH: hl.height + (sl ? gap + sl.height : 0), scale: k };
  };
  let r = lay(1);
  if (fit) {
    const margin = H * 0.025;
    const room = L.mode === 'side' ? H * 0.9 : L.edge === 'top' ? deviceTop - margin - (L.textY ?? 0) : H - margin - (L.textY ?? 0);
    // Re-wrapping at a smaller size can drop a line, so shrink
    // proportionally and re-measure rather than solving in one step.
    for (let i = 0; i < 8 && r.blockH > room && r.scale > MIN_TEXT_FIT; i++) r = lay(Math.max(MIN_TEXT_FIT, r.scale * Math.min(0.97, room / r.blockH)));
  }
  return { ...r, ty: L.textY != null ? L.textY : (H - r.blockH) / 2 };
}

/* ---------- fan-layout neighbor lookup ---------- */

export function neighborImg(scenes: Slide[], scene: Slide, dir: 1 | -1, assets: AssetMap): ImageAsset | null {
  const imgOf = (s: Slide): ImageAsset | null => (s.kind !== 'story' && s.imgAssetId ? (assets[s.imgAssetId] ?? null) : null);
  const i = scenes.indexOf(scene);
  for (let k = i + dir; k >= 0 && k < scenes.length; k += dir) {
    const img = imgOf(scenes[k]);
    if (img) return img;
  }
  for (let k = i - dir; k >= 0 && k < scenes.length; k -= dir) {
    if (scenes[k] === scene) continue;
    const img = imgOf(scenes[k]);
    if (img) return img;
  }
  return imgOf(scene);
}

/* ---------- app icon bubble (intro/outro) ---------- */

export function drawIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, style: ResolvedStyle, font: FontDef, appName: string, iconImg: ImageAsset | null): void {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.28)';
  ctx.shadowBlur = size * 0.18;
  ctx.shadowOffsetY = size * 0.08;
  rr(ctx, cx - size / 2, cy - size / 2, size, size, size * 0.225);
  ctx.fillStyle = style.colors.accent;
  ctx.fill();
  ctx.restore();
  if (iconImg) {
    ctx.save();
    rr(ctx, cx - size / 2, cy - size / 2, size, size, size * 0.225);
    ctx.clip();
    const s = Math.max(size / imgW(iconImg), size / imgH(iconImg)),
      w = imgW(iconImg) * s,
      h = imgH(iconImg) * s;
    ctx.drawImage(iconImg, cx - w / 2, cy - h / 2, w, h);
    ctx.restore();
  } else {
    ctx.fillStyle = style.colors.a;
    ctx.font = fontStr(font.h, size * 0.56, font.name);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((appName.replace(/\*/g, '').trim()[0] || 'A').toUpperCase(), cx, cy + size * 0.03);
    ctx.textAlign = 'left';
  }
}

/* ---------- image / text slide bodies ---------- */

/** `fitText`: shrink the headline/subtitle to fit above the device (see
 * sceneTextLayout) — off for video, on for wide still exports. */
export function drawScene(ctx: CanvasRenderingContext2D, project: Project, assets: AssetMap, scene: ImageSlide, style: ResolvedStyle, local: number, W: number, H: number, fitText = false): void {
  const L = layout(W, H, project.format, style.textPos),
    dur = scene.dur,
    c = style.colors,
    font = FONTS[project.font];
  const ei = easeOutCubic(clamp(local / 0.8));
  const eo = easeInCubic(clamp((local - (dur - 0.45)) / 0.45));
  const fl = Math.sin(local * 1.7) * H * 0.006;
  let dx = 0,
    dy = 0,
    k = 1,
    rot = 0,
    alpha = 1,
    zp = 0,
    skew = 0;
  const enterY = L.edge === 'bottom' ? -H * 0.7 : H * 0.7;
  switch (scene.anim) {
    case 'rise':
      dy = (1 - ei) * enterY + fl - eo * H * 0.06;
      alpha = 1 - eo;
      break;
    case 'pop': {
      const p = clamp(local / 0.7);
      k = (0.6 + 0.4 * easeOutBack(p) + 0.05 * (local / dur)) * (1 - eo * 0.1);
      rot = (1 - easeOutCubic(p)) * -0.15;
      alpha = clamp(local / 0.3) * (1 - eo);
      break;
    }
    case 'slide':
      dx = (1 - ei) * W * 0.95 - eo * W * 0.95;
      rot = (1 - ei) * 0.1 - eo * 0.1;
      dy = fl;
      break;
    case 'swing':
      dx = (1 - ei) * -W * 0.6;
      rot = -0.07 * ei + (1 - ei) * -0.35 + Math.sin(local * 1.3) * 0.012;
      skew = 0.05 * ei;
      dy = fl * 1.5 - eo * H * 0.05;
      alpha = 1 - eo;
      break;
    case 'spotlight':
      dy = (1 - ei) * enterY;
      zp = easeInOutCubic(clamp((local - 0.9) / Math.max(0.6, dur * 0.4)));
      alpha = 1 - eo;
      break;
  }
  const scroll = scene.scroll ? easeInOutCubic(clamp((local - 0.9) / Math.max(0.5, dur - 1.7))) : 0;
  const { PW, PH } = geom(L, style.model);
  const fan = scene.layout === 'fan';
  const fanGeo = fan ? fanGeometry(L, style.model, W, H, PW, PH) : null;
  const fk = fanGeo ? fanGeo.fk : 1;
  const img = scene.imgAssetId ? (assets[scene.imgAssetId] ?? null) : null;
  let fx = 0,
    fy = 0;
  if (zp > 0 && img) {
    const f = focusLocal(scene.focus, img, PW, PH, scroll, style.model);
    fx = f.x * fk;
    fy = f.y * fk;
  }
  const z = 1 + 1.25 * zp;
  const px = L.cx + dx - fx * z * zp,
    py = L.cy + dy - fy * z * zp;
  const S = k * fk * z;

  const els = scene.elements ?? {};
  // Rest geometry (no animation) — the default boxes overrides apply around.
  const restS = fk * (scene.pose3d?.scale ?? 1);
  const device: Parent = { base: { cx: L.cx, cy: L.cy, w: PW * restS, h: PH * restS }, xf: els.device };
  const items: DrawItem[] = [];

  items.push({ key: 'device',
    z: 0,
    draw: () =>
      placeElement(ctx, 'device', { label: 'Device', z: 0, deletable: false }, device.base, els.device, W, H, () => {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(px, py);
        ctx.rotate(rot);
        if (skew) ctx.transform(1, skew, 0, 1, 0, 0);
        ctx.scale(S, S);
        if (fan) {
          const se = easeOutCubic(clamp((local - 0.2) / 0.8));
          const spread = fanGeo!.spread;
          (
            [
              [-1, neighborImg(project.scenes, scene, -1, assets)],
              [1, neighborImg(project.scenes, scene, 1, assets)],
            ] as Array<[number, ImageAsset | null]>
          ).forEach(([s, nImg]) => {
            ctx.save();
            ctx.globalAlpha = alpha * se;
            ctx.translate(s * spread * se, PH * 0.05 * se);
            ctx.rotate(s * 0.11 * se);
            ctx.scale(0.84, 0.84);
            drawDevice(ctx, nImg, PW, PH, style, project.appName);
            ctx.restore();
          });
        }
        if (scene.pose3d) {
          const pose = resolveMotion3d(scene.pose3d, scene.motion3d, local, dur);
          drawDevice3D(ctx, img, PW, PH, style, project.appName, scroll, pose);
        } else {
          drawDevice(ctx, img, PW, PH, style, project.appName, scroll);
        }
        drawGesture(ctx, scene, img, local, PW, PH, scroll, style);
        drawCutoutHollows(ctx, scene, img, style, local, PW, PH, scroll);
        ctx.restore();

        if (img && scene.cutouts.length) {
          ctx.save();
          ctx.globalAlpha = alpha;
          drawCutouts(ctx, scene, img, style, local, px, py, S, rot, PW, PH, scroll, W, H);
          ctx.restore();
        }
      }),
  });

  const box: EffectBox = { cx: px, cy: py, w: PW * S, h: PH * S, top: py - PH * S * 0.35 };
  if (zp < 0.5) items.push({ key: 'stickers', z: 1, draw: () => drawSlideEffect(ctx, scene, local, W, H, box, { cx: L.cx, cy: L.cy, w: PW * restS, h: PH * restS }, style, els, device) });

  if (zp > 0.05) {
    items.push({
      z: 1.5,
      draw: () =>
        followParent(ctx, device, W, H, () => {
          const wx = px + fx * z,
            wy = py + fy * z,
            r = Math.min(PW, PH * 0.5) * 0.16 * z * (1 + 0.04 * Math.sin(local * 5));
          ctx.save();
          ctx.globalAlpha = zp * alpha * 0.9;
          ctx.lineWidth = Math.max(W, H) * 0.005;
          ctx.strokeStyle = c.accent;
          ctx.beginPath();
          ctx.arc(wx, wy, r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }),
    });
  }

  if (scene.callout && img && zp < 0.3) {
    const callout = scene.callout;
    const f = focusLocal(scene.focus, img, PW, PH, scroll, style.model),
      cs = Math.cos(rot),
      sn = Math.sin(rot);
    const tx = px + (f.x * cs - f.y * sn) * S,
      ty = py + (f.x * sn + f.y * cs) * S;
    // Rest box: the bubble plus the point it aims at.
    const rtx = L.cx + f.x * fk,
      rty = L.cy + f.y * fk;
    const g = calloutGeometry(ctx, callout, rtx, rty, W, H, font);
    const x0 = Math.min(g.bx, rtx),
      x1 = Math.max(g.bx + g.bw, rtx),
      y0 = Math.min(g.by, rty),
      y1 = Math.max(g.by + g.bh, rty);
    items.push({ key: 'callout',
      z: 2,
      draw: () =>
        placeElement(
          ctx,
          'callout',
          { label: 'Callout', z: 2 },
          { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 },
          els.callout,
          W,
          H,
          () => drawCallout(ctx, callout, tx, ty, local, alpha * (1 - zp / 0.3), W, H, style, font),
          device,
        ),
    });
  }

  if (scene.badge && zp < 0.3) {
    const badge = scene.badge;
    const bsize = Math.max(Math.min(PW, PH * 0.5) * 0.085, Math.min(W, H) * 0.032);
    ctx.font = fontStr(font.h === 400 ? 400 : 800, bsize, font.name);
    const bw = ctx.measureText(badge).width + bsize * 1.4;
    const rest = { cx: L.cx + PW * 0.44 * fk, cy: L.cy - PH * 0.36 * fk, w: bw, h: bsize * 1.9 };
    items.push({ key: 'badge',
      z: 3,
      draw: () =>
        placeElement(
          ctx,
          'badge',
          { label: 'Badge', z: 3 },
          rest,
          els.badge,
          W,
          H,
          () => {
            const be = easeOutBack(clamp((local - 0.9) / 0.5));
            if (be > 0) {
              ctx.save();
              ctx.translate(px + PW * 0.44 * k * fk, py - PH * 0.36 * k * fk + Math.sin(local * 2.2) * bsize * 0.15);
              ctx.scale(be, be);
              drawBadge(ctx, badge, bsize, -0.08 + Math.sin(local * 1.8) * 0.03, alpha * (1 - zp / 0.3) * clamp(be), style, font);
              ctx.restore();
            }
          },
          device,
        ),
    });
  }

  if (scene.counter && img && zp < 0.3) {
    const counter = scene.counter;
    const f = focusLocal({ x: counter.x, y: counter.y }, img, PW, PH, scroll, style.model),
      cs = Math.cos(rot),
      sn = Math.sin(rot);
    const tx = px + (f.x * cs - f.y * sn) * S,
      ty = py + (f.x * sn + f.y * cs) * S;
    const csize = Math.min(W, H) * 0.06;
    ctx.font = fontStr(font.h, csize, font.name);
    const cw = Math.max(ctx.measureText(formatCounterValue(counter.from, counter)).width, ctx.measureText(formatCounterValue(counter.to, counter)).width);
    items.push({ key: 'counter',
      z: 4,
      draw: () =>
        placeElement(
          ctx,
          'counter',
          { label: 'Counter', z: 4 },
          { cx: L.cx + f.x * fk, cy: L.cy + f.y * fk, w: cw + csize * 0.4, h: csize * 1.25 },
          els.counter,
          W,
          H,
          () => drawCounter(ctx, counter, local, tx, ty, alpha * (1 - zp / 0.3), W, H, style, font),
          device,
        ),
    });
  }

  const { hl, sl, gap, blockH, ty } = sceneTextLayout(ctx, scene, L, font, H, L.cy - (PH * fk * (scene.pose3d?.scale ?? 1)) / 2, fitText, { W, h: els.headline?.w, s: els.sub?.w });
  if (zp > 0) {
    items.push({
      z: 4.5,
      draw: () => {
        ctx.save();
        ctx.globalAlpha = zp * 0.97;
        let g: CanvasGradient;
        if (L.edge === 'top') g = ctx.createLinearGradient(0, 0, 0, ty + blockH + H * 0.12);
        else if (L.edge === 'bottom') g = ctx.createLinearGradient(0, H, 0, ty - H * 0.12);
        else if (L.edge === 'left') g = ctx.createLinearGradient(0, 0, L.textX + L.textW + W * 0.08, 0);
        else g = ctx.createLinearGradient(W, 0, L.textX - W * 0.08, 0);
        g.addColorStop(0, c.a);
        g.addColorStop(0.75, rgba(c.a, 0.96));
        g.addColorStop(1, rgba(c.a, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      },
    });
  }
  const tA = 1 - eo;
  // A custom wrap width keeps the text block centred on its default column.
  const hx = textAnchorX(L, els.headline?.w, W);
  const sx = textAnchorX(L, els.sub?.w, W);
  items.push({ key: 'headline',
    z: 5,
    draw: () => placeElement(ctx, 'headline', { label: 'Headline', text: true, size: hl.size, z: 5 }, textBox(hl, hx, ty, L.align), els.headline, W, H, () => drawWords(ctx, hl, hx, ty, L.align, c.text, style, local, 0.2, tA)),
  });
  if (sl) {
    const sy = ty + hl.height + gap;
    items.push({ key: 'sub',
      z: 6,
      draw: () =>
        placeElement(ctx, 'sub', { label: 'Subtitle', text: true, size: sl.size, z: 6 }, textBox(sl, sx, sy, L.align), els.sub, W, H, () =>
          drawWords(ctx, sl, sx, sy, L.align, c.text, style, local, 0.3 + textDur(hl, style.textAnim), tA * 0.85, 0.035),
        ),
    });
  }
  pushTextLayers(ctx, items, scene.texts, els, font, style, local, tA, W, H, 7);

  drawItems(items, els);
}

interface DrawItem {
  z: number;
  /** The element this item draws, when it is one — its saved stacking order (elements.ts z) wins over `z`. */
  key?: ElementKey;
  draw: () => void;
}

/** Draws items bottom to top, honouring saved stacking order. */
function drawItems(items: DrawItem[], els: ElementMap) {
  for (const it of byZ(items.map((i) => (i.key && els[i.key]?.z !== undefined ? { ...i, z: els[i.key]!.z! } : i)))) it.draw();
}

/** Text x anchor for the layout's alignment, keeping a custom-width block
 * centred on the default column. */
function textAnchorX(L: LayoutRegion, w: number | undefined, W: number): number {
  if (w === undefined || L.align === 'center') return L.textX;
  const colCenter = L.align === 'left' ? L.textX + L.textW / 2 : L.textX - L.textW / 2;
  return L.align === 'left' ? colCenter - (w * W) / 2 : colCenter + (w * W) / 2;
}

/** Applies a parent's override to something that has none of its own (the
 * spotlight ring and confetti/sparkles follow the device). */
function followParent(ctx: CanvasRenderingContext2D, parent: Parent, W: number, H: number, draw: () => void) {
  if (!hasOverride(parent.xf)) return draw();
  const xf = parent.xf!;
  ctx.save();
  ctx.translate(xf.x !== undefined ? xf.x * W : parent.base.cx, xf.y !== undefined ? xf.y * H : parent.base.cy);
  ctx.rotate(((xf.r ?? 0) * Math.PI) / 180);
  ctx.scale(xf.sx ?? 1, xf.sy ?? 1);
  ctx.translate(-parent.base.cx, -parent.base.cy);
  draw();
  ctx.restore();
}

/** The slide's burst effect. Stickers are a selectable element (their rest
 * box spans the sticker spots); confetti/sparkles aren't. */
function drawSlideEffect(ctx: CanvasRenderingContext2D, scene: ClassicSlide, local: number, W: number, H: number, box: EffectBox, rest: Box, style: ResolvedStyle, els: ElementMap, parent: Parent | null) {
  if (scene.effect === 'stickers') {
    const b = stickersBox(scene, rest, W, H);
    if (b) placeElement(ctx, 'stickers', { label: 'Stickers', z: 1, sparse: true }, b, els.stickers, W, H, () => drawEffect(ctx, scene, local, W, H, box, style), parent ?? undefined);
    return;
  }
  if (parent) followParent(ctx, parent, W, H, () => drawEffect(ctx, scene, local, W, H, box, style));
  else drawEffect(ctx, scene, local, W, H, box, style);
}

/** Rest bounds of the sticker spots drawEffect uses (effects.ts). */
function stickersBox(scene: ClassicSlide, rest: Box, W: number, H: number): Box | null {
  const n = graphemes(scene.stickers || '')
    .filter((g) => g.trim())
    .slice(0, 5).length;
  if (!n) return null;
  const spots = STICKER_SPOTS.slice(0, n);
  const size = Math.min(W, H) * 0.1;
  const xs = spots.map(([ox]) => rest.cx + ox * rest.w),
    ys = spots.map(([, oy]) => rest.cy + oy * rest.h);
  const x0 = Math.min(...xs) - size * 0.6,
    x1 = Math.max(...xs) + size * 0.6,
    y0 = Math.min(...ys) - size * 0.6,
    y1 = Math.max(...ys) + size * 0.6;
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
}

/** User-added text boxes (elements.ts TextLayer): drawn like the subtitle,
 * centred on the canvas until moved. */
export function pushTextLayers(ctx: CanvasRenderingContext2D, items: DrawItem[], texts: TextLayer[] | undefined, els: ElementMap, font: FontDef, style: ResolvedStyle, local: number, alpha: number, W: number, H: number, z0: number) {
  (texts ?? []).forEach((t, i) => {
    const key = `text:${t.id}` as const;
    const xf = els[key];
    const size = t.size * Math.min(W, H) * currentTextLocale().fontScale;
    const lay = layoutWords(ctx, t.text, (xf?.w ?? 0.8) * W, size, font.name, t.weight === 'h' ? font.h : font.s);
    const y = H / 2 - lay.height / 2;
    items.push({ key: key,
      z: z0 + i,
      draw: () => placeElement(ctx, key, { label: 'Text', text: true, size: lay.size, z: z0 + i }, textBox(lay, W / 2, y, 'center'), xf, W, H, () => drawWords(ctx, lay, W / 2, y, 'center', style.colors.text, style, local, 0.3, alpha, 0.035)),
    });
  });
}

export function drawTextSlide(ctx: CanvasRenderingContext2D, project: Project, scene: TextSlide, style: ResolvedStyle, local: number, W: number, H: number): void {
  const font = FONTS[project.font],
    c = style.colors,
    dur = scene.dur,
    els = scene.elements ?? {};
  const eo = easeInCubic(clamp((local - (dur - 0.4)) / 0.4));
  const big = (project.format === '16:9' ? H * 0.13 : W * (project.format === '1:1' ? 0.1 : 0.12)) * currentTextLocale().fontScale;
  const hl = layoutWords(ctx, scene.headline, (els.headline?.w ?? 0.84) * W, big, font.name, font.h);
  const sl = scene.sub ? layoutWords(ctx, scene.sub, (els.sub?.w ?? 0.78) * W, big * 0.36, font.name, font.s) : null;
  const gap = big * 0.4,
    blockH = hl.height + (sl ? gap + sl.height : 0);
  const y = (H - blockH) / 2 - eo * H * 0.03;
  const restY = (H - blockH) / 2;
  const effBox: EffectBox = { cx: W / 2, cy: H / 2, w: Math.min(W, H) * 0.8, h: blockH * 1.6 + Math.min(W, H) * 0.2, top: y };
  const items: DrawItem[] = [
    { key: 'stickers', z: 1, draw: () => drawSlideEffect(ctx, scene, local, W, H, effBox, { cx: effBox.cx, cy: effBox.cy, w: effBox.w, h: effBox.h }, style, els, null) },
    { key: 'headline', z: 5, draw: () => placeElement(ctx, 'headline', { label: 'Headline', text: true, size: hl.size, z: 5 }, textBox(hl, W / 2, restY, 'center'), els.headline, W, H, () => drawWords(ctx, hl, W / 2, y, 'center', c.text, style, local, 0.15, 1 - eo, 0.08)) },
  ];
  if (sl)
    items.push({ key: 'sub',
      z: 6,
      draw: () =>
        placeElement(ctx, 'sub', { label: 'Subtitle', text: true, size: sl.size, z: 6 }, textBox(sl, W / 2, restY + hl.height + gap, 'center'), els.sub, W, H, () =>
          drawWords(ctx, sl, W / 2, y + hl.height + gap, 'center', c.text, style, local, 0.3 + textDur(hl, style.textAnim, 0.08), (1 - eo) * 0.85, 0.035),
        ),
    });
  pushTextLayers(ctx, items, scene.texts, els, font, style, local, 1 - eo, W, H, 7);
  drawItems(items, els);
}

/* ---------- intro / outro ---------- */

export function drawIntro(ctx: CanvasRenderingContext2D, project: Project, assets: AssetMap, style: ResolvedStyle, local: number, dur: number, W: number, H: number): void {
  const c = style.colors,
    font = FONTS[project.font],
    els = project.intro.elements ?? {};
  const eo = easeInCubic(clamp((local - (dur - 0.4)) / 0.4)),
    a = 1 - eo;
  const m = Math.min(W, H),
    size = m * 0.24;
  const nameSize = (project.format === '16:9' ? H * 0.11 : W * (project.format === '1:1' ? 0.085 : 0.1)) * currentTextLocale().fontScale;
  const tagSize = nameSize * 0.42;
  const nl = layoutWords(ctx, project.appName || 'Your app', (els.headline?.w ?? 0.84) * W, nameSize, font.name, font.h);
  const tl = project.intro.tagline ? layoutWords(ctx, project.intro.tagline, (els.sub?.w ?? 0.8) * W, tagSize, font.name, font.s) : null;
  const blockH = size * 1.28 + nl.height + (tl ? tagSize * 0.5 + tl.height : 0);
  const restY = (H - blockH) / 2;
  const y0 = restY - eo * H * 0.03;
  const iconImg = project.iconAssetId ? (assets[project.iconAssetId] ?? null) : null;
  const ny = y0 + size * 1.28,
    ty = ny + nl.height + tagSize * 0.5;
  const items: DrawItem[] = [
    {
      key: 'logo',
      z: 0,
      draw: () =>
        placeElement(ctx, 'logo', { label: 'App icon', z: 0, deletable: false }, { cx: W / 2, cy: restY + size / 2, w: size, h: size }, els.logo, W, H, () => {
          ctx.save();
          ctx.globalAlpha = a;
          ctx.translate(W / 2, y0 + size / 2);
          const pop = Math.max(0.001, easeOutBack(clamp(local / 0.65)));
          ctx.scale(pop, pop);
          ctx.rotate((1 - clamp(local / 0.65)) * -0.3);
          drawIcon(ctx, 0, 0, size, style, font, project.appName, iconImg);
          ctx.restore();
        }),
    },
    { key: 'headline', z: 5, draw: () => placeElement(ctx, 'headline', { label: 'App name', text: true, size: nl.size, z: 5, deletable: false }, textBox(nl, W / 2, restY + size * 1.28, 'center'), els.headline, W, H, () => drawWords(ctx, nl, W / 2, ny, 'center', c.text, style, local, 0.35, a)) },
  ];
  if (tl)
    items.push({ key: 'sub',
      z: 6,
      draw: () =>
        placeElement(ctx, 'sub', { label: 'Tagline', text: true, size: tl.size, z: 6 }, textBox(tl, W / 2, restY + size * 1.28 + nl.height + tagSize * 0.5, 'center'), els.sub, W, H, () =>
          drawWords(ctx, tl, W / 2, ty, 'center', c.text, style, local, 0.45 + textDur(nl, style.textAnim), a * 0.9, 0.04),
        ),
    });
  pushTextLayers(ctx, items, project.intro.texts, els, font, style, local, a, W, H, 7);
  drawItems(items, els);
}

export function drawOutro(ctx: CanvasRenderingContext2D, project: Project, assets: AssetMap, style: ResolvedStyle, local: number, dur: number, W: number, H: number): void {
  const c = style.colors,
    font = FONTS[project.font],
    o = project.outro,
    els = o.elements ?? {};
  const m = Math.min(W, H),
    size = m * 0.17;
  const hSize = (project.format === '16:9' ? H * 0.09 : W * (project.format === '1:1' ? 0.07 : 0.082)) * currentTextLocale().fontScale;
  const bSize = hSize * 0.42,
    smSize = hSize * 0.3;
  const hl = layoutWords(ctx, o.cta, (els.headline?.w ?? 0.82) * W, hSize, font.name, font.h);
  ctx.font = fontStr(font.h === 400 ? 400 : 700, bSize, font.name);
  const bw = ctx.measureText(o.button || '').width + bSize * 2.4,
    bh = bSize * 2.3;
  const blockH = size * 1.3 + hl.height + (o.button ? hSize * 0.55 + bh : 0) + (o.small ? smSize * 1.6 + smSize : 0);
  let y = (H - blockH) / 2;
  const iconImg = project.iconAssetId ? (assets[project.iconAssetId] ?? null) : null;
  const iconY = y;
  const items: DrawItem[] = [
    {
      key: 'logo',
      z: 0,
      draw: () =>
        placeElement(ctx, 'logo', { label: 'App icon', z: 0, deletable: false }, { cx: W / 2, cy: iconY + size / 2, w: size, h: size }, els.logo, W, H, () => {
          ctx.save();
          ctx.globalAlpha = clamp(local / 0.3);
          ctx.translate(W / 2, iconY + size / 2);
          const pop = Math.max(0.001, easeOutBack(clamp(local / 0.6)));
          ctx.scale(pop, pop);
          drawIcon(ctx, 0, 0, size, style, font, project.appName, iconImg);
          ctx.restore();
        }),
    },
  ];
  y += size * 1.3;
  const hy = y;
  items.push({ key: 'headline', z: 5, draw: () => placeElement(ctx, 'headline', { label: 'Call to action', text: true, size: hl.size, z: 5 }, textBox(hl, W / 2, hy, 'center'), els.headline, W, H, () => drawWords(ctx, hl, W / 2, hy, 'center', c.text, style, local, 0.25, 1)) });
  const after = 0.3 + textDur(hl, style.textAnim);
  y += hl.height + hSize * 0.55;
  if (o.button) {
    const by = y;
    // Drawn after the call to action, as before (z between it and the small print).
    items.push({ key: 'button',
      z: 5.5,
      draw: () =>
        placeElement(ctx, 'button', { label: 'Button', z: 5.5 }, { cx: W / 2, cy: by + bh / 2, w: bw, h: bh }, els.button, W, H, () => {
          const e = easeOutBack(clamp((local - after) / 0.5));
          const pulse = local > after + 0.8 ? 1 + 0.03 * Math.sin((local - after - 0.8) * 5) : 1;
          if (e > 0) {
            ctx.save();
            ctx.translate(W / 2, by + bh / 2);
            ctx.scale(e * pulse, e * pulse);
            ctx.shadowColor = rgba(c.accent, 0.45);
            ctx.shadowBlur = bh * 0.5;
            ctx.shadowOffsetY = bh * 0.15;
            rr(ctx, -bw / 2, -bh / 2, bw, bh, bh / 2);
            ctx.fillStyle = c.accent;
            ctx.fill();
            ctx.shadowColor = 'transparent';
            ctx.fillStyle = c.a;
            ctx.font = fontStr(font.h === 400 ? 400 : 700, bSize, font.name);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(o.button, 0, bSize * 0.04);
            ctx.restore();
            ctx.textAlign = 'left';
          }
        }),
    });
    y += bh + smSize * 1.6;
  }
  if (o.small) {
    const sl = layoutWords(ctx, o.small, (els.sub?.w ?? 0.8) * W, smSize, font.name, font.s);
    const sy = y;
    items.push({ key: 'sub', z: 6, draw: () => placeElement(ctx, 'sub', { label: 'Small print', text: true, size: sl.size, z: 6 }, textBox(sl, W / 2, sy, 'center'), els.sub, W, H, () => drawWords(ctx, sl, W / 2, sy, 'center', c.text, style, local, after + 0.3, 0.75, 0.03)) });
  }
  pushTextLayers(ctx, items, o.texts, els, font, style, local, 1, W, H, 7);
  drawItems(items, els);
}

/* ---------- slide factories ---------- */

export function createImageSlide(id: number, imgAssetId: string | null, overrides: Partial<Omit<ImageSlide, 'id' | 'kind' | 'imgAssetId'>> = {}): ImageSlide {
  return {
    id,
    kind: 'image',
    imgAssetId,
    ...SLIDE_DEFAULTS,
    focus: { ...SLIDE_DEFAULTS.focus },
    cutouts: [],
    style: {},
    ...overrides,
  };
}

export function createTextSlide(id: number, overrides: Partial<Omit<TextSlide, 'id' | 'kind' | 'imgAssetId'>> = {}): TextSlide {
  return {
    id,
    kind: 'text',
    imgAssetId: null,
    ...SLIDE_DEFAULTS,
    focus: { x: 0.5, y: 0.5 },
    headline: 'Say it *big*',
    sub: '',
    dur: 2.5,
    cutouts: [],
    style: {},
    ...overrides,
  };
}
