/**
 * Vector-drawn built-in icons and sprites — no image files needed. Every
 * function draws centered at the current canvas origin at the given `size`
 * (caller translates/rotates/scales first); pure drawing, no state.
 */
import type { BuiltInIcon, BuiltInSprite } from '../types';
import { rr } from '../utils';

function circle(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
}

export function drawBuiltInIcon(ctx: CanvasRenderingContext2D, icon: BuiltInIcon, size: number, color: string): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.09;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (icon === 'bell') {
    const r = size * 0.34;
    ctx.beginPath();
    ctx.arc(0, -size * 0.02, r, Math.PI * 0.92, Math.PI * 0.08, true);
    ctx.lineTo(size * 0.4, size * 0.28);
    ctx.lineTo(-size * 0.4, size * 0.28);
    ctx.closePath();
    ctx.fill();
    circle(ctx, size * 0.07);
    ctx.translate(0, size * 0.36);
    ctx.fill();
  } else if (icon === 'heart') {
    const s = size * 0.5;
    ctx.beginPath();
    ctx.moveTo(0, s * 0.32);
    ctx.bezierCurveTo(-s * 0.15, -s * 0.35, -s, -s * 0.15, 0, s * 0.75);
    ctx.bezierCurveTo(s, -s * 0.15, s * 0.15, -s * 0.35, 0, s * 0.32);
    ctx.closePath();
    ctx.fill();
  } else if (icon === 'cart') {
    const w = size * 0.62,
      h = size * 0.4;
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h / 2);
    ctx.lineTo(w / 2, -h / 2);
    ctx.lineTo(w * 0.4, h / 2);
    ctx.lineTo(-w * 0.4, h / 2);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-w / 2 - size * 0.14, -h / 2);
    ctx.lineTo(-w / 2, -h / 2);
    ctx.stroke();
    circle(ctx, size * 0.06);
    ctx.save();
    ctx.translate(-w * 0.28, h / 2 + size * 0.12);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(w * 0.22, h / 2 + size * 0.12);
    circle(ctx, size * 0.06);
    ctx.fill();
    ctx.restore();
  } else if (icon === 'check') {
    ctx.beginPath();
    ctx.moveTo(-size * 0.28, 0);
    ctx.lineTo(-size * 0.06, size * 0.24);
    ctx.lineTo(size * 0.32, -size * 0.24);
    ctx.stroke();
  } else if (icon === 'star') {
    const spikes = 5,
      outer = size * 0.5,
      inner = outer * 0.45;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = (Math.PI / spikes) * i - Math.PI / 2;
      const px = Math.cos(a) * r,
        py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function twoWheeler(ctx: CanvasRenderingContext2D, size: number, accent: string, withWindshield: boolean): void {
  const w = size,
    h = size * 0.6;
  ctx.strokeStyle = accent;
  ctx.fillStyle = accent;
  ctx.lineWidth = size * 0.07;
  [-w * 0.3, w * 0.32].forEach((cx) => {
    ctx.beginPath();
    ctx.arc(cx, h * 0.28, size * 0.16, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.beginPath();
  ctx.moveTo(-w * 0.3, h * 0.28);
  ctx.lineTo(-w * 0.05, -h * 0.1);
  ctx.lineTo(w * 0.32, h * 0.28);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-w * 0.05, -h * 0.1);
  ctx.lineTo(-w * 0.05, -h * 0.5);
  ctx.lineTo(w * 0.05, -h * 0.5);
  ctx.stroke();
  if (withWindshield) {
    rr(ctx, -w * 0.08, -h * 0.62, w * 0.3, h * 0.18, size * 0.04);
    ctx.fill();
  }
}

function car(ctx: CanvasRenderingContext2D, size: number, accent: string): void {
  const w = size,
    h = size * 0.5;
  ctx.fillStyle = accent;
  rr(ctx, -w * 0.5, -h * 0.1, w, h * 0.55, size * 0.1);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-w * 0.28, -h * 0.1);
  ctx.lineTo(-w * 0.12, -h * 0.45);
  ctx.lineTo(w * 0.22, -h * 0.45);
  ctx.lineTo(w * 0.34, -h * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#161822';
  [-w * 0.28, w * 0.28].forEach((cx) => {
    ctx.beginPath();
    ctx.arc(cx, h * 0.42, size * 0.14, 0, Math.PI * 2);
    ctx.fill();
  });
}

function pin(ctx: CanvasRenderingContext2D, size: number, accent: string): void {
  const r = size * 0.32;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(0, -r * 0.3, r, Math.PI * 0.05, Math.PI * 0.95, true);
  ctx.lineTo(0, r * 1.3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(0, -r * 0.3, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
}

function pizzaBox(ctx: CanvasRenderingContext2D, size: number, accent: string): void {
  ctx.fillStyle = accent;
  rr(ctx, -size * 0.5, -size * 0.32, size, size * 0.64, size * 0.06);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.25)';
  ctx.lineWidth = size * 0.03;
  ctx.beginPath();
  ctx.moveTo(-size * 0.5, 0);
  ctx.lineTo(size * 0.5, 0);
  ctx.stroke();
}

/** Built-in sprite shapes, facing +x (rightward) at angle 0 — the caller
 * rotates to match travel direction when `rotateAlongPath` is set. */
export function drawBuiltInSprite(ctx: CanvasRenderingContext2D, sprite: BuiltInSprite, size: number, accent: string): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (sprite === 'scooter') twoWheeler(ctx, size, accent, true);
  else if (sprite === 'bike') twoWheeler(ctx, size, accent, false);
  else if (sprite === 'car') car(ctx, size, accent);
  else if (sprite === 'pin') pin(ctx, size, accent);
  else if (sprite === 'pizza-box') pizzaBox(ctx, size, accent);
  // bell / heart / cart share the iconAnim shapes at sprite scale.
  else drawBuiltInIcon(ctx, sprite, size, accent);

  ctx.restore();
}
