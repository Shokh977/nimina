/**
 * Word layout, highlight (`*stars*`) parsing, and the per-word draw/animation
 * logic. Ported from legacy/promo-studio.html's layoutWords/textDur/drawWords.
 */
import { LETTER_STAGGER, TYPE_CPS } from './constants';
import type { ResolvedStyle, TextLayout, TextAnim } from './types';
import { clamp, easeOutCubic, easeOutBack, fontStr, rr } from './utils';

/** Wraps `text` to maxW at the given size/font/weight, parsing `*stars*` as
 * highlight markers. Call with the same ctx that will later draw it (font
 * metrics depend on ctx.font). */
export function layoutWords(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number, font: string, weight: number): TextLayout {
  ctx.font = fontStr(weight, size, font);
  const raw = String(text || '')
    .split(/\s+/)
    .filter(Boolean);
  const toks: { t: string; hi: boolean }[] = [];
  let inHi = false;
  for (let w of raw) {
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
    w = w.replace(/\*/g, '');
    if (w) toks.push({ t: w, hi });
  }
  const space = ctx.measureText(' ').width;
  const lines: TextLayout['lines'] = [];
  let curL: TextLayout['lines'][number]['words'] = [];
  let curW = 0;
  let chars = 0;
  for (const tk of toks) {
    const ww = ctx.measureText(tk.t).width;
    if (curL.length && curW + space + ww > maxW) {
      lines.push({ words: curL, width: curW });
      curL = [];
      curW = 0;
    }
    curW += (curL.length ? space : 0) + ww;
    curL.push({ ...tk, w: ww });
    chars += tk.t.length + 1;
  }
  if (curL.length) lines.push({ words: curL, width: curW });
  const lh = size * 1.12;
  return { lines, space, lh, height: lines.length * lh, count: toks.length, chars, size, font, weight };
}

/** How long (seconds) it takes for `lay`'s animation to finish appearing. */
export function textDur(lay: TextLayout, textAnim: TextAnim, stagger = 0.06): number {
  if (textAnim === 'type') return lay.chars / TYPE_CPS;
  if (textAnim === 'letters') return lay.chars * LETTER_STAGGER + 0.2;
  return lay.count * stagger + 0.3;
}

interface WordDraw {
  wd: { t: string; hi: boolean; w: number };
  x: number;
  e: number;
  vis: string;
  visW: number;
  dx: number;
  dy: number;
  a: number;
  scale: number;
  ci: number;
}

export function drawWords(
  ctx: CanvasRenderingContext2D,
  lay: TextLayout,
  x: number,
  y: number,
  align: 'center' | 'left',
  color: string,
  style: ResolvedStyle,
  local: number,
  start: number,
  alpha: number,
  stagger = 0.06,
): void {
  const mode = style.textAnim,
    hs = style.hlStyle,
    c = style.colors,
    size = lay.size;
  ctx.font = fontStr(lay.weight, size, lay.font);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  let i = 0,
    ci = 0,
    budget = mode === 'type' ? Math.floor(Math.max(0, local - start) * TYPE_CPS) : Infinity;
  let cursor: { x: number; y: number } | null = null;

  lay.lines.forEach((ln, li) => {
    let lx = align === 'center' ? x - ln.width / 2 : x;
    const ly = y + li * lay.lh;
    const ws: WordDraw[] = ln.words.map((wd) => {
      const o: WordDraw = { wd, x: lx, e: 0, vis: wd.t, visW: wd.w, dx: 0, dy: 0, a: alpha, scale: 1, ci };
      if (mode === 'type') {
        const n = Math.min(wd.t.length, budget);
        budget -= wd.t.length + 1;
        if (n > 0) {
          o.e = 1;
          if (n < wd.t.length) {
            o.vis = wd.t.slice(0, n);
            o.visW = ctx.measureText(o.vis).width;
          }
          cursor = { x: lx + o.visW, y: ly };
        }
      } else if (mode === 'letters') {
        o.e = easeOutCubic(clamp((local - start - ci * LETTER_STAGGER) / (0.4 + wd.t.length * LETTER_STAGGER)));
      } else {
        const p = clamp((local - start - i * stagger) / 0.5);
        if (mode === 'pop') {
          o.e = easeOutBack(p);
          o.scale = o.e;
          o.a = alpha * clamp(p * 2.5);
        } else {
          o.e = easeOutCubic(p);
          o.a = alpha * o.e;
        }
        if (mode === 'rise') o.dy = (1 - o.e) * size * 0.45;
        if (mode === 'slide') o.dx = (1 - o.e) * -size * 1.2;
      }
      lx += wd.w + lay.space;
      i++;
      ci += wd.t.length + 1;
      return o;
    });

    if (hs !== 'color') {
      for (let k = 0; k < ws.length; k++) {
        if (!ws[k].wd.hi) continue;
        let j = k;
        while (j + 1 < ws.length && ws[j + 1].wd.hi) j++;
        const run = ws.slice(k, j + 1),
          x0 = run[0].x;
        let shown = 0;
        run.forEach((o, n) => {
          const gap = n < run.length - 1 ? lay.space : 0;
          shown += mode === 'type' ? (o.e ? o.visW + (o.vis.length === o.wd.t.length ? gap : 0) : 0) : (o.wd.w + gap) * clamp(o.e);
        });
        if (shown > 0) {
          ctx.save();
          ctx.globalAlpha = Math.max(...run.map((o) => o.a));
          ctx.fillStyle = c.accent;
          const dx = run[0].dx;
          if (hs === 'marker') {
            const pad = size * 0.14;
            rr(ctx, x0 + dx - pad, ly, shown + pad * 2, size * 1.08, size * 0.16);
            ctx.fill();
          } else ctx.fillRect(x0 + dx, ly + size * 0.98, shown, size * 0.1);
          ctx.restore();
        }
        k = j;
      }
    }

    ws.forEach((o) => {
      const fill = o.wd.hi ? (hs === 'color' ? c.accent : hs === 'marker' ? c.a : color) : color;
      if (mode === 'letters') {
        const chars = [...o.wd.t];
        let pre = '';
        chars.forEach((ch, k) => {
          const pc = clamp((local - start - (o.ci + k) * LETTER_STAGGER) / 0.45);
          if (pc <= 0) {
            pre += ch;
            return;
          }
          const px = o.x + ctx.measureText(pre).width,
            cw = ctx.measureText(ch).width;
          ctx.save();
          ctx.globalAlpha = alpha * clamp(pc * 2);
          ctx.translate(px + cw / 2, ly + size * 0.55 - (1 - easeOutBack(pc)) * size * 0.7);
          ctx.rotate((1 - pc) * -0.5);
          ctx.fillStyle = fill;
          ctx.fillText(ch, -cw / 2, -size * 0.55);
          ctx.restore();
          pre += ch;
        });
        return;
      }
      if (o.e <= 0 || o.a <= 0) return;
      ctx.save();
      ctx.globalAlpha = o.a;
      if (o.scale !== 1) {
        const cx = o.x + o.wd.w / 2,
          cy = ly + size / 2;
        ctx.translate(cx, cy);
        ctx.scale(o.scale, o.scale);
        ctx.translate(-cx, -cy);
      }
      ctx.fillStyle = fill;
      ctx.fillText(o.vis, o.x + o.dx, ly + (hs === 'marker' && o.wd.hi ? 0 : o.dy));
      ctx.restore();
    });
  });

  if (mode === 'type' && cursor && budget <= 0 && alpha > 0) {
    const cur: { x: number; y: number } = cursor;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(cur.x + size * 0.05, cur.y + size * 0.06, size * 0.07, size * 0.95);
  }
  ctx.globalAlpha = 1;
}
