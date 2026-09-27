/**
 * Top-level render entry point. Ported from legacy/promo-studio.html's
 * segments()/styleOf()/bgDiffers()/render(), with the prototype's global
 * `state`/`cur` replaced by explicit `project`/`style` parameters.
 */
import { drawBg } from './background';
import { FONTS, FORMATS, PRESETS } from './constants';
import { applyCamera } from './effects';
import { drawOverlays, drawWatermark } from './overlays';
import { drawIntro, drawOutro, drawScene, drawTextSlide } from './slides';
import { getStoryTimeline, renderStory } from './story';
import { layoutWords, drawWords } from './text';
import { drawTransition } from './transitions';
import type { AssetMap, IntroConfig, OutroConfig, Project, ResolvedStyle, Segment, Slide, SlideStyle, Timeline } from './types';
import { easeInOutCubic } from './utils';

function slideDuration(s: Slide, speedFactor: number): number {
  return s.kind === 'story' ? getStoryTimeline(s, speedFactor).total : s.dur / speedFactor;
}

/** Builds the flat list of timed segments (intro, each slide, outro) from a
 * project, in playback order. Hidden scenes are skipped entirely (no
 * segment, don't advance `t`) — the one place this needs handling, since
 * render()/export/the filmstrip/audio-sync all derive from this. Every
 * duration is divided by `motionSpeed/100` so the whole project stretches
 * or compresses uniformly around the same 100 = 1.0x default. */
export function getTimeline(project: Project): Timeline {
  const speedFactor = project.motionSpeed / 100;
  const list: Segment[] = [];
  let t = 0;
  if (project.intro.on) {
    const dur = project.intro.dur / speedFactor;
    list.push({ type: 'intro', owner: project.intro, start: t, dur, label: 'Intro' });
    t += dur;
  }
  project.scenes.forEach((s, i) => {
    if (s.hidden) return;
    const dur = slideDuration(s, speedFactor);
    list.push({ type: 'scene', owner: s, scene: s, start: t, dur, label: (s.kind === 'text' ? 'Aa ' : s.kind === 'story' ? '▶ ' : '') + (i + 1) });
    t += dur;
  });
  if (project.outro.on) {
    const dur = project.outro.dur / speedFactor;
    list.push({ type: 'outro', owner: project.outro, start: t, dur, label: 'End' });
    t += dur;
  }
  return { list, total: t };
}

/** Resolves a slide/intro/outro's style overrides against the project
 * defaults. `owner` is null for the "no slides yet" placeholder state. */
export function resolveStyle(project: Project, owner: { style?: SlideStyle } | IntroConfig | OutroConfig | Slide | null): ResolvedStyle {
  const o: SlideStyle = (owner && owner.style) || {};
  const has = <K extends keyof SlideStyle>(k: K): boolean => o[k] !== undefined && (o[k] as unknown) !== '' && o[k] !== null;
  return {
    colors: has('theme') ? PRESETS[Number(o.theme)] : project.colors,
    textAnim: has('textAnim') ? o.textAnim! : project.textAnim,
    hlStyle: has('hlStyle') ? o.hlStyle! : project.hlStyle,
    transition: has('transition') ? o.transition! : project.transition,
    bgPattern: has('bgPattern') ? o.bgPattern! : project.bgPattern,
    shapes: has('shapes') ? o.shapes === 'on' : project.shapes,
    textPos: has('textPos') ? o.textPos! : project.textPos,
    model: has('model') ? o.model! : project.model,
    fcolor: has('fcolor') ? o.fcolor! : project.fcolor,
  };
}

/** Whether two resolved styles would need a background crossfade between them. */
export function bgDiffers(a: ResolvedStyle, b: ResolvedStyle): boolean {
  return a.colors !== b.colors || a.bgPattern !== b.bgPattern || a.shapes !== b.shapes;
}

/**
 * Draws the project at time `t` (seconds) into `ctx`, scaled by `scale`
 * (e.g. 0.5 for a half-resolution preview, 1 for full-resolution export).
 * `assets` resolves the image ids referenced by scenes/intro/outro.
 */
export function render(ctx: CanvasRenderingContext2D, project: Project, assets: AssetMap, t: number, scale: number, options?: { watermark?: boolean }): void {
  const { w: W, h: H } = FORMATS[project.format];
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  const font = FONTS[project.font];
  const { list } = getTimeline(project);

  if (!list.length) {
    const emptyStyle = resolveStyle(project, null);
    drawBg(ctx, t, W, H, emptyStyle);
    const l = layoutWords(ctx, 'Add a screenshot to begin', W * 0.8, Math.min(W, H) * 0.06, font.name, font.h);
    drawWords(ctx, l, W / 2, H / 2 - l.height / 2, 'center', emptyStyle.colors.text, { ...emptyStyle, textAnim: 'rise' }, 10, 0, 1);
    if (options?.watermark) drawWatermark(ctx, W, H);
    return;
  }

  const styles = list.map((seg) => resolveStyle(project, seg.owner));
  let idx = list.findIndex((g) => t >= g.start && t < g.start + g.dur);
  if (idx < 0) idx = list.length - 1;
  const seg = list[idx],
    st = styles[idx];
  const local = Math.max(0, Math.min(t - seg.start, seg.dur - 0.0001));

  const prev = idx > 0 ? list[idx - 1] : null;
  if (prev && local < 0.5) {
    const ps = styles[idx - 1];
    if (bgDiffers(ps, st)) {
      drawBg(ctx, t, W, H, ps);
      ctx.globalAlpha = easeInOutCubic(local / 0.5);
      drawBg(ctx, t, W, H, st);
      ctx.globalAlpha = 1;
    } else {
      drawBg(ctx, t, W, H, st);
    }
  } else {
    drawBg(ctx, t, W, H, st);
  }

  ctx.save();
  if (seg.type === 'intro') {
    drawIntro(ctx, project, assets, st, local, seg.dur, W, H);
  } else if (seg.type === 'outro') {
    drawOutro(ctx, project, assets, st, local, seg.dur, W, H);
  } else if (seg.scene) {
    if (seg.scene.kind === 'story') {
      renderStory(ctx, project, assets, seg.scene, st, local, W, H);
    } else {
      applyCamera(ctx, seg.scene.camera, local, seg.dur, W, H);
      if (seg.scene.kind === 'text') drawTextSlide(ctx, project, seg.scene, st, local, W, H);
      else drawScene(ctx, project, assets, seg.scene, st, local, W, H);
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;

  drawTransition(ctx, t, W, H, list, styles);
  drawOverlays(ctx, t, W, H, list, project, st);
  if (options?.watermark) drawWatermark(ctx, W, H);
}
