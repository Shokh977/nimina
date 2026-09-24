/**
 * Per-action-type overlay drawing: finger/tap, typed text, highlight,
 * notification banner, icon animations, success check, home screen
 * (launchApp), and loading states. Every function is a pure draw given a
 * local progress through its action — no state, safe to call for any t.
 */
import type {
  BuiltInIcon,
  HighlightAction,
  IconAnimAction,
  ImageAsset,
  LaunchAppAction,
  LoadingAction,
  LongPressAction,
  NotificationAction,
  Point,
  ResolvedStyle,
  ScreenBox,
  SuccessCheckAction,
  SwipeAction,
  TapAction,
  TypeTextAction,
} from '../types';
import { clamp, easeInOutCubic, easeOutBack, easeOutCubic, fontStr, rgba, rr } from '../utils';
import { drawBuiltInIcon } from './icons';

/* ---------- finger / gestures ---------- */

function drawFinger(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number, scale: number): void {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.shadowColor = 'rgba(0,0,0,.3)';
  ctx.shadowBlur = r * 0.6;
  ctx.shadowOffsetY = r * 0.15;
  ctx.beginPath();
  ctx.arc(x, y, r * scale, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = r * 0.14;
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  ctx.restore();
}

export function drawTapOverlay(ctx: CanvasRenderingContext2D, target: Point, local: number, action: TapAction, screenSize: number, accent: string): void {
  const p = clamp(local / Math.max(0.0001, action.duration));
  const appear = clamp(p / 0.2),
    leave = 1 - clamp((p - 0.8) / 0.2);
  const alpha = Math.min(appear, leave);
  const fr = screenSize * 0.075;

  if (action.press === 'ripple' || action.press === 'both') {
    for (let k = 0; k < 2; k++) {
      const rp = clamp((p - 0.15 - k * 0.15) / 0.6);
      if (rp <= 0 || rp >= 1) continue;
      ctx.save();
      ctx.globalAlpha *= 1 - rp;
      ctx.strokeStyle = accent;
      ctx.lineWidth = fr * 0.18;
      ctx.beginPath();
      ctx.arc(target.x, target.y, fr * (1 + rp * 2.6), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
  let scale = 1;
  if (action.press === 'press' || action.press === 'both') {
    scale = p < 0.5 ? 1 - 0.15 * easeOutCubic(clamp(p / 0.25)) : 0.85 + 0.15 * clamp((p - 0.5) / 0.3);
  }
  drawFinger(ctx, target.x, target.y, fr, alpha, scale);
}

export function drawLongPressOverlay(ctx: CanvasRenderingContext2D, target: Point, local: number, action: LongPressAction, screenSize: number, accent: string): void {
  const p = clamp(local / Math.max(0.0001, action.duration));
  const appear = clamp(p / 0.15),
    leave = 1 - clamp((p - 0.85) / 0.15);
  const alpha = Math.min(appear, leave);
  const fr = screenSize * 0.075;
  const holdProgress = clamp((p - 0.1) / 0.75);

  if (holdProgress > 0 && holdProgress < 1) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.strokeStyle = accent;
    ctx.lineWidth = fr * 0.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(target.x, target.y, fr * 1.6, -Math.PI / 2, -Math.PI / 2 + holdProgress * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  drawFinger(ctx, target.x, target.y, fr, alpha, 0.92);
}

export function drawSwipeOverlay(ctx: CanvasRenderingContext2D, from: Point, to: Point, local: number, action: SwipeAction, screenSize: number): void {
  const p = clamp(local / Math.max(0.0001, action.duration));
  const appear = clamp(p / 0.2),
    leave = 1 - clamp((p - 0.8) / 0.2);
  const move = easeInOutCubic(clamp(p / 0.75));
  const fr = screenSize * 0.075;
  const cx = from.x + (to.x - from.x) * move,
    cy = from.y + (to.y - from.y) * move;

  if (move > 0) {
    const g = ctx.createLinearGradient(from.x, from.y, cx, cy);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,0.6)');
    ctx.save();
    ctx.globalAlpha *= Math.min(appear, leave);
    ctx.strokeStyle = g;
    ctx.lineCap = 'round';
    ctx.lineWidth = fr * 1.1;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(cx, cy);
    ctx.stroke();
    ctx.restore();
  }
  drawFinger(ctx, cx, cy, fr, Math.min(appear, leave), 1);
}

/* ---------- typed text ---------- */

export function drawTypeTextOverlay(ctx: CanvasRenderingContext2D, rect: { x: number; y: number; w: number }, local: number, action: TypeTextAction, screenSize: number, style: ResolvedStyle): void {
  const size = screenSize * 0.045;
  const fieldH = size * 2.1;
  const alpha = clamp(local / 0.2);

  ctx.save();
  ctx.globalAlpha *= alpha;
  rr(ctx, rect.x, rect.y, rect.w, fieldH, fieldH * 0.22);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fill();
  ctx.lineWidth = size * 0.06;
  ctx.strokeStyle = rgba(style.colors.accent, 0.6);
  ctx.stroke();

  const visibleChars = Math.max(0, Math.floor(local * action.charsPerSecond));
  const text = action.text.slice(0, visibleChars);
  ctx.font = fontStr(600, size * 0.72, 'Figtree');
  ctx.fillStyle = '#15171C';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const tx = rect.x + fieldH * 0.4,
    ty = rect.y + fieldH / 2;
  ctx.fillText(text, tx, ty + size * 0.02);

  if (visibleChars < action.text.length || Math.floor(local * 2) % 2 === 0) {
    const caretX = tx + ctx.measureText(text).width + size * 0.05;
    ctx.fillStyle = style.colors.accent;
    ctx.fillRect(caretX, rect.y + fieldH * 0.22, size * 0.08, fieldH * 0.56);
  }
  ctx.restore();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/* ---------- highlight ---------- */

export function drawHighlightOverlay(ctx: CanvasRenderingContext2D, rect: { x: number; y: number; w: number; h: number }, screen: ScreenBox, local: number, action: HighlightAction, style: ResolvedStyle): void {
  const alpha = Math.min(clamp(local / 0.25), 1 - clamp((local - (action.duration - 0.25)) / 0.25));
  if (alpha <= 0) return;
  const pad = Math.min(rect.w, rect.h) * 0.08;
  const rrRadius = Math.min(rect.w, rect.h) * 0.14;

  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.beginPath();
  ctx.rect(screen.x, screen.y, screen.w, screen.h);
  rr(ctx, rect.x - pad, rect.y - pad, rect.w + pad * 2, rect.h + pad * 2, rrRadius);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fill('evenodd');

  rr(ctx, rect.x - pad, rect.y - pad, rect.w + pad * 2, rect.h + pad * 2, rrRadius);
  ctx.lineWidth = pad * 0.35;
  ctx.strokeStyle = style.colors.accent;
  ctx.shadowColor = rgba(style.colors.accent, 0.6);
  ctx.shadowBlur = pad;
  ctx.stroke();
  ctx.restore();
}

/* ---------- notification ---------- */

export function drawNotificationOverlay(ctx: CanvasRenderingContext2D, screen: ScreenBox, local: number, action: NotificationAction, iconAsset: ImageAsset | null, screenSize: number, font: { name: string; h: number; s: number }): void {
  const inDur = 0.4,
    holdEnd = Math.max(inDur, action.duration - 0.4);
  let y: number;
  let alpha = 1;
  if (local < inDur) {
    const p = easeOutBack(clamp(local / inDur));
    y = -1 + p;
    alpha = clamp(local / (inDur * 0.5));
  } else if (local < holdEnd) {
    y = 1;
  } else {
    const p = clamp((local - holdEnd) / Math.max(0.0001, action.duration - holdEnd));
    y = 1 - easeInOutCubic(p);
    alpha = 1 - p;
  }
  if (alpha <= 0) return;

  const margin = screenSize * 0.03;
  const cardH = screenSize * 0.16;
  const cardW = screen.w - margin * 2;
  const cardX = screen.x + margin;
  const restY = screen.y + margin;
  // Only floor-clamp y (not the top) so the bounce-in's easeOutBack
  // overshoot past 1 can still dip the card slightly past its rest position.
  const cardY = restY - (1 - Math.max(0, y)) * (cardH + margin * 2);

  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.beginPath();
  ctx.rect(screen.x, screen.y, screen.w, screen.h);
  ctx.clip();
  ctx.shadowColor = 'rgba(0,0,0,.35)';
  ctx.shadowBlur = screenSize * 0.03;
  ctx.shadowOffsetY = screenSize * 0.01;
  rr(ctx, cardX, cardY, cardW, cardH, cardH * 0.26);
  ctx.fillStyle = 'rgba(255,255,255,0.97)';
  ctx.fill();
  ctx.shadowColor = 'transparent';

  const iconSize = cardH * 0.56;
  const iconCx = cardX + cardH * 0.5,
    iconCy = cardY + cardH * 0.5;
  if (iconAsset) {
    ctx.save();
    rr(ctx, iconCx - iconSize / 2, iconCy - iconSize / 2, iconSize, iconSize, iconSize * 0.28);
    ctx.clip();
    ctx.drawImage(iconAsset, iconCx - iconSize / 2, iconCy - iconSize / 2, iconSize, iconSize);
    ctx.restore();
  } else {
    ctx.fillStyle = '#3346FF';
    rr(ctx, iconCx - iconSize / 2, iconCy - iconSize / 2, iconSize, iconSize, iconSize * 0.28);
    ctx.fill();
    ctx.save();
    ctx.translate(iconCx, iconCy);
    drawBuiltInIcon(ctx, 'bell', iconSize * 0.55, '#fff');
    ctx.restore();
  }

  const textX = cardX + cardH * 1.05;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#15171C';
  ctx.font = fontStr(800, cardH * 0.24, font.name);
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(action.title, textX, cardY + cardH * 0.42);
  ctx.fillStyle = '#5D6371';
  ctx.font = fontStr(500, cardH * 0.2, font.name);
  ctx.fillText(action.body, textX, cardY + cardH * 0.7);
  ctx.restore();
}

/* ---------- icon animation ---------- */

export function drawIconAnimOverlay(ctx: CanvasRenderingContext2D, target: Point, local: number, action: IconAnimAction, screenSize: number, style: ResolvedStyle): void {
  const p = clamp(local / Math.max(0.0001, action.duration));
  const alpha = Math.min(clamp(p / 0.15), 1 - clamp((p - 0.85) / 0.15));
  if (alpha <= 0) return;
  const size = screenSize * 0.09;

  ctx.save();
  ctx.translate(target.x, target.y);
  ctx.globalAlpha *= alpha;
  ctx.shadowColor = 'rgba(0,0,0,.3)';
  ctx.shadowBlur = size * 0.3;
  ctx.shadowOffsetY = size * 0.08;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.62, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.shadowColor = 'transparent';

  if (action.anim === 'ring') ctx.rotate(Math.sin(p * Math.PI * 6) * 0.22 * (1 - p));
  else if (action.anim === 'bounce') {
    const b = Math.abs(Math.sin(p * Math.PI * 3)) * (1 - p * 0.6);
    ctx.translate(0, -b * size * 0.35);
  } else if (action.anim === 'pulse') {
    const s = 1 + Math.sin(p * Math.PI * 4) * 0.12 * (1 - p * 0.4);
    ctx.scale(s, s);
  } else if (action.anim === 'pop') {
    const s = easeOutBack(clamp(p / 0.4));
    ctx.scale(s, s);
  }
  drawBuiltInIcon(ctx, action.builtIn as BuiltInIcon, size * 0.68, style.colors.accent);
  ctx.restore();
}

/* ---------- success check ---------- */

export function drawSuccessCheckOverlay(ctx: CanvasRenderingContext2D, target: Point, local: number, action: SuccessCheckAction, screenSize: number, style: ResolvedStyle): void {
  const p = clamp(local / Math.max(0.0001, action.duration));
  const ringP = easeOutCubic(clamp(p / 0.4));
  const checkP = clamp((p - 0.3) / 0.4);
  const alpha = 1 - clamp((p - 0.85) / 0.15);
  if (alpha <= 0 || ringP <= 0) return;
  const r = screenSize * 0.1;

  ctx.save();
  ctx.translate(target.x, target.y);
  ctx.globalAlpha *= alpha;
  ctx.scale(easeOutBack(ringP), easeOutBack(ringP));
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = style.colors.accent;
  ctx.fill();

  if (checkP > 0) {
    const pts: Point[] = [
      { x: -r * 0.45, y: 0 },
      { x: -r * 0.12, y: r * 0.35 },
      { x: r * 0.5, y: -r * 0.35 },
    ];
    const total = 2;
    const drawn = clamp(checkP) * total;
    ctx.lineWidth = r * 0.18;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = style.colors.a;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    if (drawn <= 1) {
      const t = drawn;
      ctx.lineTo(pts[0].x + (pts[1].x - pts[0].x) * t, pts[0].y + (pts[1].y - pts[0].y) * t);
    } else {
      ctx.lineTo(pts[1].x, pts[1].y);
      const t = drawn - 1;
      ctx.lineTo(pts[1].x + (pts[2].x - pts[1].x) * t, pts[1].y + (pts[2].y - pts[1].y) * t);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/* ---------- home screen (launchApp) ---------- */

export function drawHomeScreen(ctx: CanvasRenderingContext2D, screen: ScreenBox, local: number, action: LaunchAppAction, iconAsset: ImageAsset | null, screenSize: number, style: ResolvedStyle): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(screen.x, screen.y, screen.w, screen.h);
  ctx.clip();

  if (action.wallpaper.kind === 'color') {
    ctx.fillStyle = action.wallpaper.color;
    ctx.fillRect(screen.x, screen.y, screen.w, screen.h);
  } else {
    const g = ctx.createLinearGradient(screen.x, screen.y, screen.x, screen.y + screen.h);
    g.addColorStop(0, action.wallpaper.from);
    g.addColorStop(1, action.wallpaper.to);
    ctx.fillStyle = g;
    ctx.fillRect(screen.x, screen.y, screen.w, screen.h);
  }

  const cell = screen.w / 4.6;
  const iconSize = cell * 0.62;
  const cols = 4,
    rows = 5;
  const gridW = cell * cols,
    gridX = screen.x + (screen.w - gridW) / 2,
    gridY = screen.y + screen.h * 0.1;
  const palette = ['rgba(255,255,255,.35)', 'rgba(255,255,255,.22)', 'rgba(0,0,0,.18)'];
  let n = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = gridX + cell * (col + 0.5),
        cy = gridY + cell * (row + 0.5);
      // No need to skip the real app icon's cell: it's drawn on top below,
      // at the same size/position, so it fully occludes any placeholder.
      rr(ctx, cx - iconSize / 2, cy - iconSize / 2, iconSize, iconSize, iconSize * 0.26);
      ctx.fillStyle = palette[n % palette.length];
      ctx.fill();
      n++;
    }
  }

  // App icon: tap around 55-75% through the action, then scale up to fill the screen.
  const iconCx = screen.x + action.iconPosition.x * screen.w,
    iconCy = screen.y + action.iconPosition.y * screen.h;
  const zoomP = easeInOutCubic(clamp((local - action.duration * 0.6) / Math.max(0.0001, action.duration * 0.4 - 0.001)));
  const curSize = iconSize + (Math.max(screen.w, screen.h) * 1.6 - iconSize) * zoomP;
  const curCx = iconCx + (screen.x + screen.w / 2 - iconCx) * zoomP,
    curCy = iconCy + (screen.y + screen.h / 2 - iconCy) * zoomP;
  const radius = iconSize * 0.26 + (0 - iconSize * 0.26) * zoomP;

  if (action.duration > 0 && local >= action.duration * 0.55 && local < action.duration * 0.7) {
    const tapP = clamp((local - action.duration * 0.55) / (action.duration * 0.15));
    drawFinger(ctx, iconCx, iconCy, iconSize * 0.5, 1 - Math.abs(tapP * 2 - 1), 0.9 + 0.1 * Math.sin(tapP * Math.PI));
  }

  ctx.save();
  rr(ctx, curCx - curSize / 2, curCy - curSize / 2, curSize, curSize, radius);
  ctx.clip();
  if (iconAsset) {
    ctx.drawImage(iconAsset, curCx - curSize / 2, curCy - curSize / 2, curSize, curSize);
  } else {
    ctx.fillStyle = style.colors.accent;
    ctx.fillRect(curCx - curSize / 2, curCy - curSize / 2, curSize, curSize);
  }
  ctx.restore();
  ctx.restore();
}

/* ---------- loading ---------- */

export function drawLoading(ctx: CanvasRenderingContext2D, screen: ScreenBox, t: number, local: number, action: LoadingAction, logoAsset: ImageAsset | null, style: ResolvedStyle): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(screen.x, screen.y, screen.w, screen.h);
  ctx.clip();
  ctx.fillStyle = style.colors.b;
  ctx.fillRect(screen.x, screen.y, screen.w, screen.h);
  const cx = screen.x + screen.w / 2,
    cy = screen.y + screen.h / 2;

  if (action.style === 'splash') {
    const size = Math.min(screen.w, screen.h) * 0.26;
    const pop = easeOutBack(clamp(local / 0.5));
    const pulse = 1 + Math.sin(t * 2.4) * 0.02;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pop * pulse, pop * pulse);
    if (logoAsset) {
      ctx.save();
      rr(ctx, -size / 2, -size / 2, size, size, size * 0.24);
      ctx.clip();
      ctx.drawImage(logoAsset, -size / 2, -size / 2, size, size);
      ctx.restore();
    } else {
      ctx.fillStyle = style.colors.accent;
      rr(ctx, -size / 2, -size / 2, size, size, size * 0.24);
      ctx.fill();
    }
    ctx.restore();
  } else if (action.style === 'spinner') {
    const r = Math.min(screen.w, screen.h) * 0.06;
    ctx.strokeStyle = rgba(style.colors.text, 0.9);
    ctx.lineWidth = r * 0.28;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, r, t * 4.5, t * 4.5 + Math.PI * 1.3);
    ctx.stroke();
  } else {
    const barW = screen.w * 0.72,
      barX = cx - barW / 2,
      barH = screen.h * 0.028,
      gap = barH * 1.4;
    const widths = [1, 0.75, 0.9, 0.6];
    widths.forEach((wf, i) => {
      const y = cy - (barH + gap) * 1.5 + i * (barH + gap);
      const shimmer = 0.5 + 0.5 * Math.sin(t * 3 + i * 0.6);
      ctx.fillStyle = rgba(style.colors.text, 0.12 + shimmer * 0.1);
      rr(ctx, barX, y, barW * wf, barH, barH / 2);
      ctx.fill();
    });
  }
  ctx.restore();
}
