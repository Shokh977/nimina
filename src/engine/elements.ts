/**
 * Direct manipulation support: every element a segment draws (headline,
 * subtitle, device, badge, callout, counter, stickers, logo, outro button,
 * extra text boxes) can carry a user override — position, scale, rotation,
 * text wrap width, stacking order — stored on its owner (slide / intro /
 * outro) as `elements[key]`. Positions are fractions of the canvas, so a
 * moved element stays put across 9:16 / 1:1 / 16:9.
 *
 * The override is applied as a transform around the element's *default*
 * box (where the original layout puts it, at rest): with no override the
 * drawing is untouched — pixel-identical to before overrides existed.
 *
 * While drawing, each element also reports its default box and the box it
 * actually occupies, through an optional collector the editor installs
 * (withElementCollector) — that's how the editor's selection boxes sit
 * exactly on what the canvas drew, instead of guessing positions.
 *
 * Pure TypeScript, no framework imports (CLAUDE.md rule 2).
 */

export type ElementKey = 'headline' | 'sub' | 'device' | 'badge' | 'callout' | 'counter' | 'stickers' | 'logo' | 'button' | `text:${string}`;

export interface ElementXform {
  /** Centre, as a fraction of canvas width / height. */
  x?: number;
  y?: number;
  /** Scale relative to the element's default size (text: always sx = sy). */
  sx?: number;
  sy?: number;
  /** Rotation in degrees, clockwise. */
  r?: number;
  /** Text only: wrap width as a fraction of canvas width. */
  w?: number;
  /** Stacking order; higher draws on top. Unset = the layout's own order. */
  z?: number;
}

export type ElementMap = Partial<Record<ElementKey, ElementXform>>;

/** A user-added text box (made by duplicating a headline/subtitle). */
export interface TextLayer {
  id: string;
  text: string;
  /** Font size as a fraction of the canvas's short side. */
  size: number;
  /** Which of the font's weights: headline ('h') or body ('s'). */
  weight: 'h' | 's';
}

export interface Box {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

/** What the editor needs to draw and edit an element. Canvas units. */
export interface ElementReport {
  key: ElementKey;
  label: string;
  /** Text elements resize by changing font scale / wrap width and can be edited inline. */
  text: boolean;
  /** The default box (with the current wrap width), before any override. */
  base: Box;
  /** Where it is drawn now: base with the override (and its parent's) applied. */
  box: Box & { rot: number };
  z: number;
  deletable: boolean;
  /** Text: font size in canvas units, before the override's scale. */
  size?: number;
  /** A scattered group (stickers) whose box is mostly empty — the editor
   * only picks it where nothing solid is under the pointer. */
  sparse?: boolean;
}

type Collector = (r: ElementReport) => void;
let collector: Collector | null = null;
let hidden: ReadonlySet<string> | null = null;

/** Runs `fn` (a render) while reporting every element drawn to `onElement`;
 * elements whose key is in `hide` are reported but not drawn (the editor
 * hides text it is editing inline). */
export function withElementCollector<T>(onElement: Collector | null, hide: ReadonlySet<string> | null, fn: () => T): T {
  const prevC = collector,
    prevH = hidden;
  collector = onElement;
  hidden = hide;
  try {
    return fn();
  } finally {
    collector = prevC;
    hidden = prevH;
  }
}

export function hasOverride(xf: ElementXform | undefined): boolean {
  return !!xf && (xf.x !== undefined || xf.y !== undefined || (xf.sx ?? 1) !== 1 || (xf.sy ?? 1) !== 1 || !!xf.r);
}

/** The affine map an override applies, around `base`. Identity when unset. */
function mapping(base: Box, xf: ElementXform | undefined, W: number, H: number) {
  const cx = xf?.x !== undefined ? xf.x * W : base.cx;
  const cy = xf?.y !== undefined ? xf.y * H : base.cy;
  return { cx, cy, sx: xf?.sx ?? 1, sy: xf?.sy ?? 1, rot: ((xf?.r ?? 0) * Math.PI) / 180 };
}

/** A parent placement children follow while they have no override of their
 * own (badge / callout / counter follow the device). */
export interface Parent {
  base: Box;
  xf: ElementXform | undefined;
}

/**
 * Draws one element with its override applied, and reports it. `draw`
 * draws the element in its default position (animation included) — the
 * transform maps the default box onto the overridden one, so animations
 * stay relative to wherever the element now sits.
 */
export function placeElement(
  ctx: CanvasRenderingContext2D,
  key: ElementKey,
  info: { label: string; text?: boolean; z: number; deletable?: boolean; size?: number; sparse?: boolean },
  base: Box,
  xf: ElementXform | undefined,
  W: number,
  H: number,
  draw: () => void,
  parent?: Parent,
): void {
  const own = hasOverride(xf);
  const followsParent = !own && !!parent && hasOverride(parent.xf);
  const m = own ? mapping(base, xf, W, H) : null;
  const pm = followsParent ? mapping(parent!.base, parent!.xf, W, H) : null;

  if (collector) {
    let box: Box & { rot: number };
    if (m) box = { cx: m.cx, cy: m.cy, w: base.w * m.sx, h: base.h * m.sy, rot: m.rot };
    else if (pm) {
      // The parent's map applied to this element's centre.
      const dx = (base.cx - parent!.base.cx) * pm.sx,
        dy = (base.cy - parent!.base.cy) * pm.sy;
      box = { cx: pm.cx + dx * Math.cos(pm.rot) - dy * Math.sin(pm.rot), cy: pm.cy + dx * Math.sin(pm.rot) + dy * Math.cos(pm.rot), w: base.w * pm.sx, h: base.h * pm.sy, rot: pm.rot };
    } else box = { ...base, rot: 0 };
    collector({ key, label: info.label, text: !!info.text, base, box, z: xf?.z ?? info.z, deletable: info.deletable ?? true, size: info.size, sparse: info.sparse });
  }
  if (hidden?.has(key)) return;

  const t = m ? { map: m, about: base } : pm ? { map: pm, about: parent!.base } : null;
  if (!t) {
    draw();
    return;
  }
  ctx.save();
  ctx.translate(t.map.cx, t.map.cy);
  ctx.rotate(t.map.rot);
  ctx.scale(t.map.sx, t.map.sy);
  ctx.translate(-t.about.cx, -t.about.cy);
  draw();
  ctx.restore();
}

/** Draw order: by z (override or default), stable. */
export function byZ<T extends { z: number }>(items: T[]): T[] {
  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => a.it.z - b.it.z || a.i - b.i)
    .map((x) => x.it);
}

/** Bounding box of laid-out text drawn at (x, y) with the given alignment. */
export function textBox(lay: { lines: Array<{ width: number }>; height: number }, x: number, y: number, align: 'center' | 'left' | 'right'): Box {
  const w = Math.max(1, ...lay.lines.map((l) => l.width));
  const left = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  return { cx: left + w / 2, cy: y + lay.height / 2, w, h: Math.max(1, lay.height) };
}
