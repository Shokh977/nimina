/** Reaction burst: an emoji pops with flying particle copies, plus a like
 * counter ticking up next to it — the two paired behaviors the prompt asks
 * for in one element. */
import { clamp01, easeInOut, SP } from '../../spring';
import { anticipatePop, idleFloat } from '../draw';
import { registerElement } from '../registry';
import { rng } from '../../rng';
import { fontStr } from '../theme';
import { roundRectPath } from '../../texture';
import type { UIElementDef } from '../types';

export interface ReactionBurstProps {
  emoji: string;
  particleCount: number;
  countFrom: number;
  countTo: number;
  seed: number;
}

interface Particle {
  angle: number;
  speed: number;
  spin: number;
  scale: number;
  delay: number;
}

function buildParticles(count: number, seed: number): Particle[] {
  const r = rng(seed * 7919 + 3);
  const out: Particle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      angle: -Math.PI / 2 + (r() - 0.5) * Math.PI * 1.3,
      speed: 70 + r() * 90,
      spin: (r() - 0.5) * 6,
      scale: 0.5 + r() * 0.5,
      delay: r() * 0.15,
    });
  }
  return out;
}

const reactionBurst: UIElementDef<ReactionBurstProps> = {
  id: 'reactionBurst',
  label: 'Reaction burst',
  category: 'Effects',
  defaultProps: { emoji: '❤️', particleCount: 10, countFrom: 1846, countTo: 1847, seed: 7 },
  propsSchema: [
    { key: 'emoji', kind: 'emoji', label: 'Emoji' },
    { key: 'particleCount', kind: 'number', label: 'Particles', min: 0, max: 24, step: 1 },
    { key: 'countFrom', kind: 'number', label: 'Count from', min: 0, max: 100000, step: 1 },
    { key: 'countTo', kind: 'number', label: 'Count to', min: 0, max: 100000, step: 1 },
    { key: 'seed', kind: 'number', label: 'Seed', min: 1, max: 999, step: 1 },
  ],
  naturalSize: { w: 220, h: 140 },
  draw(ctx, w, h, t, props, theme) {
    const cx = w * 0.36,
      cy = h * 0.55;
    const particles = buildParticles(props.particleCount, props.seed);

    ctx.save();
    particles.forEach((pt, i) => {
      const local = t - 0.08 - pt.delay;
      if (local < 0) return;
      const life = clamp01(local / 0.9);
      const dist = pt.speed * Math.min(local, 0.9) * (1 - life * 0.25);
      const x = cx + Math.cos(pt.angle) * dist;
      const y = cy + Math.sin(pt.angle) * dist + life * life * 40;
      const opacity = 1 - clamp01((local - 0.55) / 0.35);
      if (opacity <= 0.01) return;
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.translate(x, y);
      ctx.rotate(pt.spin * local);
      ctx.font = `${18 * pt.scale}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(props.emoji, 0, 0);
      ctx.restore();
      void i;
    });
    ctx.restore();

    const pop = anticipatePop(t, 0.06, 0.07, 0.08, SP.bouncy);
    ctx.save();
    ctx.translate(cx, cy + idleFloat(t, 1.2, 3.4));
    ctx.scale(Math.max(0.001, pop), Math.max(0.001, pop));
    ctx.font = '34px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(props.emoji, 0, 0);
    ctx.restore();

    // Like-counter badge, ticking from countFrom to countTo on the same beat.
    const cp = clamp01(easeInOut(clamp01((t - 0.15) / 0.5)));
    const count = Math.round(props.countFrom + (props.countTo - props.countFrom) * cp);
    const label = count.toLocaleString();
    ctx.font = fontStr(800, 22, theme.fontDisplay);
    const bw = ctx.measureText(label).width + 28,
      bh = 40;
    const bx = cx + 34,
      by = cy - bh / 2;
    ctx.save();
    ctx.translate(bx, by + idleFloat(t, 1, 3.6, 1));
    roundRectPath(ctx, 0, 0, bw, bh, bh / 2);
    ctx.fillStyle = theme.surface;
    ctx.fill();
    ctx.fillStyle = theme.text;
    ctx.font = fontStr(800, 20, theme.fontDisplay);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bw / 2, bh / 2 + 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  },
};

registerElement(reactionBurst);
