import * as fontkit from 'fontkit';

/**
 * SERVER-ONLY. Validates an uploaded font file and reads what the app needs
 * from it. The format comes from the file's own header bytes, not its name,
 * and the file is parsed all the way through — family name, weight, every
 * character it maps and a laid-out sample — so a renamed or truncated file
 * is rejected here rather than failing later in someone's export.
 */

export type FontFormat = 'woff2' | 'truetype' | 'opentype';

export interface ParsedFont {
  family: string;
  weight: number;
  italic: boolean;
  format: FontFormat;
  /** Mapped code points as [start, end] ranges. */
  coverage: Array<[number, number]>;
  glyphs: number;
}

export class FontRejected extends Error {}

const EXTENSIONS: Record<FontFormat, string[]> = { woff2: ['woff2'], truetype: ['ttf'], opentype: ['otf'] };

function sniff(buf: Uint8Array): FontFormat | 'woff' | 'collection' | null {
  const tag = String.fromCharCode(buf[0], buf[1], buf[2], buf[3]);
  if (tag === 'wOF2') return 'woff2';
  if (tag === 'wOFF') return 'woff';
  if (tag === 'OTTO') return 'opentype';
  if (tag === 'ttcf') return 'collection';
  if ((buf[0] === 0 && buf[1] === 1 && buf[2] === 0 && buf[3] === 0) || tag === 'true') return 'truetype';
  return null;
}

function ranges(codes: number[]): Array<[number, number]> {
  const sorted = [...new Set(codes)].sort((a, b) => a - b);
  const out: Array<[number, number]> = [];
  for (const c of sorted) {
    const last = out[out.length - 1];
    if (last && c === last[1] + 1) last[1] = c;
    else out.push([c, c]);
  }
  return out;
}

export function parseFont(bytes: Uint8Array, filename: string): ParsedFont {
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  const kind = bytes.length >= 12 ? sniff(bytes) : null;
  if (kind === 'woff') throw new FontRejected('WOFF (version 1) isn’t supported — upload the .woff2, .ttf or .otf version of this font.');
  if (kind === 'collection') throw new FontRejected('That’s a font collection (.ttc) — upload a single .ttf, .otf or .woff2 file.');
  if (!kind) throw new FontRejected('That file isn’t a font. Upload a .woff2, .ttf or .otf file.');
  if (!EXTENSIONS[kind].includes(ext)) throw new FontRejected(`That file is a ${kind === 'woff2' ? 'WOFF2' : kind === 'truetype' ? 'TrueType (.ttf)' : 'OpenType (.otf)'} font but is named .${ext} — rename it to .${EXTENSIONS[kind][0]} and try again.`);

  let font: fontkit.Font;
  try {
    const f = fontkit.create(Buffer.from(bytes));
    if ('fonts' in f) throw new FontRejected('That’s a font collection — upload a single font file.');
    font = f as fontkit.Font;
    // Touch everything a render needs, so a damaged file fails now.
    const family = (font.familyName || '').trim();
    const chars = font.characterSet;
    const run = font.layout('Hamburgefonstiv 0123 ÅÉ');
    if (!family) throw new FontRejected('That font has no family name, so it can’t be identified.');
    if (!chars.length || !font.numGlyphs) throw new FontRejected('That font has no characters in it.');
    if (!run.glyphs.length || run.glyphs.every((g) => g.id === 0)) throw new FontRejected('That font has no Latin letters — it can’t draw your text.');
    const os2 = font['OS/2'] as { usWeightClass?: number; fsSelection?: { italic?: boolean } } | undefined;
    const weight = Math.min(1000, Math.max(1, os2?.usWeightClass ?? 400));
    const italic = !!os2?.fsSelection?.italic || font.italicAngle !== 0;
    return { family: family.slice(0, 80), weight, italic, format: kind, coverage: ranges(chars), glyphs: font.numGlyphs };
  } catch (err) {
    if (err instanceof FontRejected) throw err;
    throw new FontRejected('That font file is damaged or incomplete and couldn’t be read.');
  }
}
