/**
 * Deterministic seeded particles — ported from the reference's particles():
 * same seed always produces the same per-particle spread/speed/spin/size,
 * in both preview and export. The reference re-seeds a fresh RNG every
 * frame (so each particle's per-particle constants are a pure function of
 * (seed, index), never accumulated state); this precomputes those constants
 * once per burst instead of every frame, which is the same observable
 * result for less work.
 */
import * as THREE from 'three';

import { clamp01 } from './spring';
import { makeCanvas, textureFromCanvas } from './texture';
import { rng } from './rng';
import type { ParticleBurstDef } from './types';

interface ParticleParams {
  a: number;
  sp: number;
  rot0: number;
  spin: number;
  sz: number;
}

export interface ParticleBurst {
  meshes: THREE.Sprite[];
  params: ParticleParams[];
  def: ParticleBurstDef;
}

const HEART_GLYPHS = ['💖', '✨', '❤️', '💖'];
const CONFETTI_COLORS = ['#FFD23F', '#FFFFFF', '#34D399'];
const STAR_COLORS = ['#FFD23F', '#FFF4C2', '#FFB020'];
const COIN_COLORS = ['#FFD23F', '#F2B705'];

function heartTexture(glyph: string, size: number): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(size, size);
  ctx.font = `${size * 0.8}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, size / 2, size / 2);
  return textureFromCanvas(canvas);
}

function confettiTexture(color: string, round: boolean): THREE.CanvasTexture {
  const size = 64;
  const { canvas, ctx } = makeCanvas(size, size);
  ctx.fillStyle = color;
  if (round) {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(8, size * 0.35, size - 16, size * 0.3);
  }
  return textureFromCanvas(canvas);
}

/** A thin 4-point glint/sparkle — vector-drawn (not an emoji glyph) so it
 * stays crisp and consistent across platforms at small sizes. */
function sparkleTexture(color: string): THREE.CanvasTexture {
  const size = 64,
    c = size / 2;
  const { canvas, ctx } = makeCanvas(size, size);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(c, 2);
  ctx.quadraticCurveTo(c + 5, c - 5, size - 2, c);
  ctx.quadraticCurveTo(c + 5, c + 5, c, size - 2);
  ctx.quadraticCurveTo(c - 5, c + 5, 2, c);
  ctx.quadraticCurveTo(c - 5, c - 5, c, 2);
  ctx.closePath();
  ctx.fill();
  return textureFromCanvas(canvas);
}

/** A classic filled 5-point star. */
function starTexture(color: string): THREE.CanvasTexture {
  const size = 64,
    cx = size / 2,
    cy = size / 2,
    outerR = size * 0.46,
    innerR = outerR * 0.42;
  const { canvas, ctx } = makeCanvas(size, size);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const x = cx + Math.cos(a) * r,
      y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  return textureFromCanvas(canvas);
}

/** A simple gold coin — radial-gradient face, darker rim. */
function coinTexture(): THREE.CanvasTexture {
  const size = 64,
    c = size / 2;
  const { canvas, ctx } = makeCanvas(size, size);
  const g = ctx.createRadialGradient(c - 6, c - 6, 4, c, c, c - 4);
  g.addColorStop(0, '#FFF4C2');
  g.addColorStop(0.6, COIN_COLORS[0]);
  g.addColorStop(1, COIN_COLORS[1]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c, c, c - 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#B8860B';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(c, c, c - 5, 0, Math.PI * 2);
  ctx.stroke();
  return textureFromCanvas(canvas);
}

export function buildParticleBurst(def: ParticleBurstDef, group: THREE.Group, accentColor: string, uiColor: string): ParticleBurst {
  const r = rng(def.id.length * 1000 + def.seedOffset);
  const meshes: THREE.Sprite[] = [];
  const params: ParticleParams[] = [];
  const palette = def.kind === 'hearts' ? HEART_GLYPHS : def.kind === 'stars' ? STAR_COLORS : def.kind === 'sparkles' ? ['#FFFFFF', ...STAR_COLORS] : [accentColor, uiColor, ...CONFETTI_COLORS];

  for (let i = 0; i < def.count; i++) {
    const a = def.dir + (r() - 0.5) * def.spread;
    const sp = def.speed * (0.45 + r() * 0.85);
    const rot0 = r() * 360;
    const spin = (r() - 0.5) * 900;
    const sz = 0.6 + r() * 0.8;
    params.push({ a, sp, rot0, spin, sz });

    let tex: THREE.CanvasTexture;
    if (def.kind === 'hearts') tex = heartTexture(HEART_GLYPHS[i % HEART_GLYPHS.length], 96);
    else if (def.kind === 'sparkles') tex = sparkleTexture(palette[i % palette.length] as string);
    else if (def.kind === 'stars') tex = starTexture(palette[i % palette.length] as string);
    else if (def.kind === 'coins') tex = coinTexture();
    else tex = confettiTexture(palette[i % palette.length] as string, i % 4 === 0);

    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.visible = false;
    group.add(sprite);
    meshes.push(sprite);
  }
  return { meshes, params, def };
}

/** `t0` is the absolute scene time the burst starts at. */
export function updateParticleBurst(t: number, burst: ParticleBurst, originX: number, originY: number, originZ: number): void {
  const T = t - burst.def.at;
  burst.meshes.forEach((sprite, i) => {
    const p = burst.params[i];
    if (T < 0 || T > burst.def.life) {
      sprite.visible = false;
      return;
    }
    sprite.visible = true;
    const ex = (1 - Math.exp(-2.4 * T)) / 2.4;
    const x = Math.cos(p.a) * p.sp * ex;
    const y = Math.sin(p.a) * p.sp * ex + 0.5 * burst.def.gravity * T * T;
    const life = clamp01(1 - (T - burst.def.life * 0.55) / (burst.def.life * 0.45));
    const scale = p.sz * clamp01(T * 8) * 34;
    sprite.material.opacity = life;
    sprite.material.rotation = THREE.MathUtils.degToRad(p.rot0 + p.spin * T);
    sprite.scale.set(scale, scale, 1);
    // Reference is CSS (y-down); Three.js world is y-up, so flip y.
    sprite.position.set(originX + x, originY - y, originZ);
  });
}
