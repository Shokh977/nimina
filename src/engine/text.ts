/**
 * Word layout, highlight (`*stars*`) parsing, and the per-word draw/animation
 * logic. Ported from legacy/promo-studio.html's layoutWords/textDur/drawWords.
 */
import { LETTER_STAGGER, TYPE_CPS } from './constants';
import { currentTextLocale } from './locales';
import type { ResolvedStyle, TextLayout, TextAnim, TextToken } from './types';
import { clamp, easeOutCubic, easeOutBack, fontStr, graphemes, rr } from './utils';

/* ---------- line breaking for scripts without spaces ---------- */

/** Chinese/Japanese (Han, kana, CJK punctuation, full-width forms) and
 * Thai — written without spaces between words, so a whitespace-split
 * "word" can be a whole sentence. Those runs are broken into words with
 * Intl.Segmenter instead. Korean uses spaces and needs nothing special. */
export const UNSPACED = /[\u3000-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef\u0e00-\u0e7f]/;
/** May not start a line (closing punctuation, small kana, prolonged sound
 * mark) — kinsoku shori, simplified: such a segment sticks to the one before. */
const NO_LINE_START = /^[、。，．,.!?！？：；:;」』）)】〕〉》〙〗〟’”ー〜…・ぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶ々〻ゝゞヽヾ]/;
/** May not end a line (opening brackets/quotes): the next segment sticks to it. */
const NO_LINE_END = /[「『（(【〔〈《〘〖〝‘“]$/;
/** Scripts whose letters can't be drawn one at a time. */
const JOINED_SCRIPTS = /[\u0590-\u08ff\u0900-\u0dff\u0e00-\u0e7f\ufb1d-\ufdff\ufe70-\ufeff]/;

const segmenters = new Map<string, Intl.Segmenter>();
/** Breakable units of an unspaced run: Intl.Segmenter word boundaries
 * where the browser has it, otherwise one grapheme per unit (still a valid
 * CJK break point everywhere but inside the punctuation pairs below). */
export function segmentUnspaced(text: string, lang: string): string[] {
  let parts: string[];
  try {
    if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
      let seg = segmenters.get(lang);
      if (!seg) segmenters.set(lang, (seg = new Intl.Segmenter(lang, { granularity: 'word' })));
      parts = [...seg.segment(text)].map((x) => x.segment);
    } else parts = graphemes(text);
  } catch {
    parts = graphemes(text);
  }
  const out: string[] = [];
  for (const part of parts) {
    if (out.length && noBreakBetween(out[out.length - 1], part)) out[out.length - 1] += part;
    else out.push(part);
  }
  return out;
}

/** Whether a line may not break between two adjacent unspaced segments. */
export function noBreakBetween(prev: string, part: string): boolean {
  return (
    NO_LINE_START.test(part) ||
    NO_LINE_END.test(prev) ||
    // Katakana compounds (サイン+イン) read as one word.
    (KATAKANA_END.test(prev) && KATAKANA_START.test(part)) ||
    // Particles and okurigana stay with the word before them (アプリ+を,
    // 選ん+で), so a line never starts with one — the usual phrase-level
    // (bunsetsu) break for Japanese headlines.
    (HIRAGANA_ONLY.test(part) && KANA_OR_KANJI_END.test(prev) && prev.length + part.length <= 12)
  );
}
const KATAKANA_START = /^[ァ-ヿ]/;
const KATAKANA_END = /[ァ-ヿ]$/;
const HIRAGANA_ONLY = /^[ぁ-ゟ]+$/;
const KANA_OR_KANJI_END = /[ぁ-ヿ㐀-䶿一-鿿]$/;

/** Wraps `text` to maxW at the given size/font/weight, parsing `*stars*` as
 * highlight markers. Call with the same ctx that will later draw it (font
 * metrics depend on ctx.font). */
export function layoutWords(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number, font: string, weight: number): TextLayout {
  ctx.font = fontStr(weight, size, font);
  const loc = currentTextLocale();
  const raw = String(text || '')
    .split(/\s+/)
    .filter(Boolean);
  // `tight`: joins the previous token with no space (segments of one
  // unspaced CJK run). `stick`: also may not be separated from it by a
  // line break — the same rules segmentUnspaced applies, across a
  // highlight boundary (*ローンチ*しよう), where the two can't be one token.
  const toks: { t: string; hi: boolean; tight: boolean; stick: boolean }[] = [];
  let inHi = false;
  for (let w of raw) {
    if (UNSPACED.test(w)) {
      // No spaces to put *highlight* markers next to, so in these runs a
      // star toggles the highlight wherever it appears.
      let hi: boolean = inHi,
        buf = '',
        first = true;
      const flush = () => {
        if (!buf) return;
        for (const seg of segmentUnspaced(buf, loc.lang)) {
          const prev = toks[toks.length - 1];
          toks.push({ t: seg, hi, tight: !first, stick: !first && !!prev && noBreakBetween(prev.t, seg) });
          first = false;
        }
        buf = '';
      };
      for (const ch of w) {
        if (ch === '*') {
          flush();
          hi = !hi;
        } else buf += ch;
      }
      flush();
      inHi = hi;
      continue;
    }
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
    if (w) toks.push({ t: w, hi, tight: false, stick: false });
  }
  const space = ctx.measureText(' ').width;
  const lines: TextLayout['lines'] = [];
  let curL: TextLayout['lines'][number]['words'] = [];
  let curW = 0;
  let chars = 0;
  // Wraps whole groups — a token plus any `stick` tokens after it (for
  // spaced scripts every group is a single word, exactly as before).
  for (let i = 0; i < toks.length; ) {
    let j = i + 1;
    while (j < toks.length && toks[j].stick) j++;
    const group = toks.slice(i, j).map((tk) => ({ ...tk, w: ctx.measureText(tk.t).width, gap: tk.tight ? 0 : space }));
    const groupW = group.reduce((sum, g, k) => sum + (k ? g.gap : 0) + g.w, 0);
    if (curL.length && curW + group[0].gap + groupW > maxW) {
      lines.push({ words: curL, width: curW });
      curL = [];
      curW = 0;
    }
    for (const g of group) {
      curW += (curL.length ? g.gap : 0) + g.w;
      curL.push({ t: g.t, hi: g.hi, w: g.w, gap: g.gap });
      chars += g.t.length + 1;
    }
    i = j;
  }
  if (curL.length) lines.push({ words: curL, width: curW });
  const lh = size * 1.12;
  const splitLetters = loc.dir === 'ltr' && !JOINED_SCRIPTS.test(String(text || ''));
  return { lines, space, lh, height: lines.length * lh, count: toks.length, chars, size, font, weight, dir: loc.dir, splitLetters };
}

/** Letter drop can't split joined scripts — those animate per word. */
function effectiveAnim(lay: TextLayout, textAnim: TextAnim): TextAnim {
  return textAnim === 'letters' && !lay.splitLetters ? 'rise' : textAnim;
}

/** Strongly left-to-right (Latin letters, digits) and no RTL letters. */
const isLtrWord = (t: string) => /[A-Za-z0-9\u00c0-\u024f\u0400-\u04ff]/.test(t) && !/[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufeff]/.test(t);

/** x of each word on a line (by logical index). RTL lines run right to
 * left, except that consecutive left-to-right words (an app name, "Pro",
 * a number) keep their own reading order inside the run — the word-level
 * part of the Unicode bidi algorithm that matters for promo copy. */
function wordXs(words: TextToken[], lineWidth: number, x: number, align: 'center' | 'left' | 'right', space: number, dir: 'ltr' | 'rtl'): number[] {
  const xs = new Array<number>(words.length);
  if (dir === 'ltr') {
    let lx = align === 'center' ? x - lineWidth / 2 : align === 'right' ? x - lineWidth : x;
    words.forEach((wd, k) => {
      xs[k] = lx;
      lx += wd.w + (words[k + 1]?.gap ?? space);
    });
    return xs;
  }
  const order: number[] = [];
  for (let k = 0; k < words.length; ) {
    let j = k;
    if (isLtrWord(words[k].t)) while (j + 1 < words.length && isLtrWord(words[j + 1].t)) j++;
    for (let n = j; n >= k; n--) order.push(n);
    k = j + 1;
  }
  let rx = align === 'center' ? x + lineWidth / 2 : align === 'right' ? x : x + lineWidth;
  order.forEach((k, n) => {
    xs[k] = rx - words[k].w;
    rx = xs[k] - (n + 1 < order.length ? space : 0);
  });
  return xs;
}

/** How long (seconds) it takes for `lay`'s animation to finish appearing. */
export function textDur(lay: TextLayout, textAnim: TextAnim, stagger = 0.06): number {
  textAnim = effectiveAnim(lay, textAnim);
  if (textAnim === 'type') return lay.chars / TYPE_CPS;
  if (textAnim === 'letters') return lay.chars * LETTER_STAGGER + 0.2;
  return lay.count * stagger + 0.3;
}

interface WordDraw {
  wd: TextToken;
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
  align: 'center' | 'left' | 'right',
  color: string,
  style: ResolvedStyle,
  local: number,
  start: number,
  alpha: number,
  stagger = 0.06,
): void {
  const mode = effectiveAnim(lay, style.textAnim),
    rtl = lay.dir === 'rtl',
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
    const xs = wordXs(ln.words, ln.width, x, align, lay.space, lay.dir);
    const ly = y + li * lay.lh;
    const ws: WordDraw[] = ln.words.map((wd, k) => {
      const lx = xs[k];
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
          // RTL text appears from its right edge, so the cursor sits left of it.
          cursor = rtl ? { x: lx + wd.w - o.visW - size * 0.17, y: ly } : { x: lx + o.visW, y: ly };
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
        if (mode === 'slide') o.dx = (1 - o.e) * (rtl ? size : -size) * 1.2;
      }
      i++;
      ci += wd.t.length + 1;
      return o;
    });

    if (hs !== 'color') {
      for (let k = 0; k < ws.length; k++) {
        if (!ws[k].wd.hi) continue;
        let j = k;
        while (j + 1 < ws.length && ws[j + 1].wd.hi) j++;
        const run = ws.slice(k, j + 1);
        let shown = 0;
        run.forEach((o, n) => {
          const gap = n < run.length - 1 ? run[n + 1].wd.gap : 0;
          shown += mode === 'type' ? (o.e ? o.visW + (o.vis.length === o.wd.t.length ? gap : 0) : 0) : (o.wd.w + gap) * clamp(o.e);
        });
        // RTL highlights grow from the run's right edge, like its text.
        const x0 = rtl ? Math.max(...run.map((o) => o.x + o.wd.w)) - shown : run[0].x;
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
      ctx.fillText(o.vis, o.x + o.dx + (rtl ? o.wd.w - o.visW : 0), ly + (hs === 'marker' && o.wd.hi ? 0 : o.dy));
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
