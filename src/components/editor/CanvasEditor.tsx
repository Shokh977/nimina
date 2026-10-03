'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ElementKey, ElementReport, ElementXform } from '@/engine/elements';
import { getOwner, textOf, type ElementOwner } from '@/store/elementOps';
import { useEditorStore } from '@/store/editorStore';
import type { PlaybackEngine } from './usePlaybackEngine';

/**
 * Canva-style direct manipulation over the preview canvas. Boxes come from
 * what the engine actually drew this frame (engine.elements — see
 * src/engine/elements.ts), so selection always sits on the real pixels.
 *
 * Mouse: click to select (shift-click adds), drag to move, drag the 8
 * handles to resize (shift keeps the aspect ratio, alt resizes from the
 * centre), drag the round handle to rotate (shift snaps to 15°), drag on
 * empty canvas for a marquee, double-click text to edit it, right-click for
 * stacking order. Moving snaps to the canvas centre, thirds, safe margins
 * and other elements, with guides — hold Ctrl/⌘ to move freely.
 * Keys: arrows nudge 1px (shift: 10px), Delete removes, Ctrl/⌘+D
 * duplicates, Esc deselects, Tab cycles.
 * Touch: tap to select, drag to move; two fingers pinch/pan the stage.
 *
 * Everything writes through the store, so it's undoable and autosaved;
 * positions are stored as fractions of the canvas (survive format changes).
 */

type Box = { cx: number; cy: number; w: number; h: number; rot: number };
type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const HANDLES: Array<[Handle, number, number]> = [
  ['nw', -1, -1],
  ['n', 0, -1],
  ['ne', 1, -1],
  ['e', 1, 0],
  ['se', 1, 1],
  ['s', 0, 1],
  ['sw', -1, 1],
  ['w', -1, 0],
];
const CURSOR: Record<Handle, string> = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' };
const SNAP_PX = 6;
const deg = (rad: number) => (rad * 180) / Math.PI;

function toLocal(b: Box, x: number, y: number) {
  const dx = x - b.cx,
    dy = y - b.cy,
    c = Math.cos(-b.rot),
    s = Math.sin(-b.rot);
  return { x: dx * c - dy * s, y: dx * s + dy * c };
}
function fromLocal(b: Box, lx: number, ly: number) {
  const c = Math.cos(b.rot),
    s = Math.sin(b.rot);
  return { x: b.cx + lx * c - ly * s, y: b.cy + lx * s + ly * c };
}
function contains(b: Box, x: number, y: number, pad = 0) {
  const p = toLocal(b, x, y);
  return Math.abs(p.x) <= b.w / 2 + pad && Math.abs(p.y) <= b.h / 2 + pad;
}
function aabb(b: Box) {
  const c = Math.abs(Math.cos(b.rot)),
    s = Math.abs(Math.sin(b.rot));
  const hw = (b.w * c + b.h * s) / 2,
    hh = (b.w * s + b.h * c) / 2;
  return { x0: b.cx - hw, x1: b.cx + hw, y0: b.cy - hh, y1: b.cy + hh };
}
function union(boxes: Box[]) {
  const a = boxes.map(aabb);
  return { x0: Math.min(...a.map((r) => r.x0)), x1: Math.max(...a.map((r) => r.x1)), y0: Math.min(...a.map((r) => r.y0)), y1: Math.max(...a.map((r) => r.y1)) };
}

type Drag =
  | { mode: 'move'; px: number; py: number; start: Record<string, Box>; moved: boolean }
  | { mode: 'resize'; key: ElementKey; handle: Handle; start: Box; report: ElementReport; xf: ElementXform }
  | { mode: 'rotate'; key: ElementKey; start: Box; a0: number }
  | { mode: 'marquee'; x0: number; y0: number; x1: number; y1: number; additive: boolean };

export default function CanvasEditor({ engine, W, H, cssScale, touch }: { engine: PlaybackEngine; W: number; H: number; cssScale: number; touch: boolean }) {
  const project = useEditorStore((s) => s.project);
  const previewLocale = useEditorStore((s) => s.previewLocale);
  const setElementXforms = useEditorStore((s) => s.setElementXforms);
  const setElementText = useEditorStore((s) => s.setElementText);
  const deleteElements = useEditorStore((s) => s.deleteElements);
  const addTextLayer = useEditorStore((s) => s.addTextLayer);
  const setElementStackOrder = useEditorStore((s) => s.setElementStackOrder);
  const selectScene = useEditorStore((s) => s.selectScene);

  const { owner, list } = engine.elements;
  const [selected, setSelected] = useState<ElementKey[]>([]);
  const [hover, setHover] = useState<ElementKey | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [guides, setGuides] = useState<{ xs: number[]; ys: number[] }>({ xs: [], ys: [] });
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState<{ key: ElementKey; draft: string } | null>(null);
  const [notice, setNotice] = useState('');
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const pointers = useRef(new Set<number>());
  const ownerRef = useRef(owner);

  const loc = project.localization;
  const previewingTranslation = !!loc && !!previewLocale && previewLocale !== loc.source;
  const byKey = useMemo(() => new Map(list.map((r) => [r.key, r])), [list]);
  const boxOf = useCallback((k: ElementKey): Box | null => byKey.get(k)?.box ?? null, [byKey]);

  // New segment under the playhead: start fresh.
  useEffect(() => {
    if (ownerRef.current === owner) return;
    ownerRef.current = owner;
    setSelected([]);
    setEditing(null);
    setMenu(null);
    engine.setHiddenElements([]);
  }, [owner, engine]);

  // Keep the inspector on the slide being edited on the canvas.
  useEffect(() => {
    if (selected.length && owner !== null) selectScene(owner);
  }, [selected.length, owner, selectScene]);

  const flash = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(''), 2200);
  };

  const ownerXf = useCallback(
    (k: ElementKey): ElementXform => {
      const o = owner === null ? undefined : getOwner(useEditorStore.getState().project, owner as ElementOwner);
      return (o as { elements?: Record<string, ElementXform> } | undefined)?.elements?.[k] ?? {};
    },
    [owner],
  );

  /** The override that reproduces `box` for element `r` (keeps wrap width and z). */
  const xfFor = (r: ElementReport, box: Box, extra?: Partial<ElementXform>): ElementXform => {
    const cur = ownerXf(r.key);
    return { ...cur, x: box.cx / W, y: box.cy / H, sx: box.w / r.base.w, sy: box.h / r.base.h, r: deg(box.rot), ...extra };
  };

  const point = (e: { clientX: number; clientY: number }) => {
    const rect = overlayRef.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / (rect.width / W), y: (e.clientY - rect.top) / (rect.height / H) };
  };
  const scaleNow = () => {
    const rect = overlayRef.current?.getBoundingClientRect();
    return rect ? rect.width / W : cssScale;
  };

  /** The element under a point. When several overlap, the smallest wins —
   * the most specific thing there (a badge on the device, not the device;
   * stickers only where nothing solid is under the pointer). */
  const hitTest = (x: number, y: number): ElementReport | null => {
    const pad = (touch ? 10 : 3) / scaleNow();
    const all = list.filter((r) => contains(r.box, x, y, pad));
    const solid = all.filter((r) => !r.sparse);
    const hits = solid.length ? solid : all;
    if (!hits.length) return null;
    return hits.reduce((best, r) => (r.box.w * r.box.h < best.box.w * best.box.h ? r : best));
  };

  const setDragState = (d: Drag | null) => {
    dragRef.current = d;
    setDrag(d);
  };

  /* ---------------- pointer ---------------- */

  const onPointerDown = (e: React.PointerEvent) => {
    if (owner === null || e.button === 2) return;
    pointers.current.add(e.pointerId);
    if (pointers.current.size > 1) {
      // A second finger: the stage takes over (pinch/pan).
      setDragState(null);
      setGuides({ xs: [], ys: [] });
      return;
    }
    if (editing) return;
    setMenu(null);
    const p = point(e);
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-handle]');
    if (target && selected.length === 1) {
      const r = byKey.get(selected[0]);
      if (!r) return;
      overlayRef.current?.setPointerCapture(e.pointerId);
      e.stopPropagation();
      if (target.dataset.handle === 'rotate') {
        setDragState({ mode: 'rotate', key: r.key, start: { ...r.box }, a0: Math.atan2(p.y - r.box.cy, p.x - r.box.cx) });
      } else {
        setDragState({ mode: 'resize', key: r.key, handle: target.dataset.handle as Handle, start: { ...r.box }, report: r, xf: ownerXf(r.key) });
      }
      return;
    }
    const hit = hitTest(p.x, p.y);
    if (hit) {
      overlayRef.current?.setPointerCapture(e.pointerId);
      let sel = selected;
      if (e.shiftKey) {
        sel = selected.includes(hit.key) ? selected.filter((k) => k !== hit.key) : [...selected, hit.key];
        setSelected(sel);
        if (!sel.includes(hit.key)) return;
      } else if (!selected.includes(hit.key)) {
        sel = [hit.key];
        setSelected(sel);
      }
      const start: Record<string, Box> = {};
      for (const k of sel) {
        const b = boxOf(k);
        if (b) start[k] = { ...b };
      }
      setDragState({ mode: 'move', px: p.x, py: p.y, start, moved: false });
      return;
    }
    // Empty canvas.
    if (touch) {
      setSelected([]);
      return;
    }
    overlayRef.current?.setPointerCapture(e.pointerId);
    if (!e.shiftKey) setSelected([]);
    setDragState({ mode: 'marquee', x0: p.x, y0: p.y, x1: p.x, y1: p.y, additive: e.shiftKey });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    const p = point(e);
    if (!d) {
      if (!touch && !editing) setHover(hitTest(p.x, p.y)?.key ?? null);
      return;
    }
    if (pointers.current.size > 1) return;
    const free = e.ctrlKey || e.metaKey;
    if (d.mode === 'move') {
      let dx = p.x - d.px,
        dy = p.y - d.py;
      if (!d.moved && Math.hypot(dx, dy) * scaleNow() < 3) return;
      d.moved = true;
      const keys = Object.keys(d.start) as ElementKey[];
      const snapped = free ? { dx, dy, xs: [], ys: [] } : snapMove(Object.values(d.start), dx, dy, keys);
      dx = snapped.dx;
      dy = snapped.dy;
      setGuides({ xs: snapped.xs, ys: snapped.ys });
      const patch: Record<string, ElementXform> = {};
      for (const k of keys) {
        const r = byKey.get(k);
        if (r) patch[k] = xfFor(r, { ...d.start[k], cx: d.start[k].cx + dx, cy: d.start[k].cy + dy });
      }
      setElementXforms(owner as ElementOwner, patch);
    } else if (d.mode === 'resize') {
      setElementXforms(owner as ElementOwner, { [d.key]: resizeXf(d, p, e.shiftKey, e.altKey) });
    } else if (d.mode === 'rotate') {
      let rot = d.start.rot + Math.atan2(p.y - d.start.cy, p.x - d.start.cx) - d.a0;
      if (e.shiftKey) rot = Math.round(rot / (Math.PI / 12)) * (Math.PI / 12);
      rot = Math.atan2(Math.sin(rot), Math.cos(rot));
      const r = byKey.get(d.key);
      if (r) setElementXforms(owner as ElementOwner, { [d.key]: xfFor(r, { ...d.start, rot }) });
    } else if (d.mode === 'marquee') {
      setDragState({ ...d, x1: p.x, y1: p.y });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const d = dragRef.current;
    setDragState(null);
    setGuides({ xs: [], ys: [] });
    if (d?.mode === 'marquee') {
      const x0 = Math.min(d.x0, d.x1),
        x1 = Math.max(d.x0, d.x1),
        y0 = Math.min(d.y0, d.y1),
        y1 = Math.max(d.y0, d.y1);
      if ((x1 - x0) * scaleNow() < 3 && (y1 - y0) * scaleNow() < 3) return;
      const hits = list.filter((r) => {
        const a = aabb(r.box);
        return a.x0 < x1 && a.x1 > x0 && a.y0 < y1 && a.y1 > y0;
      });
      setSelected((prev) => [...new Set([...(d.additive ? prev : []), ...hits.map((r) => r.key)])]);
    }
  };

  /** Snaps the moving selection's edges/centre to canvas centre, thirds,
   * safe margins and the other elements; returns the adjusted delta and
   * the guide lines that matched. */
  const snapMove = (start: Box[], dx: number, dy: number, moving: ElementKey[]) => {
    const u = union(start);
    const tol = SNAP_PX / scaleNow();
    const others = list.filter((r) => !moving.includes(r.key)).map((r) => aabb(r.box));
    const xs = [0, W * 0.05, W / 3, W / 2, (W * 2) / 3, W * 0.95, W, ...others.flatMap((a) => [a.x0, (a.x0 + a.x1) / 2, a.x1])];
    const ys = [0, H * 0.05, H / 3, H / 2, (H * 2) / 3, H * 0.95, H, ...others.flatMap((a) => [a.y0, (a.y0 + a.y1) / 2, a.y1])];
    const pick = (vals: number[], cands: number[], d: number) => {
      let best: { off: number; line: number } | null = null;
      for (const v of vals)
        for (const c of cands) {
          const off = c - (v + d);
          if (Math.abs(off) <= tol && (!best || Math.abs(off) < Math.abs(best.off))) best = { off, line: c };
        }
      return best;
    };
    const bx = pick([u.x0, (u.x0 + u.x1) / 2, u.x1], xs, dx);
    const by = pick([u.y0, (u.y0 + u.y1) / 2, u.y1], ys, dy);
    return { dx: dx + (bx?.off ?? 0), dy: dy + (by?.off ?? 0), xs: bx ? [bx.line] : [], ys: by ? [by.line] : [] };
  };

  const resizeXf = (d: Extract<Drag, { mode: 'resize' }>, p: { x: number; y: number }, keepAspect: boolean, fromCentre: boolean): ElementXform => {
    const b = d.start;
    const r = d.report;
    const hx = HANDLES.find((h) => h[0] === d.handle)![1],
      hy = HANDLES.find((h) => h[0] === d.handle)![2];
    const l = toLocal(b, p.x, p.y);
    const min = W * 0.02;
    const span = (lv: number, half: number, dir: number) => Math.max(min, fromCentre ? 2 * Math.abs(lv) : dir ? (dir > 0 ? lv + half : half - lv) : 0);
    let w = hx ? span(l.x, b.w / 2, hx) : b.w;
    let h = hy ? span(l.y, b.h / 2, hy) : b.h;
    let wrap: number | undefined;
    if (r.text) {
      if (hx && !hy) {
        // Side handles on text change the wrap width; the size stays.
        const sx = b.w / r.base.w;
        wrap = w / (sx * W);
        h = b.h;
      } else {
        const s = hx && hy ? Math.max(w / b.w, h / b.h) : hy ? h / b.h : w / b.w;
        w = b.w * s;
        h = b.h * s;
      }
    } else if (keepAspect && hx && hy) {
      const s = Math.max(w / b.w, h / b.h);
      w = b.w * s;
      h = b.h * s;
    }
    const c = fromCentre ? { x: b.cx, y: b.cy } : fromLocal(b, hx ? (hx * (w - b.w)) / 2 : 0, hy ? (hy * (h - b.h)) / 2 : 0);
    const xf: ElementXform = { ...d.xf, x: c.x / W, y: c.y / H, r: deg(b.rot) };
    if (wrap !== undefined) return { ...xf, w: Math.max(0.08, wrap), sx: b.w / r.base.w, sy: b.h / r.base.h };
    return { ...xf, sx: w / r.base.w, sy: h / r.base.h };
  };

  /* ---------------- commands ---------------- */

  const deleteSelected = useCallback(() => {
    if (owner === null || !selected.length) return;
    const ok = selected.filter((k) => byKey.get(k)?.deletable);
    if (ok.length < selected.length) flash(`${byKey.get(selected.find((k) => !byKey.get(k)?.deletable)!)?.label ?? 'That element'} can't be removed.`);
    if (ok.length) deleteElements(owner as ElementOwner, ok);
    setSelected([]);
  }, [owner, selected, byKey, deleteElements]);

  const duplicateSelected = useCallback(() => {
    if (owner === null) return;
    const texts = selected.map((k) => byKey.get(k)).filter((r): r is ElementReport => !!r && r.text);
    if (texts.length < selected.length) flash('Only text can be duplicated.');
    const added: ElementKey[] = [];
    const st = useEditorStore.getState().project;
    for (const r of texts) {
      const text = textOf(st, owner as ElementOwner, r.key);
      if (!text) continue;
      const scale = r.box.w / r.base.w;
      const id = Math.random().toString(36).slice(2, 9);
      const weight = r.key === 'headline' ? 'h' : r.key === 'sub' ? 's' : ((getOwner(st, owner as ElementOwner) as { texts?: Array<{ id: string; weight: 'h' | 's' }> })?.texts?.find((t) => `text:${t.id}` === r.key)?.weight ?? 's');
      addTextLayer(owner as ElementOwner, { id, text, size: ((r.size ?? H * 0.04) * scale) / Math.min(W, H), weight }, { x: (r.box.cx + W * 0.03) / W, y: (r.box.cy + H * 0.03) / H, r: deg(r.box.rot), w: (r.box.w + W * 0.02) / W });
      added.push(`text:${id}`);
    }
    if (added.length) setSelected(added);
  }, [owner, selected, byKey, addTextLayer, W, H]);

  const restack = (dir: 1 | -1) => {
    if (owner === null || selected.length !== 1) return;
    const order = list.map((r) => r.key);
    const i = order.indexOf(selected[0]);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    setElementStackOrder(owner as ElementOwner, order);
  };

  const align = (how: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom' | 'hdist' | 'vdist') => {
    if (owner === null || selected.length < 2) return;
    const items = selected.map((k) => byKey.get(k)).filter((r): r is ElementReport => !!r);
    const u = union(items.map((r) => r.box));
    const patch: Record<string, ElementXform> = {};
    const move = (r: ElementReport, dx: number, dy: number) => (patch[r.key] = xfFor(r, { ...r.box, cx: r.box.cx + dx, cy: r.box.cy + dy }));
    if (how === 'hdist' || how === 'vdist') {
      if (items.length < 3) return flash('Select three or more to distribute.');
      const horiz = how === 'hdist';
      const sorted = [...items].sort((a, b) => (horiz ? a.box.cx - b.box.cx : a.box.cy - b.box.cy));
      const first = horiz ? sorted[0].box.cx : sorted[0].box.cy,
        last = horiz ? sorted.at(-1)!.box.cx : sorted.at(-1)!.box.cy;
      sorted.forEach((r, i) => {
        const target = first + ((last - first) * i) / (sorted.length - 1);
        move(r, horiz ? target - r.box.cx : 0, horiz ? 0 : target - r.box.cy);
      });
    } else {
      for (const r of items) {
        const a = aabb(r.box);
        if (how === 'left') move(r, u.x0 - a.x0, 0);
        if (how === 'right') move(r, u.x1 - a.x1, 0);
        if (how === 'hcenter') move(r, (u.x0 + u.x1) / 2 - r.box.cx, 0);
        if (how === 'top') move(r, 0, u.y0 - a.y0);
        if (how === 'bottom') move(r, 0, u.y1 - a.y1);
        if (how === 'vcenter') move(r, 0, (u.y0 + u.y1) / 2 - r.box.cy);
      }
    }
    setElementXforms(owner as ElementOwner, patch);
  };

  const startEdit = (k: ElementKey) => {
    if (owner === null || previewingTranslation) return;
    const text = textOf(useEditorStore.getState().project, owner as ElementOwner, k);
    if (text === null) return;
    setSelected([k]);
    setEditing({ key: k, draft: text });
    engine.setHiddenElements([k]);
  };
  const finishEdit = (commit: boolean) => {
    if (editing && commit && owner !== null) setElementText(owner as ElementOwner, editing.key, editing.draft);
    setEditing(null);
    engine.setHiddenElements([]);
  };

  /* ---------------- keyboard ---------------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editing || owner === null) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, select, [contenteditable=true]')) return;
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === 'Tab' && list.length && (selected.length || t === document.body || overlayRef.current?.contains(t))) {
        e.preventDefault();
        const order = list.map((r) => r.key);
        const i = selected.length ? order.indexOf(selected[selected.length - 1]) : -1;
        setSelected([order[(i + (e.shiftKey ? -1 : 1) + order.length) % order.length]]);
        return;
      }
      if (!selected.length) return;
      if (e.key === 'Escape') {
        setSelected([]);
        setMenu(null);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelected();
      } else if (e.key === 'Enter' && selected.length === 1 && byKey.get(selected[0])?.text) {
        e.preventDefault();
        startEdit(selected[0]);
      } else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        const patch: Record<string, ElementXform> = {};
        for (const k of selected) {
          // From the stored position, not the last drawn box — key repeat
          // fires faster than frames, and each press must add up.
          const cur = ownerXf(k);
          const r = byKey.get(k);
          if (cur.x !== undefined && cur.y !== undefined) patch[k] = { ...cur, x: cur.x + dx / W, y: cur.y + dy / H };
          else if (r) patch[k] = xfFor(r, { ...r.box, cx: r.box.cx + dx, cy: r.box.cy + dy });
        }
        setElementXforms(owner as ElementOwner, patch);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (engine.playing || owner === null) return null;

  /* ---------------- render ---------------- */

  const cs = cssScale;
  const boxStyle = (b: Box): React.CSSProperties => ({ left: (b.cx - b.w / 2) * cs, top: (b.cy - b.h / 2) * cs, width: b.w * cs, height: b.h * cs, transform: `rotate(${b.rot}rad)` });
  const single = selected.length === 1 ? byKey.get(selected[0]) : undefined;
  const hs = touch ? 18 : 10; // handle size, CSS px
  const editingReport = editing ? byKey.get(editing.key) : undefined;
  // Room above the selected box for the rotate handle (and its label)?
  const rotBelow = !!single && aabb(single.box).y0 * cs < 48;
  // Side handles only where there's room for them beside the corners.
  const showSideX = !!single && single.box.w * cs >= hs * 3 && single.box.h * cs >= hs * 1.6;
  const showSideY = !!single && single.box.h * cs >= hs * 3 && single.box.w * cs >= hs * 2.5;
  const smallBox = !!single && (single.box.w * cs < hs * 4 || single.box.h * cs < hs * 4);

  return (
    <div
      ref={overlayRef}
      data-canvas-editor
      // For tests and debugging: what's on the canvas, in CSS px.
      data-boxes={JSON.stringify(list.map((r) => ({ key: r.key, cx: r.box.cx * cs, cy: r.box.cy * cs, w: r.box.w * cs, h: r.box.h * cs, rot: r.box.rot })))}
      className="absolute inset-0 z-10 select-none"
      style={{ cursor: hover ? 'move' : 'default', touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => setHover(null)}
      onDoubleClick={(e) => {
        const p = point(e);
        const hit = hitTest(p.x, p.y);
        if (hit?.text) startEdit(hit.key);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        const p = point(e);
        const hit = hitTest(p.x, p.y);
        if (!hit) return setMenu(null);
        if (!selected.includes(hit.key)) setSelected([hit.key]);
        const rect = overlayRef.current!.getBoundingClientRect();
        setMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
    >
      {hover && !selected.includes(hover) && boxOf(hover) && <div className="pointer-events-none absolute rounded-[3px] outline outline-1 outline-[#8b7dff]/80" style={boxStyle(boxOf(hover)!)} />}

      {selected.map((k) => {
        const b = boxOf(k);
        if (!b || editing?.key === k) return null;
        return (
          <div key={k} data-selected={k} className="pointer-events-none absolute outline outline-2 outline-[#8b7dff]" style={boxStyle(b)}>
            {single?.key === k && (
              <>
                <span className="absolute -top-6 left-0 rounded-[5px] bg-[#5b4bff] px-1.5 py-0.5 text-[10.5px] font-semibold whitespace-nowrap text-white">{single.label}</span>
                {HANDLES.filter(([, x, y]) => (x && y) || (x ? showSideX : showSideY)).map(([h, x, y]) => {
                  // On small elements the handles sit outside the box, so the body stays draggable.
                  const off = (v: number) => (v === 0 ? -hs / 2 : smallBox ? (v < 0 ? -hs : 0) : -hs / 2);
                  return (
                    <span
                      key={h}
                      data-handle={h}
                      className="pointer-events-auto absolute rounded-[3px] border border-[#5b4bff] bg-white shadow"
                      style={{ width: hs, height: hs, left: `calc(${(x + 1) * 50}% + ${off(x)}px)`, top: `calc(${(y + 1) * 50}% + ${off(y)}px)`, cursor: CURSOR[h] }}
                    />
                  );
                })}
                {/* Rotate handle above the box — below it when the box is near the canvas top, so it's never off-stage. */}
                <span className="absolute left-1/2 h-5 w-px -translate-x-1/2 bg-[#8b7dff]" style={rotBelow ? { bottom: -20 } : { top: -20 }} />
                <span
                  data-handle="rotate"
                  title="Drag to rotate (Shift snaps to 15°)"
                  className="pointer-events-auto absolute left-1/2 grid -translate-x-1/2 cursor-grab place-items-center rounded-full border border-[#5b4bff] bg-white text-[10px] text-[#5b4bff] shadow"
                  style={{ width: hs + 4, height: hs + 4, ...(rotBelow ? { bottom: -20 - (hs + 4) } : { top: -20 - (hs + 4) }) }}
                >
                  ⟳
                </span>
              </>
            )}
          </div>
        );
      })}

      {guides.xs.map((x) => (
        <div key={`gx${x}`} data-guide="x" className="pointer-events-none absolute top-0 bottom-0 w-px bg-[#ff4fa3]" style={{ left: x * cs }} />
      ))}
      {guides.ys.map((y) => (
        <div key={`gy${y}`} data-guide="y" className="pointer-events-none absolute right-0 left-0 h-px bg-[#ff4fa3]" style={{ top: y * cs }} />
      ))}

      {drag?.mode === 'marquee' && (
        <div
          className="pointer-events-none absolute border border-[#8b7dff] bg-[#8b7dff]/15"
          style={{ left: Math.min(drag.x0, drag.x1) * cs, top: Math.min(drag.y0, drag.y1) * cs, width: Math.abs(drag.x1 - drag.x0) * cs, height: Math.abs(drag.y1 - drag.y0) * cs }}
        />
      )}

      {selected.length >= 2 && !drag && (
        <div className="absolute top-2 left-1/2 z-20 flex -translate-x-1/2 gap-0.5 rounded-[9px] border border-white/[.14] bg-[#0f1117]/95 p-0.5 shadow-lg" onPointerDown={(e) => e.stopPropagation()}>
          {(
            [
              ['left', '⇤', 'Align left'],
              ['hcenter', '⇹', 'Align centres horizontally'],
              ['right', '⇥', 'Align right'],
              ['top', '⤒', 'Align top'],
              ['vcenter', '⇳', 'Align middles'],
              ['bottom', '⤓', 'Align bottom'],
              ['hdist', '↔', 'Distribute horizontally'],
              ['vdist', '↕', 'Distribute vertically'],
            ] as const
          ).map(([how, icon, label]) => (
            <button key={how} type="button" title={label} aria-label={label} onClick={() => align(how)} className="grid h-7 w-7 place-items-center rounded-[7px] text-[14px] text-[#e4e6ec] hover:bg-white/[.1]">
              {icon}
            </button>
          ))}
        </div>
      )}

      {menu && single && (
        <div role="menu" className="absolute z-30 w-[190px] overflow-hidden rounded-[10px] border border-white/[.12] bg-[#12141b] py-1 text-[13px] shadow-xl" style={{ left: Math.min(menu.x, W * cs - 195), top: Math.min(menu.y, H * cs - 150) }} onPointerDown={(e) => e.stopPropagation()}>
          {(
            [
              ['Bring forward', () => restack(1), list.at(-1)?.key !== single.key],
              ['Send backward', () => restack(-1), list[0]?.key !== single.key],
              ['Duplicate', duplicateSelected, single.text],
              ['Edit text', () => startEdit(single.key), single.text && !previewingTranslation],
              ['Delete', deleteSelected, single.deletable],
            ] as Array<[string, () => void, boolean]>
          ).map(([label, fn, enabled]) => (
            <button
              key={label}
              role="menuitem"
              type="button"
              disabled={!enabled}
              onClick={() => {
                setMenu(null);
                fn();
              }}
              className="block w-full px-3 py-1.5 text-left text-[#e4e6ec] hover:bg-white/[.08] disabled:text-[#5d6472] disabled:hover:bg-transparent"
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {editing && editingReport && (
        <textarea
          autoFocus
          aria-label={`Edit ${editingReport.label}`}
          value={editing.draft}
          onChange={(e) => setEditing({ ...editing, draft: e.target.value })}
          onBlur={() => finishEdit(true)}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') finishEdit(false);
            else if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              finishEdit(true);
            }
          }}
          className="absolute resize-none overflow-hidden rounded-[6px] border border-dashed border-white/80 bg-black/25 p-0 text-center leading-[1.15] font-bold text-white outline-none"
          style={{
            ...boxStyle({ ...editingReport.box, w: Math.max(editingReport.box.w, W * 0.3), h: Math.max(editingReport.box.h, (editingReport.size ?? 40) * 1.4) }),
            fontSize: (editingReport.size ?? 40) * (editingReport.box.w / editingReport.base.w) * cs,
            fontFamily: 'inherit',
          }}
        />
      )}
      {editing && <p className="pointer-events-none absolute right-2 bottom-2 left-2 rounded-[6px] bg-black/60 px-2 py-1 text-center text-[11px] text-white/90">Enter to save · Esc to cancel · wrap words in *stars* to highlight</p>}

      {(notice || (drag?.mode === 'move' && drag.moved && !touch)) && (
        <p className="pointer-events-none absolute bottom-2 left-2 rounded-[6px] bg-black/65 px-2 py-1 text-[11px] text-white/90">{notice || 'Hold Ctrl/⌘ to move without snapping'}</p>
      )}
    </div>
  );
}
