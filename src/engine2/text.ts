/**
 * Kinetic headline: each word reveals from inside a clip mask, sliding up
 * into view (docs/MOTION_GUIDE.md) — the DOM reference does this with
 * `overflow:hidden` + `translate3d(0,y%,0)`. Three.js has no CSS-style
 * clip-mask, so this uses an equivalent that's just as cheap: draw the
 * word onto a canvas 3x its own line height (empty / word / empty stacked
 * vertically), map it onto a plane sized to *one third* of that canvas via
 * `texture.repeat.y = 1/3`, and scroll `texture.offset.y` across the three
 * thirds — showing empty-below at rest-before-entering, the word once
 * entered, empty-above once exited. Same visual result as a sliding clip
 * mask, no stencil buffer or clipping planes needed.
 */
import * as THREE from 'three';

import { out, spr } from './spring';
import type { SpringParams } from './spring';
import { makeCanvas, textureFromCanvas } from './texture';
import type { MotionStyle } from './styles';

export interface WordPlane {
  mesh: THREE.Mesh;
  /** Seconds after the beat's `at` this word starts entering (stagger). */
  delayIndex: number;
  highlighted: boolean;
}

export interface HeadlineWord {
  text: string;
  highlight: boolean;
}

/** Splits `*stars*`-wrapped text into words + highlight flags — same
 * convention as the classic engine (src/engine/text.ts) and the reference. */
export function parseHeadline(text: string): HeadlineWord[] {
  let inHi = false;
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => {
      let w = raw;
      let hi = inHi;
      if (w.startsWith('*')) {
        hi = true;
        inHi = true;
        w = w.slice(1);
      }
      if (w.endsWith('*')) {
        w = w.slice(0, -1);
        inHi = false;
      }
      return { text: w.replace(/\*/g, ''), highlight: hi };
    })
    .filter((w) => w.text.length > 0);
}

const LINE_H = 118;
const WORD_PAD_X = 14;

function measureWord(ctx: CanvasRenderingContext2D, text: string, fontPx: number): number {
  ctx.font = `800 ${fontPx}px "Bricolage Grotesque", Figtree, sans-serif`;
  return ctx.measureText(text).width;
}

function buildWordTexture(word: HeadlineWord, fontPx: number, ink: string, accent: string, mark: string): { texture: THREE.CanvasTexture; width: number } {
  const { ctx: measureCtx } = makeCanvas(4, 4);
  const w = Math.ceil(measureWord(measureCtx, word.text, fontPx)) + WORD_PAD_X * 2;
  const { canvas, ctx } = makeCanvas(w, LINE_H * 3);
  ctx.font = `800 ${fontPx}px "Bricolage Grotesque", Figtree, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const midY = LINE_H * 1.5;
  if (word.highlight) {
    ctx.fillStyle = accent;
    const bw = w - 8;
    const bh = fontPx * 1.12;
    ctx.beginPath();
    const r = bh * 0.2;
    ctx.roundRect(4, midY - bh / 2, bw, bh, r);
    ctx.fill();
    ctx.fillStyle = mark;
  } else {
    ctx.fillStyle = ink;
  }
  ctx.fillText(word.text, w / 2, midY + fontPx * 0.04);
  const texture = textureFromCanvas(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(1, 1 / 3);
  return { texture, width: w };
}

/** Builds one beat's word planes, laid out left-to-right with wrapping,
 * parented under `group` at the given top-left origin. Returns the planes
 * in reading order for update() to animate. */
export function buildHeadlineBeat(
  group: THREE.Group,
  words: HeadlineWord[],
  opts: { maxWidth: number; fontPx: number; align: 'center' | 'left'; ink: string; accent: string; mark: string },
): WordPlane[] {
  const gap = opts.fontPx * 0.22;
  const { ctx: measureCtx } = makeCanvas(4, 4);
  const rows: { words: HeadlineWord[]; width: number }[] = [];
  let row: HeadlineWord[] = [];
  let rowWidth = 0;
  for (const word of words) {
    const w = measureWord(measureCtx, word.text, opts.fontPx) + WORD_PAD_X * 2;
    if (row.length && rowWidth + gap + w > opts.maxWidth) {
      rows.push({ words: row, width: rowWidth + (row.length - 1) * gap });
      row = [];
      rowWidth = 0;
    }
    row.push(word);
    rowWidth += (row.length > 1 ? gap : 0) + w;
  }
  if (row.length) rows.push({ words: row, width: rowWidth });

  const planes: WordPlane[] = [];
  let wordIndex = 0;
  rows.forEach((r, rowI) => {
    let x = opts.align === 'center' ? -r.width / 2 : 0;
    const y = -rowI * LINE_H;
    for (const word of r.words) {
      const { texture, width } = buildWordTexture(word, opts.fontPx, opts.ink, opts.accent, opts.mark);
      const geo = new THREE.PlaneGeometry(width, LINE_H);
      const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x + width / 2, y, 0);
      group.add(mesh);
      planes.push({ mesh, delayIndex: wordIndex, highlighted: word.highlight });
      x += width + gap;
      wordIndex++;
    }
  });
  return planes;
}

/** Animates a beat's words at local time `t` (seconds since the *scene*
 * started — `at`/`out` are absolute). `enterSpring` is the style's enter
 * spring; stagger is `0.065 * style.stag` seconds per word, matching the
 * reference. Visibility follows the beat's full window so an empty beat
 * outside its [at, out+tail] range costs nothing to render. */
export function updateHeadlineBeat(t: number, planes: WordPlane[], at: number, beatOut: number, enterSpring: SpringParams, style: MotionStyle): boolean {
  const tail = planes.length * 0.03 * style.stag + 0.35;
  const visible = t >= at && t <= beatOut + tail;
  if (!visible) return false;
  planes.forEach((wp, j) => {
    const p = spr(t - at - j * 0.065 * style.stag, enterSpring);
    const q = out(t, beatOut + j * 0.03, 0.3);
    // Exact port of the reference's `y = (1-p)*135 - q*150` (percent of the
    // word's own line height): 135(+) = fully hidden below, 0 = at rest,
    // -150(-) = fully exited above. Map that onto u in [0,1] (0 = bottom
    // third of the 3-stacked-thirds texture, 0.5 = middle/word, 1 = top
    // third) via the same two breakpoints, then clamp for spring overshoot.
    const yPct = (1 - p) * 135 - q * 150;
    const u = yPct >= 0 ? 0.5 - 0.5 * (yPct / 135) : 0.5 - 0.5 * (yPct / 150);
    const tex = (wp.mesh.material as THREE.MeshBasicMaterial).map!;
    tex.offset.y = Math.max(0, Math.min(1, u)) * (2 / 3);
    const tiltDeg = (1 - p) * 6 * style.R;
    wp.mesh.rotation.z = THREE.MathUtils.degToRad(tiltDeg);
    (wp.mesh.material as THREE.MeshBasicMaterial).opacity = 1;
  });
  return true;
}
