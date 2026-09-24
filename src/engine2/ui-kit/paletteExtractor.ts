/**
 * Proposes a theme (primary, accent, surface, text) from a screenshot —
 * "build the palette from the app's own screenshots" (docs/MOTION_GUIDE.md).
 * Real pixel-based extraction, not a stub: downsamples the image, buckets
 * pixels by hue (chromatic) or by lightness (near-grayscale), and picks the
 * most representative bucket for each role. No external color library —
 * canvas getImageData + a small HSL quantizer is enough for a proposal the
 * user can still override.
 */
import { makeCanvas } from '../texture';
import type { ImageAsset } from '../types';

export type { ImageAsset };

export interface ExtractedTheme {
  primary: string;
  accent: string;
  surface: string;
  text: string;
}

const SAMPLE_SIZE = 48;
const HUE_BUCKETS = 12;

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return [h, s, l];
}

function toHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

interface Bucket {
  count: number;
  r: number;
  g: number;
  b: number;
  sat: number;
  light: number;
}

function emptyBucket(): Bucket {
  return { count: 0, r: 0, g: 0, b: 0, sat: 0, light: 0 };
}

function accumulate(bucket: Bucket, r: number, g: number, b: number, sat: number, light: number): void {
  bucket.count++;
  bucket.r += r;
  bucket.g += g;
  bucket.b += b;
  bucket.sat += sat;
  bucket.light += light;
}

function bucketColor(b: Bucket): string {
  return toHex(b.r / b.count, b.g / b.count, b.b / b.count);
}

function bucketHue(b: Bucket): number {
  const [h] = rgbToHsl(b.r / b.count, b.g / b.count, b.b / b.count);
  return h;
}

/** Reads a decoded screenshot and proposes primary/accent/surface/text —
 * a starting point the user reviews and can hand-adjust, not a final answer. */
export function extractPalette(img: ImageAsset): ExtractedTheme {
  const { ctx } = makeCanvas(SAMPLE_SIZE, SAMPLE_SIZE);
  ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

  const hueBuckets: Bucket[] = Array.from({ length: HUE_BUCKETS }, emptyBucket);
  const lightBuckets: Bucket[] = Array.from({ length: 10 }, emptyBucket); // grayscale/low-saturation, by lightness decile

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2],
      a = data[i + 3];
    if (a < 200) continue;
    const [h, s, l] = rgbToHsl(r, g, b);
    if (s < 0.18) {
      const idx = Math.min(9, Math.floor(l * 10));
      accumulate(lightBuckets[idx], r, g, b, s, l);
    } else {
      const idx = Math.floor(h / (360 / HUE_BUCKETS)) % HUE_BUCKETS;
      accumulate(hueBuckets[idx], r, g, b, s, l);
    }
  }

  // Score chromatic buckets by count*saturation so a small patch of vivid
  // brand color outweighs a large expanse of weakly-tinted background.
  const chromatic = hueBuckets.filter((b) => b.count > 0).sort((a, b) => b.count * b.sat - a.count * a.sat);

  const primaryBucket = chromatic[0];
  const primary = primaryBucket ? bucketColor(primaryBucket) : '#6D5BFF';
  const primaryHue = primaryBucket ? bucketHue(primaryBucket) : 250;

  const accentBucket = chromatic.find((b) => {
    const h = bucketHue(b);
    const diff = Math.min(Math.abs(h - primaryHue), 360 - Math.abs(h - primaryHue));
    return diff > 40;
  });
  const accent = accentBucket ? bucketColor(accentBucket) : toHex(...hslComplement(primaryHue));

  const nonEmptyLight = lightBuckets.filter((b) => b.count > 0);
  const surfaceBucket = nonEmptyLight.reduce<Bucket | null>((best, b) => (!best || b.light / b.count > best.light / best.count ? b : best), null);
  const textBucket = nonEmptyLight.reduce<Bucket | null>((best, b) => (!best || b.light / b.count < best.light / best.count ? b : best), null);
  const surface = surfaceBucket && surfaceBucket.light / surfaceBucket.count > 0.55 ? bucketColor(surfaceBucket) : '#FFFFFF';
  const text = textBucket && textBucket.light / textBucket.count < 0.35 ? bucketColor(textBucket) : '#15161B';

  return { primary, accent, surface, text };
}

function hslComplement(hue: number): [number, number, number] {
  const h = (hue + 150) % 360;
  return hslToRgb(h, 0.68, 0.56);
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
