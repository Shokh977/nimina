/**
 * Top-level entry point for story slides — the story-slide equivalent of
 * slides.ts's drawScene/drawTextSlide. Composes: device frame (reusing
 * devices.ts's drawDevice via its paintScreenOverride hook), the current
 * screen's content (with scroll offset and inter-screen transitions),
 * overlays for whichever actions are active at `local`, sprites, and the
 * auto/manual camera. Pure function of (project, assets, slide, t) — no
 * module-level state — so any frame can be rendered independently
 * (required for frame-by-frame export).
 */
import { FONTS, MODELS } from '../constants';
import { drawDevice, screenBox } from '../devices';
import type { Action, AssetMap, ImageAsset, Project, ResolvedStyle, ScreenBox, StorySlide } from '../types';
import { clamp, easeInOutCubic, easeOutCubic, rr } from '../utils';
import { resolveCamera } from './camera';
import { resolveEasing } from './easing';
import { screenPoint, screenRect } from './geometry';
import { drawSprite } from './sprites';
import {
  drawHighlightOverlay,
  drawHomeScreen,
  drawIconAnimOverlay,
  drawLoading,
  drawLongPressOverlay,
  drawNotificationOverlay,
  drawSuccessCheckOverlay,
  drawSwipeOverlay,
  drawTapOverlay,
  drawTypeTextOverlay,
} from './overlays';
import { getStoryTimeline, type StoryTimelineEntry } from './timeline';
import { resolveScreenState } from './screenState';

function resolveScreenImage(slide: StorySlide, assets: AssetMap, screenId: string | null): ImageAsset | null {
  if (!screenId) return null;
  const screen = slide.screens.find((s) => s.id === screenId);
  return screen ? (assets[screen.assetId] ?? null) : null;
}

/** Draws the current screen's content (or the from/to blend during a
 * transition) into the already-clipped screen box `sb`. */
function paintStoryScreen(
  ctx: CanvasRenderingContext2D,
  sb: ScreenBox,
  slide: StorySlide,
  assets: AssetMap,
  state: ReturnType<typeof resolveScreenState>,
  t: number,
  style: ResolvedStyle,
): void {
  ctx.fillStyle = '#0B0B0E';
  ctx.fillRect(sb.x, sb.y, sb.w, sb.h);

  // launchApp/loading's draw functions expect local time since *their own*
  // action started, not since the slide started.
  const phaseLocal = t - state.phaseStart;

  if (state.phase === 'home' && state.launchAction) {
    const iconAsset = state.launchAction.iconAssetId ? (assets[state.launchAction.iconAssetId] ?? null) : null;
    drawHomeScreen(ctx, sb, phaseLocal, state.launchAction, iconAsset, Math.min(sb.w, sb.h), style);
    return;
  }
  if (state.phase === 'loading' && state.loadingAction) {
    const logoAsset = state.loadingAction.logoAssetId ? (assets[state.loadingAction.logoAssetId] ?? null) : null;
    drawLoading(ctx, sb, t, phaseLocal, state.loadingAction, logoAsset, style);
    return;
  }
  if (state.phase !== 'screen') return;

  const toImg = resolveScreenImage(slide, assets, state.screenId);
  const fromImg = state.transition !== 'none' && state.transitionProgress < 1 ? resolveScreenImage(slide, assets, state.fromScreenId) : null;
  const p = state.transitionProgress;

  const drawFull = (img: ImageAsset, scroll: number, alpha = 1, offsetX = 0, offsetY = 0, scale = 1) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(sb.x, sb.y, sb.w, sb.h);
    ctx.clip();
    ctx.globalAlpha *= alpha;
    if (scale !== 1 || offsetX !== 0 || offsetY !== 0) {
      const cx = sb.x + sb.w / 2 + offsetX,
        cy = sb.y + sb.h / 2 + offsetY;
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.translate(-sb.x - sb.w / 2, -sb.y - sb.h / 2);
    }
    const rect = screenRect(0, 0, 1, 1, img, sb, scroll);
    // screenRect(0,0,1,1,...) gives the full cover-fit rect for this image.
    ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  };

  if (!fromImg || !toImg) {
    if (toImg) drawFull(toImg, state.scroll);
    return;
  }

  if (state.transition === 'fade') {
    drawFull(fromImg, 0, 1);
    drawFull(toImg, state.scroll, easeInOutCubic(p));
  } else if (state.transition === 'push') {
    drawFull(fromImg, 0, 1, -sb.w * easeInOutCubic(p), 0);
    drawFull(toImg, state.scroll, 1, sb.w * (1 - easeInOutCubic(p)), 0);
  } else if (state.transition === 'modal') {
    drawFull(fromImg, 0, 1);
    ctx.save();
    ctx.globalAlpha *= 0.85;
    ctx.fillStyle = '#000';
    ctx.fillRect(sb.x, sb.y, sb.w, sb.h);
    ctx.restore();
    drawFull(toImg, state.scroll, 1, 0, sb.h * (1 - easeOutCubic(p)));
  } else if (state.transition === 'zoom') {
    drawFull(fromImg, 0, 1 - p);
    drawFull(toImg, state.scroll, easeInOutCubic(p), 0, 0, 0.85 + 0.15 * easeOutCubic(p));
  } else {
    drawFull(toImg, state.scroll);
  }
}

function activeEntries(entries: StoryTimelineEntry[], local: number): StoryTimelineEntry[] {
  return entries.filter((e) => local >= e.start && local < e.end);
}

export function renderStory(ctx: CanvasRenderingContext2D, project: Project, assets: AssetMap, slide: StorySlide, style: ResolvedStyle, local: number, W: number, H: number): void {
  const timeline = getStoryTimeline(slide, project.motionSpeed / 100);
  const font = FONTS[project.font];
  const state = resolveScreenState(timeline.entries, local);
  const camera = resolveCamera(slide, timeline, local);

  // Layout: story slides have no accompanying caption text (unlike
  // image/text slides), so the phone is simply centered and large.
  const PH = H * 0.82;
  let PW = PH * MODELS[style.model].ratio;
  const maxW = W * 0.86;
  if (PW > maxW) PW = maxW;
  const deviceCx = W / 2,
    deviceCy = H / 2;

  const sb = screenBox(PW, PH, style.model);
  const currentImg = state.phase === 'screen' ? resolveScreenImage(slide, assets, state.screenId) : null;
  let fx = 0,
    fy = 0;
  if (currentImg) {
    const target = screenPoint(camera.target.x, camera.target.y, currentImg, sb, state.scroll);
    fx = target.x;
    fy = target.y;
  }
  const zoom = camera.zoom;
  const px = deviceCx - fx * (zoom - 1);
  const py = deviceCy - fy * (zoom - 1);

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(camera.rotation);
  ctx.scale(zoom, zoom);

  drawDevice(ctx, currentImg, PW, PH, style, project.appName, state.scroll, (c, box) => paintStoryScreen(c, box, slide, assets, state, local, style));

  // Overlays for whichever actions are active right now, clipped to the screen.
  ctx.save();
  rr(ctx, sb.x, sb.y, sb.w, sb.h, sb.r);
  ctx.clip();
  for (const entry of activeEntries(timeline.entries, local)) {
    drawActionOverlay(ctx, entry, local, sb, currentImg, state.scroll, assets, style, font);
  }
  // Sprites are drawn above overlays but still confined to the screen.
  for (const entry of activeEntries(timeline.entries, local)) {
    const action = entry.action;
    if (action.type !== 'sprite') continue;
    const sprite = slide.sprites.find((s) => s.id === action.spriteId);
    if (!sprite) continue;
    const rawU = clamp((local - entry.start) / Math.max(0.0001, entry.end - entry.start));
    const u = resolveEasing(sprite.easing)(rawU);
    drawSprite(ctx, sprite, u, sb, assets, style);
  }
  ctx.restore();

  ctx.restore();
}

function drawActionOverlay(
  ctx: CanvasRenderingContext2D,
  entry: StoryTimelineEntry,
  t: number,
  sb: ScreenBox,
  img: ImageAsset | null,
  scroll: number,
  assets: AssetMap,
  style: ResolvedStyle,
  font: { name: string; h: number; s: number },
): void {
  const a: Action = entry.action;
  const local = t - entry.start;
  const screenSize = Math.min(sb.w, sb.h);

  if (a.type === 'tap' && img) drawTapOverlay(ctx, screenPoint(a.x, a.y, img, sb, scroll), local, a, screenSize, style.colors.accent);
  else if (a.type === 'longPress' && img) drawLongPressOverlay(ctx, screenPoint(a.x, a.y, img, sb, scroll), local, a, screenSize, style.colors.accent);
  else if (a.type === 'swipe' && img) drawSwipeOverlay(ctx, screenPoint(a.from.x, a.from.y, img, sb, scroll), screenPoint(a.to.x, a.to.y, img, sb, scroll), local, a, screenSize);
  else if (a.type === 'typeText' && img) {
    const rect = screenRect(a.x, a.y, a.width, 0, img, sb, scroll);
    drawTypeTextOverlay(ctx, rect, local, a, screenSize, style);
  } else if (a.type === 'highlight' && img) {
    const rect = screenRect(a.x, a.y, a.w, a.h, img, sb, scroll);
    drawHighlightOverlay(ctx, rect, sb, local, a, style);
  } else if (a.type === 'notification') {
    const iconAsset = a.iconAssetId ? (assets[a.iconAssetId] ?? null) : null;
    drawNotificationOverlay(ctx, sb, local, a, iconAsset, screenSize, font);
  } else if (a.type === 'iconAnim' && img) {
    drawIconAnimOverlay(ctx, screenPoint(a.x, a.y, img, sb, scroll), local, a, screenSize, style);
  } else if (a.type === 'successCheck' && img) {
    drawSuccessCheckOverlay(ctx, screenPoint(a.x, a.y, img, sb, scroll), local, a, screenSize, style);
  }
}
