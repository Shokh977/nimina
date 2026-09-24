/**
 * Turns an uploaded .json or .lottie file into parsed Lottie JSON
 * (LottieProps.data), plus a small built-in icon set we authored
 * ourselves — Prompt 7. A .lottie file is a ZIP bundle (manifest.json +
 * animations/*.json, sometimes images/); unzipped with fflate (a small,
 * dependency-free, MIT-licensed unzip we ship, not a Lottie-specific
 * library) rather than hand-rolling ZIP parsing.
 */
import { unzipSync } from 'fflate';

import { ORIGINAL, type AssetLicense } from './assetLicense';

export interface LottieAsset {
  id: string;
  label: string;
  data: object;
  license: AssetLicense;
}

/** Reads a user-uploaded .json or .lottie File and returns parsed Lottie
 * JSON ready for LottieProps.data. Throws with a readable message on
 * anything that isn't actually one of those. */
export async function parseLottieFile(file: File): Promise<object> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.json') || file.type === 'application/json') {
    const text = await file.text();
    return JSON.parse(text) as object;
  }
  if (name.endsWith('.lottie') || file.type === 'application/zip') {
    const buf = new Uint8Array(await file.arrayBuffer());
    const entries = unzipSync(buf);
    const manifestBytes = entries['manifest.json'];
    if (manifestBytes) {
      const manifest = JSON.parse(new TextDecoder().decode(manifestBytes)) as { animations?: Array<{ id: string }> };
      const animId = manifest.animations?.[0]?.id;
      const animBytes = animId ? entries[`animations/${animId}.json`] : undefined;
      if (animBytes) return JSON.parse(new TextDecoder().decode(animBytes)) as object;
    }
    // No manifest, or it didn't point anywhere real — fall back to the
    // first .json entry in the archive.
    const firstJsonPath = Object.keys(entries).find((p) => p.endsWith('.json'));
    if (firstJsonPath) return JSON.parse(new TextDecoder().decode(entries[firstJsonPath])) as object;
    throw new Error('This .lottie file has no animation JSON inside it.');
  }
  throw new Error('Choose a .json or .lottie file.');
}

/* ---------- built-in icon set — every one authored for this product ---------- */

function pulseCircle(color: [number, number, number, number]): object {
  return {
    v: '5.7.4',
    fr: 30,
    ip: 0,
    op: 60,
    w: 200,
    h: 200,
    nm: 'Pulse',
    ddd: 0,
    assets: [],
    layers: [
      {
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: 'Circle',
        sr: 1,
        ks: {
          o: { a: 0, k: 100 },
          r: { a: 0, k: 0 },
          p: { a: 0, k: [100, 100, 0] },
          a: { a: 0, k: [0, 0, 0] },
          s: {
            a: 1,
            k: [
              { t: 0, s: [60, 60, 100], e: [100, 100, 100], i: { x: [0.42, 0.42, 0.42], y: [0, 0, 0] }, o: { x: [0.58, 0.58, 0.58], y: [1, 1, 1] } },
              { t: 20, s: [100, 100, 100], e: [72, 72, 100], i: { x: [0.42, 0.42, 0.42], y: [0, 0, 0] }, o: { x: [0.58, 0.58, 0.58], y: [1, 1, 1] } },
              { t: 40, s: [72, 72, 100], e: [60, 60, 100], i: { x: [0.42, 0.42, 0.42], y: [0, 0, 0] }, o: { x: [0.58, 0.58, 0.58], y: [1, 1, 1] } },
              { t: 60 },
            ],
          },
        },
        ao: 0,
        shapes: [
          {
            ty: 'gr',
            it: [
              { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [140, 140] }, nm: 'Ellipse' },
              { ty: 'fl', c: { a: 0, k: color }, o: { a: 0, k: 100 }, nm: 'Fill' },
              { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
            ],
            nm: 'Ellipse Group',
          },
        ],
        ip: 0,
        op: 60,
        st: 0,
      },
    ],
  };
}

/** A checkmark that draws itself on via trim-path, then holds. */
function checkDrawOn(): object {
  return {
    v: '5.7.4',
    fr: 30,
    ip: 0,
    op: 45,
    w: 200,
    h: 200,
    nm: 'Check',
    ddd: 0,
    assets: [],
    layers: [
      {
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: 'Check',
        sr: 1,
        ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [100, 100, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] } },
        ao: 0,
        shapes: [
          {
            ty: 'gr',
            it: [
              { ty: 'sh', ks: { a: 0, k: { i: [[0, 0], [0, 0], [0, 0]], o: [[0, 0], [0, 0], [0, 0]], v: [[-45, 5], [-15, 35], [50, -35]], c: false } }, nm: 'Path' },
              { ty: 'tm', s: { a: 0, k: 0 }, e: { a: 1, k: [{ t: 5, s: [0], e: [100], i: { x: [0.42], y: [0] }, o: { x: [0.58], y: [1] } }, { t: 30 }] }, o: { a: 0, k: 0 }, nm: 'Trim' },
              { ty: 'st', c: { a: 0, k: [0.09, 0.7, 0.39, 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: 16 }, lc: 2, lj: 2, nm: 'Stroke' },
              { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
            ],
            nm: 'Check Group',
          },
        ],
        ip: 0,
        op: 45,
        st: 0,
      },
    ],
  };
}

export const BUILT_IN_LOTTIE_ICONS: LottieAsset[] = [
  { id: 'pulse-accent', label: 'Pulse (accent)', data: pulseCircle([1, 0.878, 0.4, 1]), license: ORIGINAL },
  { id: 'pulse-heart', label: 'Pulse (pink)', data: pulseCircle([1, 0.31, 0.47, 1]), license: ORIGINAL },
  { id: 'check-draw-on', label: 'Checkmark draw-on', data: checkDrawOn(), license: ORIGINAL },
];

export function getBuiltInLottieIcon(id: string): LottieAsset | undefined {
  return BUILT_IN_LOTTIE_ICONS.find((a) => a.id === id);
}
