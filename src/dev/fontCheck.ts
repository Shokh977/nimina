/**
 * Standing check that every engine font (src/engine/constants.ts FONTS)
 * really loads and is really used — in the live preview and in an actual
 * exported video. Added after the Google Fonts URL silently 400'd and every
 * font fell back to system-ui for months without any check noticing (the
 * pixel fixtures sample backgrounds/device chrome, never text).
 *
 * Per font: render a one-word text slide, take the headline's ink straight
 * from the pixels (preview canvas, and a frame decoded back from a real
 * export) and compare it with the same word drawn directly in (a) the real
 * font, (b) Figtree and (c) system-ui — the engine's fallback chain
 * (utils.ts FONT_FALLBACK). Width alone can't tell every pair apart (Space
 * Grotesk and system-ui differ by ~1%), so the comparison is glyph shape:
 * IoU of the two ink masks, each cropped to its ink box and resampled to a
 * fixed grid. Passes only if the render's mask matches (a) at >= MIN_IOU,
 * beats every fallback by >= MIN_MARGIN, and document.fonts reports the
 * face as loaded.
 *
 * Plus an uploaded font (customFonts.ts): a test file registered through
 * the same FontFace code the app uses for real uploads
 * (customFontLoader.ts registerFontFace), set as the project typeface and
 * loaded by ensureProjectFonts before the export — the same path a Pro
 * user's font takes.
 *
 * Plus one case per non-Latin script that matters most (Japanese, Arabic):
 * a localized project whose text must come out in the self-hosted Noto
 * script font (locales.ts) — not the system font the browser would pick if
 * that font failed to load.
 */
import '@/components/scriptFontLoader';
import { registerFontFace } from '@/components/customFontLoader';
import { customFontDef } from '@/engine/customFonts';
import { setCustomFontLoader } from '@/engine/fonts';
import { exportVideo } from '@/engine/export';
import { localizeProject } from '@/engine/localization';
import { SCRIPT_FAMILIES } from '@/engine/locales';
import { FONTS, FORMATS, PRESETS } from '@/engine/constants';
import { createDefaultProject } from '@/engine/project';
import { render } from '@/engine/render';
import { createTextSlide } from '@/engine/slides';
import type { CustomFontRef, FontDef, Project } from '@/engine/types';
import { FONT_FALLBACK } from '@/engine/utils';

// Short enough that the widest font (Syne 800) still fits the text slide.
const WORD = 'Rafgkty';
const SAMPLE_T = 1.0;
const MIN_IOU = 0.8;
const MIN_MARGIN = 0.08;
const GRID_W = 160,
  GRID_H = 48;

export interface FontCheckResult {
  font: string;
  weight: number;
  faceLoaded: boolean;
  /** Ink-mask IoU with each reference font (preview / export). */
  preview: Record<string, number>;
  export: Record<string, number>;
  /** Ink box of the preview render, in px. */
  ink: { w: number; h: number };
  pass: boolean;
  reason?: string;
}

interface Ink {
  w: number;
  h: number;
  grid: Uint8Array;
}

/** Near-white ink inside the middle band of `canvas` (the text slide's
 * headline sits centered; the Night preset's background never gets this
 * bright in all three channels), cropped to its bounding box and
 * resampled to a GRID_W x GRID_H mask. */
function ink(canvas: HTMLCanvasElement): Ink {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const { width } = canvas;
  const y0 = Math.floor(canvas.height * 0.3),
    bandH = Math.ceil(canvas.height * 0.4);
  const data = ctx.getImageData(0, y0, width, bandH).data;
  const on = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    return data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200;
  };
  let minX = Infinity,
    maxX = -1,
    minY = Infinity,
    maxY = -1;
  for (let y = 0; y < bandH; y++)
    for (let x = 0; x < width; x++)
      if (on(x, y)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
  const grid = new Uint8Array(GRID_W * GRID_H);
  if (maxX < 0) return { w: 0, h: 0, grid };
  const w = maxX - minX + 1,
    h = maxY - minY + 1;
  for (let gy = 0; gy < GRID_H; gy++)
    for (let gx = 0; gx < GRID_W; gx++) grid[gy * GRID_W + gx] = on(minX + Math.floor(((gx + 0.5) * w) / GRID_W), minY + Math.floor(((gy + 0.5) * h) / GRID_H)) ? 1 : 0;
  return { w, h, grid };
}

function iou(a: Ink, b: Ink): number {
  let inter = 0,
    union = 0;
  for (let i = 0; i < a.grid.length; i++) {
    inter += a.grid[i] & b.grid[i];
    union += a.grid[i] | b.grid[i];
  }
  // A mask that matches in shape but not proportions (a narrower/wider
  // face stretched onto the same grid) is penalized by the aspect ratio.
  const aspect = Math.min(a.w / a.h, b.w / b.h) / Math.max(a.w / a.h, b.w / b.h);
  return union ? (inter / union) * aspect : 0;
}

/** Draws WORD the way the engine does: logical font size under a scale
 * transform. That matters — variable fonts with an optical-size axis
 * (Fraunces, Bricolage) pick opsz from the ctx.font size, not the drawn
 * pixel size, so drawing at the pixel size directly selects a different
 * glyph design. */
function referenceInk(fontCss: string, scale: number, word: string, dir: 'ltr' | 'rtl'): Ink {
  const c = document.createElement('canvas');
  c.width = 1600;
  c.height = 400;
  const ctx = c.getContext('2d')!;
  // The Night preset's own text-on-background colors, so antialiased
  // hairlines cross the ink threshold the same way they do in the render.
  ctx.fillStyle = PRESETS[3].b;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = PRESETS[3].text;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.font = fontCss;
  ctx.direction = dir;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(word, 20 / scale, c.height / 2 / scale);
  return ink(c);
}

function faceLoaded(family: string, weight: number): boolean {
  return [...document.fonts].some((f) => f.family.replace(/["']/g, '') === family && f.status === 'loaded' && (f.weight === String(weight) || /\d+ \d+/.test(f.weight)));
}

/** A stand-in for a user's upload (Noto Sans, a variable font not among
 * the built-ins; public/dev-fixtures/upload-test.woff2). */
const UPLOAD: CustomFontRef = { id: 'vr-upload-test', family: 'Noto Sans (test upload)', weight: 800 };
const UPLOAD_URL = '/dev-fixtures/upload-test.woff2';

interface FontCase {
  /** Index into FONTS, or -1 for the uploaded test font. */
  fontIndex: number;
  word: string;
  /** Set for script-font cases: the project is localized into it. */
  locale?: 'ja' | 'ar';
}
const CASES: FontCase[] = [
  ...FONTS.map((_, fontIndex) => ({ fontIndex, word: WORD })),
  { fontIndex: -1, word: WORD },
  // Real promo copy words: "daily habits" / "your habits".
  { fontIndex: 0, word: '毎日の習慣', locale: 'ja' },
  { fontIndex: 0, word: 'عاداتك', locale: 'ar' },
];

function projectFor({ fontIndex, word, locale }: FontCase): Project {
  const base = projectBase(fontIndex);
  if (!locale) return base;
  return localizeProject(
    {
      ...base,
      localization: {
        source: 'en',
        languages: [
          { locale: 'en', fontScale: 1, strings: {} },
          { locale, fontScale: 1, strings: { 's1.headline': { text: word, sourceHash: '', done: true } } },
        ],
      },
    },
    locale,
  );
}

function projectBase(fontIndex: number): Project {
  return {
    ...createDefaultProject(),
    font: Math.max(0, fontIndex),
    ...(fontIndex === -1 ? { customFont: UPLOAD.id, customFonts: [UPLOAD] } : {}),
    preset: 3,
    colors: { ...PRESETS[3] },
    shapes: false,
    intro: { on: false, dur: 2.5, tagline: '', style: {} },
    outro: { on: false, dur: 3, cta: '', button: '', small: '', style: {} },
    scenes: [createTextSlide(1, { headline: WORD, sub: '', dur: 2 })],
  };
}

async function decodeFrame(blob: Blob, t: number): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(blob);
  const video = document.createElement('video');
  video.src = url;
  video.muted = true;
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('video failed to load'));
  });
  video.currentTime = t;
  await new Promise<void>((resolve) => (video.onseeked = () => resolve()));
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d')!.drawImage(video, 0, 0);
  URL.revokeObjectURL(url);
  return canvas;
}

export async function runFontChecks(): Promise<FontCheckResult[]> {
  const out: FontCheckResult[] = [];
  // How the app loads uploads, but from a fixture file instead of /api/fonts.
  setCustomFontLoader((ref) => registerFontFace(ref.id, UPLOAD_URL, ref.italic));
  for (const fc of CASES) {
    const font: FontDef = fc.fontIndex === -1 ? customFontDef(UPLOAD) : FONTS[fc.fontIndex];
    const project = projectFor(fc);
    const script = fc.locale ? SCRIPT_FAMILIES[fc.locale === 'ja' ? 'jp' : 'arabic']! : null;
    const dir = fc.locale === 'ar' ? 'rtl' : 'ltr';
    const { w: W } = FORMATS[project.format];
    const big = W * 0.12; // drawTextSlide's 9:16 headline size
    // Export first: exportVideo awaits the project's fonts itself
    // (ensureProjectFonts, script font included) — part of what's checked.
    const exported = await exportVideo(project, {}, null, { resolution: '720p' }, new AbortController().signal);
    const frame = await decodeFrame(exported.blob, SAMPLE_T);
    const exportScale = frame.width / W;

    const previewScale = 0.5;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(W * previewScale);
    canvas.height = Math.round(FORMATS[project.format].h * previewScale);
    render(canvas.getContext('2d')!, project, {}, SAMPLE_T, previewScale);

    // Latin fonts: vs Figtree and system-ui. Script cases: vs the stack
    // without the Noto font — what a failed script-font load would draw.
    const references: Record<string, string> = script
      ? { real: `${font.h} ${big}px "${font.name}", "${script}", ${FONT_FALLBACK}`, 'system font': `${font.h} ${big}px "${font.name}", ${FONT_FALLBACK}` }
      : {
          real: `${font.h} ${big}px "${font.name}", ${FONT_FALLBACK}`,
          ...(font.name === 'Figtree' ? {} : { Figtree: `${font.h} ${big}px Figtree, system-ui, sans-serif` }),
          'system-ui': `${font.h} ${big}px system-ui, sans-serif`,
        };
    const score = (actual: Ink, scale: number) => {
      const scores = Object.fromEntries(Object.entries(references).map(([k, css]) => [k, Math.round(iou(actual, referenceInk(css, scale, fc.word, dir)) * 1000) / 1000]));
      const best = Math.max(...Object.keys(references).filter((k) => k !== 'real').map((k) => scores[k]));
      return { scores, ok: scores.real >= MIN_IOU && scores.real - best >= MIN_MARGIN };
    };
    const previewInk = ink(canvas);
    const p = score(previewInk, previewScale);
    const e = score(ink(frame), exportScale);
    const loaded = faceLoaded(script ?? font.name, font.h);
    const reasons = [!loaded && 'face not loaded', !p.ok && 'preview glyphs match a fallback, not the real font', !e.ok && 'export glyphs match a fallback, not the real font'].filter(Boolean);
    out.push({
      font: script ? `${script} (${fc.locale}, after ${font.name})` : fc.fontIndex === -1 ? `Uploaded font (${UPLOAD.family})` : font.name,
      weight: font.h,
      faceLoaded: loaded,
      preview: p.scores,
      export: e.scores,
      ink: { w: previewInk.w, h: previewInk.h },
      pass: loaded && p.ok && e.ok,
      reason: reasons.join('; ') || undefined,
    });
    URL.revokeObjectURL(exported.url);
  }
  return out;
}
