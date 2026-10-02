/**
 * Still-image (store screenshot) rendering: one slide, frozen at one
 * moment, at an arbitrary pixel size — reusing render() as-is rather than
 * a separate drawing path, so a still is pixel-for-pixel a frame of the
 * video, just laid out for a different canvas.
 *
 * Store sizes don't match the three video formats' aspect ratios, so a
 * still picks the video format whose layout rules fit it (layoutFamily —
 * every layout() value is already a fraction of W/H, which is what makes
 * that work) and renders on a logical canvas whose short side is 1080,
 * like every FORMATS entry, so absolute sizes in the drawing code keep
 * the same meaning as in the video. render() then scales that logical
 * canvas straight to the target pixel size — drawn at full resolution,
 * never rendered small and upscaled.
 */
import { FONTS, FORMATS } from '../constants';
import { localizeProject } from '../localization';
import { withTextLocale } from '../locales';
import { render, resolveStyle } from '../render';
import { fanGeometry, geom, layout, sceneTextLayout } from '../slides';
import { getStoryTimeline } from '../story';
import { layoutWords, textDur } from '../text';
import type { AssetMap, ClassicSlide, Format, Project, Slide, TextLayout } from '../types';
import { fontStr } from '../utils';
import { clamp } from '../utils';

/** Which video format's layout rules a width x height canvas uses — the
 * same three layouts format switching uses (slides.ts layout()). */
export function layoutFamily(width: number, height: number): Format {
  const r = width / height;
  if (r < 0.8) return '9:16';
  if (r > 1.25) return '16:9';
  return '1:1';
}

/** Whether a still is wider than its layout family's own video format
 * (iPad 3:4 and Android 10:16 under the 9:16 rules). Those get fitText —
 * the layout's width-based text sizes would otherwise crowd the device. */
export function isWideForFamily(width: number, height: number): boolean {
  const f = FORMATS[layoutFamily(width, height)];
  return width / height > f.w / f.h + 0.01;
}

/** Logical (pre-scale) canvas size for a still: short side 1080. */
export function stillLogicalSize(width: number, height: number): { w: number; h: number } {
  const k = 1080 / Math.min(width, height);
  return { w: width * k, h: height * k };
}

/** A slide's length in seconds at authored speed (motionSpeed ignored —
 * stills are timed against the slide's own animation, see stillProject). */
export function slideStillDuration(slide: Slide): number {
  return slide.kind === 'story' ? getStoryTimeline(slide).total : slide.dur;
}

let measureCtx: CanvasRenderingContext2D | null = null;
function getMeasureCtx(): CanvasRenderingContext2D {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d')!;
  return measureCtx;
}

/** The moment a slide's entrance animation has finished — device landed,
 * every headline/subtitle word in, badge/callout/counter/stickers shown —
 * clamped to before its exit animation starts. Timings mirror drawScene/
 * drawTextSlide/drawWords in slides.ts/text.ts (a word finishes ~0.2s
 * after textDur says the last one started). */
export function settledTime(project: Project, slide: Slide): number {
  return withTextLocale(project.renderLocale, () => settledTimeIn(project, slide));
}

function settledTimeIn(project: Project, slide: Slide): number {
  if (slide.kind === 'story') {
    const tl = getStoryTimeline(slide);
    const screens = tl.entries.filter((e) => e.action.type === 'showScreen' || e.action.type === 'launchApp' || e.action.type === 'loading');
    const t = screens.length ? screens[screens.length - 1].end + 0.1 : tl.total / 2;
    return clamp(t, 0, Math.max(0, tl.total - 0.01));
  }
  const style = resolveStyle(project, slide);
  const font = FONTS[project.font];
  const ctx = getMeasureCtx();
  // Word counts/char counts don't depend on wrap width or size, which is
  // all textDur reads.
  const hl = layoutWords(ctx, slide.headline, 1e6, 10, font.name, font.h);
  const sl = slide.sub ? layoutWords(ctx, slide.sub, 1e6, 10, font.name, font.s) : null;
  const ta = style.textAnim;

  if (slide.kind === 'text') {
    let end = 0.15 + textDur(hl, ta, 0.08) + 0.2;
    if (sl) end = Math.max(end, 0.3 + textDur(hl, ta, 0.08) + textDur(sl, ta, 0.035) + 0.2);
    return clamp(end + 0.05, 0, Math.max(0, slide.dur - 0.41));
  }

  const ends = [slide.anim === 'pop' ? 0.7 : 0.8, 0.2 + textDur(hl, ta) + 0.2];
  if (sl) ends.push(0.3 + textDur(hl, ta) + textDur(sl, ta, 0.035) + 0.2);
  if (slide.layout === 'fan') ends.push(1.0);
  if (slide.anim === 'spotlight') ends.push(0.9 + Math.max(0.6, slide.dur * 0.4));
  if (slide.badge) ends.push(1.4);
  if (slide.callout) ends.push(1.6);
  if (slide.counter) ends.push(slide.counter.at + slide.counter.duration);
  if (slide.effect === 'stickers') ends.push(1.85);
  return clamp(Math.max(...ends) + 0.05, 0, Math.max(0, slide.dur - 0.46));
}

/** The time a slide is exported at: its saved stillTime, else settledTime. */
export function stillTimeFor(project: Project, slide: Slide): number {
  const t = slide.stillTime;
  return t != null ? clamp(t, 0, slideStillDuration(slide)) : settledTime(project, slide);
}

/** A copy of `project` whose timeline is just `slideId`, starting at 0:
 * every other scene hidden (kept in the array, so the fan layout's
 * neighbor lookup still finds the real neighboring screenshots), intro/
 * outro off (no background crossfade or transition from a neighbor bleeds
 * into the still), motionSpeed 1x (t is the slide's own authored time) and
 * story progress bars off (a video-only affordance). */
export function stillProject(project: Project, slideId: number, family: Format): Project {
  return {
    ...project,
    format: family,
    motionSpeed: 100,
    storyBars: false,
    intro: { ...project.intro, on: false },
    outro: { ...project.outro, on: false },
    scenes: project.scenes.map((s) => ({ ...s, hidden: s.id !== slideId })),
  };
}

/** Draws one slide at slide-local time `t` into `ctx`, whose canvas must
 * already be `width` x `height`. */
export function renderStill(ctx: CanvasRenderingContext2D, project: Project, assets: AssetMap, slideId: number, t: number, width: number, height: number, options?: { watermark?: boolean }): void {
  const size = stillLogicalSize(width, height);
  const p = stillProject(project, slideId, layoutFamily(width, height));
  render(ctx, p, assets, t, width / size.w, { watermark: options?.watermark, size, fitText: isWideForFamily(width, height) });
}

/* ---------- crop / overlap analysis ---------- */

export type StillIssueKind = 'device-cropped' | 'fan-cropped' | 'text-overlaps-device' | 'text-overflow';
export interface StillIssue {
  kind: StillIssueKind;
  message: string;
}

/** Overflow amounts as fractions of the canvas (0 = fits). */
interface LayoutMetrics {
  device: number;
  fan: number;
  overlap: number;
  textOverflow: number;
}

function widest(l: TextLayout): number {
  return Math.max(0, ...l.lines.flatMap((ln) => ln.words.map((w) => w.w)));
}
function widestLine(l: TextLayout): number {
  return Math.max(0, ...l.lines.map((ln) => ln.width));
}

/** Resting-state geometry of a slide on a W x H canvas laid out with
 * `family`'s rules — the same layout()/geom()/layoutWords() calls
 * drawScene/drawTextSlide make, without the animation offsets. */
function measure(project: Project, slide: ClassicSlide, W: number, H: number, family: Format, fitText: boolean): LayoutMetrics {
  return withTextLocale(project.renderLocale, () => measureIn(project, slide, W, H, family, fitText));
}

function measureIn(project: Project, slide: ClassicSlide, W: number, H: number, family: Format, fitText: boolean): LayoutMetrics {
  const ctx = getMeasureCtx();
  const style = resolveStyle(project, slide);
  const font = FONTS[project.font];
  const m: LayoutMetrics = { device: 0, fan: 0, overlap: 0, textOverflow: 0 };

  if (slide.kind === 'text') {
    const big = family === '16:9' ? H * 0.13 : W * (family === '1:1' ? 0.1 : 0.12);
    const hl = layoutWords(ctx, slide.headline, W * 0.84, big, font.name, font.h);
    const sl = slide.sub ? layoutWords(ctx, slide.sub, W * 0.78, big * 0.36, font.name, font.s) : null;
    const blockH = hl.height + (sl ? big * 0.4 + sl.height : 0);
    m.textOverflow = Math.max((widest(hl) - W * 0.84) / W, sl ? (widest(sl) - W * 0.78) / W : 0, (blockH - H * 0.92) / H, 0);
    return m;
  }

  const L = layout(W, H, family, style.textPos);
  const { PW, PH } = geom(L, style.model);
  const fan = slide.layout === 'fan' ? fanGeometry(L, style.model, W, H, PW, PH) : null;
  const k = (slide.pose3d?.scale ?? 1) * (fan ? fan.fk : 1);
  const top = L.cy - (PH * k) / 2,
    bottom = L.cy + (PH * k) / 2,
    left = L.cx - (PW * k) / 2,
    right = L.cx + (PW * k) / 2;
  m.device = Math.max(-top / H, (bottom - H) / H, -left / W, (right - W) / W, 0);
  if (fan) {
    // Side devices: translated ±spread, rotated ±0.11rad, scaled 0.84 (drawScene).
    const ext = (fan.spread + 0.42 * PW * Math.cos(0.11) + 0.42 * PH * Math.sin(0.11)) * fan.fk;
    m.fan = Math.max((ext - L.cx) / W, (L.cx + ext - W) / W, 0);
  }

  const { hl, sl, blockH, ty } = sceneTextLayout(ctx, slide, L, font, H, top, fitText);
  m.textOverflow = Math.max((Math.max(widest(hl), sl ? widest(sl) : 0) - L.textW) / W, (ty + blockH - H) / H, -ty / H, 0);
  if (L.mode === 'stack') {
    m.overlap = Math.max(L.edge === 'top' ? (ty + blockH - top) / H : (bottom - ty) / H, 0);
  } else {
    const lineW = Math.max(widestLine(hl), sl ? widestLine(sl) : 0);
    // A right-aligned (RTL) column's textX is its right edge.
    const tl = L.align === 'right' ? L.textX - lineW : L.textX,
      tr = L.align === 'right' ? L.textX : L.textX + lineW;
    m.overlap = Math.max(Math.min(tr, right) - Math.max(tl, left), 0) / W;
  }
  return m;
}

const EPS = 0.004;

/**
 * Problems a still at width x height would have that the slide doesn't
 * have in the project's own video format — i.e. crops/overlaps the store
 * size *introduces*, not ones the user already designed in (the 1:1
 * layout's device deliberately runs off the bottom, for one). When the
 * store size uses a different layout family than the video, there's no
 * like-for-like baseline, so every issue is reported. Requires the
 * project's fonts to be loaded to be accurate (text is measured).
 */
export function analyzeStill(project: Project, slide: Slide, width: number, height: number): StillIssue[] {
  if (slide.kind === 'story') return [];
  const family = layoutFamily(width, height);
  const size = stillLogicalSize(width, height);
  const got = measure(project, slide, size.w, size.h, family, isWideForFamily(width, height));
  const fmt = FORMATS[project.format];
  const base = family === project.format ? measure(project, slide, fmt.w, fmt.h, family, false) : { device: 0, fan: 0, overlap: 0, textOverflow: 0 };
  const worse = (k: keyof LayoutMetrics) => got[k] > base[k] + EPS;

  const issues: StillIssue[] = [];
  if (worse('device')) issues.push({ kind: 'device-cropped', message: 'Device runs off the edge' });
  if (worse('fan')) issues.push({ kind: 'fan-cropped', message: 'Side devices are cut off' });
  if (worse('overlap')) issues.push({ kind: 'text-overlaps-device', message: 'Text overlaps the device' });
  if (worse('textOverflow')) issues.push({ kind: 'text-overflow', message: 'Text doesn’t fit' });
  return issues;
}

/* ---------- file output ---------- */

export type StillFileFormat = 'png' | 'jpg';

/** Renders one still straight at width x height and encodes it — PNG via
 * the alpha-free encoder in png.ts, JPG via the canvas encoder at
 * `quality` (0-1). */
export async function renderStillBlob(
  project: Project,
  assets: AssetMap,
  slideId: number,
  t: number,
  width: number,
  height: number,
  options: { format: StillFileFormat; quality: number; watermark: boolean },
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: options.format === 'png' });
  if (!ctx) throw new Error('Could not create a 2D canvas context.');
  renderStill(ctx, project, assets, slideId, t, width, height, { watermark: options.watermark });
  if (options.format === 'png') {
    const { encodeRgbPng } = await import('./png');
    return encodeRgbPng(ctx.getImageData(0, 0, width, height));
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', options.quality));
  if (!blob) throw new Error('The browser could not encode this image.');
  return blob;
}

/* ---------- per-language overflow ---------- */

export interface LocaleIssue {
  /** Slide id, or 'intro' / 'outro'. */
  where: number | 'intro' | 'outro';
  message: string;
}

/** Intro/outro text that won't fit: a single word wider than its line, or
 * the outro button wider than the frame. */
function measureCards(project: Project): { intro: number; outro: number } {
  return withTextLocale(project.renderLocale, () => {
    const ctx = getMeasureCtx();
    const { w: W, h: H } = FORMATS[project.format];
    const font = FONTS[project.font];
    const scale = project.renderLocale?.fontScale ?? 1;
    const nameSize = (project.format === '16:9' ? H * 0.11 : W * (project.format === '1:1' ? 0.085 : 0.1)) * scale;
    const nl = layoutWords(ctx, project.appName || 'Your app', W * 0.84, nameSize, font.name, font.h);
    const tl = project.intro.tagline ? layoutWords(ctx, project.intro.tagline, W * 0.8, nameSize * 0.42, font.name, font.s) : null;
    const intro = Math.max((widest(nl) - W * 0.84) / W, tl ? (widest(tl) - W * 0.8) / W : 0, 0);
    const hSize = (project.format === '16:9' ? H * 0.09 : W * (project.format === '1:1' ? 0.07 : 0.082)) * scale;
    const hl = layoutWords(ctx, project.outro.cta, W * 0.82, hSize, font.name, font.h);
    ctx.font = fontStr(font.h === 400 ? 400 : 700, hSize * 0.42, font.name);
    const bw = project.outro.button ? ctx.measureText(project.outro.button).width + hSize * 0.42 * 2.4 : 0;
    const outro = Math.max((widest(hl) - W * 0.82) / W, (bw - W * 0.9) / W, 0);
    return { intro, outro };
  });
}

/**
 * Text that overflows its layout in `locale` but not in the source
 * language, in the project's own video format — what a long German or
 * Russian translation tends to cause. Measured with the language's real
 * fonts (load them first: ensureProjectFonts on the localized project).
 */
export function analyzeLocale(project: Project, locale: string): LocaleIssue[] {
  const source = localizeProject(project, project.localization?.source);
  const target = localizeProject(project, locale);
  const { w: W, h: H } = FORMATS[project.format];
  const issues: LocaleIssue[] = [];
  target.scenes.forEach((s, i) => {
    if (s.kind === 'story' || s.hidden) return;
    const base = measure(source, source.scenes[i] as ClassicSlide, W, H, project.format, false);
    const got = measure(target, s, W, H, project.format, false);
    if (got.textOverflow > base.textOverflow + EPS) issues.push({ where: s.id, message: 'Text runs past its column' });
    else if (got.overlap > base.overlap + EPS) issues.push({ where: s.id, message: 'Text runs into the device' });
  });
  const b = measureCards(source),
    g = measureCards(target);
  if (project.intro.on && g.intro > b.intro + EPS) issues.push({ where: 'intro', message: 'App name or tagline too wide' });
  if (project.outro.on && g.outro > b.outro + EPS) issues.push({ where: 'outro', message: 'Call to action or button too wide' });
  return issues;
}
