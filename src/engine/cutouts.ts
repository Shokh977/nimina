/**
 * Cutout layers: a user-drawn rectangle on a screenshot that pops out
 * toward the camera as its own animated piece — a button, card or list
 * item "lifted" out of the screen (Prompt 3). Two draw calls, from two
 * different places in drawScene (src/engine/slides.ts), matching how
 * badge/callout/effects already split local vs. outer canvas space there:
 *
 * - `drawCutoutHollows` runs *inside* the device's local transform, clipped
 *   to the screen box (same clip drawDevice uses for the base screenshot),
 *   so the darkened "hole left behind" never spills outside the screen.
 * - `drawCutouts` runs in *outer* canvas space (after the device's
 *   transform is popped), the same space callout/badge already use, so a
 *   lifted cutout is free to move across the whole frame (fly to the side,
 *   zoom to fill most of it) instead of being confined to the device.
 *
 * Both source their pixels directly from `img` at full resolution — the
 * crop rect is computed in source-image pixels (`rect.x * imgW(img)`, ...),
 * never from an intermediate downscaled canvas — so a cutout stays sharp
 * even zoomed to fill most of the frame (zoomHero).
 */
import type { CutoutLayer, CutoutPreset, ImageAsset, ImageSlide, ModelKey, ResolvedStyle } from './types';
import { cutoutLocal, screenBox } from './devices';
import { clamp, easeInOutCubic, easeOutBack, easeOutCubic, imgH, imgW, rr } from './utils';

interface CutoutTransform {
  /** Outer-space offset from the cutout's rest center, in canvas pixels. */
  dx: number;
  dy: number;
  scaleMul: number;
  rot: number;
  opacity: number;
  /** 0 (at rest, flush with the screen) to ~1 (fully lifted) — drives
   * shadow strength and the hollow overlay's darken alpha. */
  lift: number;
  /** Extra whole-canvas dim while this cutout is a "hero" (zoomHero only). */
  dim: number;
}

const REST: CutoutTransform = { dx: 0, dy: 0, scaleMul: 1, rot: 0, opacity: 1, lift: 0, dim: 0 };

function animate(preset: CutoutPreset, lt: number, sign: 1 | -1, index: number, stackCount: number, restW: number, restH: number, restCx: number, restCy: number, W: number, H: number): CutoutTransform {
  if (lt < 0) return REST;
  switch (preset) {
    case 'liftOut': {
      const p = easeOutBack(clamp(lt / 0.6));
      return { dx: 0, dy: -restH * 0.1 * p, scaleMul: 1 + 0.22 * p, rot: 0.06 * p * sign, opacity: 1, lift: clamp(p), dim: 0 };
    }
    case 'popReturn': {
      const inP = easeOutBack(clamp(lt / 0.35));
      const outP = lt > 0.35 ? easeInOutCubic(clamp((lt - 0.35) / 0.55)) : 0;
      const p = inP * (1 - outP);
      return { dx: 0, dy: -restH * 0.14 * p, scaleMul: 1 + 0.32 * p, rot: 0.04 * p * sign, opacity: 1, lift: clamp(p), dim: 0 };
    }
    case 'flyToSide': {
      const p = easeOutCubic(clamp(lt / 0.7));
      return { dx: sign * W * 0.3 * p, dy: -restH * 0.04 * p, scaleMul: 1 + 0.16 * p, rot: sign * 0.09 * p, opacity: 1, lift: clamp(p), dim: 0 };
    }
    case 'zoomHero': {
      const p = easeOutCubic(clamp(lt / 0.7));
      const targetSize = Math.min(W, H) * 0.78;
      const restSize = Math.max(restW, restH) || 1;
      const scaleMul = 1 + (targetSize / restSize - 1) * p;
      return { dx: (W / 2 - restCx) * p, dy: (H / 2 - restCy) * p, scaleMul, rot: 0, opacity: 1, lift: clamp(p), dim: 0.6 * p };
    }
    case 'stack': {
      const p = easeOutBack(clamp(lt / 0.6));
      const centered = index - (stackCount - 1) / 2;
      return { dx: centered * restW * 0.16 * p, dy: Math.abs(centered) * restH * 0.06 * p, scaleMul: 1 + 0.1 * p - Math.abs(centered) * 0.03, rot: centered * 0.1 * p, opacity: 1, lift: clamp(p), dim: 0 };
    }
    default: {
      const never: never = preset;
      throw new Error(`unknown cutout preset: ${never}`);
    }
  }
}

/** Rest position/size of a cutout in *local* (device-centered) coordinates. */
function restLocal(cutout: CutoutLayer, img: ImageAsset, PW: number, PH: number, scroll: number, model: ModelKey) {
  return cutoutLocal(cutout.rect, img, PW, PH, scroll, model);
}

/** Inside the device's local transform, clipped to the screen box — darkens
 * (and softly blurs, via a shadow-blur trick that needs no offscreen
 * canvas) the region a lifted cutout left behind. */
export function drawCutoutHollows(ctx: CanvasRenderingContext2D, scene: ImageSlide, img: ImageAsset | null, style: ResolvedStyle, local: number, PW: number, PH: number, scroll: number): void {
  if (!img || !scene.cutouts.length) return;
  const sb = screenBox(PW, PH, style.model);
  const stackCutouts = scene.cutouts.filter((c) => c.preset === 'stack');
  ctx.save();
  rr(ctx, sb.x, sb.y, sb.w, sb.h, sb.r);
  ctx.clip();
  scene.cutouts.forEach((cutout) => {
    if (!cutout.hollow) return;
    const lt = local - cutout.at;
    const index = stackCutouts.indexOf(cutout);
    const t = animate(cutout.preset, lt, cutout.rect.x < 0.5 ? -1 : 1, index, stackCutouts.length, 0, 0, 0, 0, PW, PH);
    if (t.lift <= 0.01) return;
    const rest = restLocal(cutout, img, PW, PH, scroll, style.model);
    const radiusPx = cutout.radius * Math.min(rest.w, rest.h);
    const sx = cutout.rect.x * imgW(img),
      sy = cutout.rect.y * imgH(img),
      sw = cutout.rect.w * imgW(img),
      sh = cutout.rect.h * imgH(img);
    ctx.save();
    rr(ctx, rest.x, rest.y, rest.w, rest.h, radiusPx);
    ctx.clip();
    // Redraws this same region, blurred, directly over the sharp base
    // screenshot already painted there — a real (if modest) blur, not just
    // a flat tint, per the "darkened/blurred" ask. Sampled from the same
    // full-resolution source rect the lifted cutout itself uses.
    ctx.filter = `blur(${Math.max(2, Math.min(rest.w, rest.h) * 0.05)}px)`;
    ctx.drawImage(img, sx, sy, sw, sh, rest.x, rest.y, rest.w, rest.h);
    ctx.filter = 'none';
    ctx.fillStyle = `rgba(5,5,7,${t.lift * 0.55})`;
    ctx.fillRect(rest.x, rest.y, rest.w, rest.h);
    ctx.restore();
  });
  ctx.restore();
}

/** In outer canvas space (after the device's own transform is popped) —
 * draws each cutout's actual lifted content, sampled at full source
 * resolution, with a preset-driven pop/lift/fly/zoom/fan animation. */
export function drawCutouts(ctx: CanvasRenderingContext2D, scene: ImageSlide, img: ImageAsset | null, style: ResolvedStyle, local: number, px: number, py: number, S: number, devRot: number, PW: number, PH: number, scroll: number, W: number, H: number): void {
  if (!img || !scene.cutouts.length) return;
  const cs = Math.cos(devRot),
    sn = Math.sin(devRot);
  const stackCutouts = scene.cutouts.filter((c) => c.preset === 'stack');
  const iw = imgW(img),
    ih = imgH(img);

  scene.cutouts.forEach((cutout) => {
    const lt = local - cutout.at;
    if (lt < 0) return;
    const rest = restLocal(cutout, img, PW, PH, scroll, style.model);
    const restCxLocal = rest.x + rest.w / 2,
      restCyLocal = rest.y + rest.h / 2;
    // Rest center transformed into outer space via the device's own
    // rotate+scale, the same rotation-matrix technique drawCallout already
    // uses to place a local-space target in outer coordinates.
    const restCx = px + (restCxLocal * cs - restCyLocal * sn) * S,
      restCy = py + (restCxLocal * sn + restCyLocal * cs) * S;
    const restW = rest.w * S,
      restH = rest.h * S;
    const index = stackCutouts.indexOf(cutout);
    const sign: 1 | -1 = cutout.rect.x < 0.5 ? -1 : 1;
    const t = animate(cutout.preset, lt, sign, index, stackCutouts.length, restW, restH, restCx, restCy, W, H);
    if (t.opacity <= 0.001) return;

    if (t.dim > 0.001) {
      ctx.save();
      ctx.globalAlpha = t.dim;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    const cx = restCx + t.dx,
      cy = restCy + t.dy,
      w = restW * t.scaleMul,
      h = restH * t.scaleMul,
      radiusPx = cutout.radius * Math.min(rest.w, rest.h) * S * t.scaleMul;

    ctx.save();
    ctx.globalAlpha = t.opacity;
    ctx.translate(cx, cy);
    ctx.rotate(devRot + t.rot);
    if (t.lift > 0.01) {
      ctx.shadowColor = `rgba(8,10,24,${0.25 + 0.35 * t.lift})`;
      ctx.shadowBlur = Math.max(w, h) * (0.12 + 0.22 * t.lift);
      ctx.shadowOffsetY = Math.max(w, h) * 0.1 * t.lift;
    }
    rr(ctx, -w / 2, -h / 2, w, h, radiusPx);
    ctx.fillStyle = '#0B0B0E';
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.save();
    rr(ctx, -w / 2, -h / 2, w, h, radiusPx);
    ctx.clip();
    // Full-resolution sample: crop directly from the source image's native
    // pixels (sx/sy/sw/sh below), never from a downscaled intermediate —
    // stays sharp even blown up to fill most of the frame (zoomHero).
    const sx = cutout.rect.x * iw,
      sy = cutout.rect.y * ih,
      sw = cutout.rect.w * iw,
      sh = cutout.rect.h * ih;
    ctx.drawImage(img, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
    ctx.restore();
    ctx.restore();
  });
}
