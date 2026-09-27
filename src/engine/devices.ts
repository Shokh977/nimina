/**
 * Device frame geometry/drawing, on-screen gesture indicators, badges and
 * callouts. Ported from legacy/promo-studio.html's
 * screenBox/imgRect/frameColor/drawDevice/focusLocal/drawGesture/
 * drawBadge/drawCallout.
 */
import { FCOLORS, MODELS } from "./constants";
import {
  cameraForDevice3d,
  DEG,
  drawTexturedQuad3d,
  facesCamera3d,
  pathFrom3d,
  roundRectPoints3d,
  rotate3d,
  xform3d,
  type Point2,
  type Point3,
} from "./pose3d";
import { resolveEasing } from "./story/easing";
import type {
  CounterConfig,
  FontDef,
  FrameColorId,
  FrameColorResolved,
  ImageAsset,
  ImgRect,
  ModelKey,
  Pose3D,
  ResolvedStyle,
  ScreenBox,
  ImageSlide,
} from "./types";
import {
  clamp,
  cover,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  fontStr,
  hexRGB,
  imgH,
  imgW,
  rgba,
  rr,
  shade,
  slug,
} from "./utils";

export function screenBox(PW: number, PH: number, model: ModelKey) {
  const m = MODELS[model];
  if (m.cut === "none")
    return { x: -PW / 2, y: -PH / 2, w: PW, h: PH, r: PW * m.r };
  if (m.cut === "browser") {
    const bar = PH * 0.085;
    return { x: -PW / 2, y: -PH / 2 + bar, w: PW, h: PH - bar, r: 0, bar };
  }
  const b = PW * m.bez;
  return {
    x: -PW / 2 + b,
    y: -PH / 2 + b,
    w: PW - 2 * b,
    h: PH - 2 * b,
    r: PW * m.sr,
  };
}

export function imgRect(
  img: ImageAsset,
  sb: { w: number; h: number },
  scroll = 0,
): ImgRect {
  const r = cover(imgW(img), imgH(img), sb.w, sb.h);
  if (scroll > 0 && r.h > sb.h) r.y = -(r.h - sb.h) * scroll;
  return r;
}

export function frameColor(
  fcolor: FrameColorId,
  accent: string,
): FrameColorResolved {
  const f = FCOLORS.find((c) => c.id === fcolor) || FCOLORS[0];
  if (f.id !== "theme") return f as FrameColorResolved;
  return {
    body: accent,
    btn: shade(accent, -0.22),
    edge: "rgba(255,255,255,.35)",
    chrome: shade(accent, 0.78),
    chromeInk: shade(accent, -0.55),
  };
}

export function drawDevice(
  ctx: CanvasRenderingContext2D,
  img: ImageAsset | null,
  PW: number,
  PH: number,
  style: ResolvedStyle,
  appName: string,
  scroll = 0,
  /** Replaces the default "cover-fit `img`, with a scroll offset" screen
   * content with custom drawing — used by the story-slide renderer, which
   * needs to blend between two screens mid-transition. Receives the
   * already-computed screen box (in the same local/rotated coordinate
   * space `ctx` is currently transformed into) and must fill it. When
   * omitted, behavior is identical to before this parameter existed. */
  paintScreenOverride?: (ctx: CanvasRenderingContext2D, sb: ScreenBox) => void,
): void {
  const m = MODELS[style.model],
    fc = frameColor(style.fcolor, style.colors.accent),
    sb = screenBox(PW, PH, style.model);
  const shadow = () => {
    ctx.shadowColor = "rgba(8,10,24,0.4)";
    ctx.shadowBlur = Math.max(PW, PH) * 0.06;
    ctx.shadowOffsetY = Math.max(PW, PH) * 0.03;
  };
  const paintScreen = () => {
    if (paintScreenOverride) {
      paintScreenOverride(ctx, sb);
      return;
    }
    ctx.fillStyle = "#0B0B0E";
    ctx.fillRect(sb.x, sb.y, sb.w, sb.h);
    if (img) {
      const r = imgRect(img, sb, scroll);
      ctx.drawImage(img, sb.x + r.x, sb.y + r.y, r.w, r.h);
    }
    const g = ctx.createLinearGradient(sb.x, sb.y, sb.x + sb.w, sb.y + sb.h);
    g.addColorStop(0, "rgba(255,255,255,0.10)");
    g.addColorStop(0.35, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(sb.x, sb.y, sb.w, sb.h);
  };

  if (m.cut === "none") {
    ctx.save();
    shadow();
    rr(ctx, sb.x, sb.y, sb.w, sb.h, sb.r);
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.restore();
    ctx.save();
    rr(ctx, sb.x, sb.y, sb.w, sb.h, sb.r);
    ctx.clip();
    paintScreen();
    ctx.restore();
    return;
  }
  if (m.cut === "browser") {
    const rad = PH * m.r;
    ctx.save();
    shadow();
    rr(ctx, -PW / 2, -PH / 2, PW, PH, rad);
    ctx.fillStyle = fc.chrome;
    ctx.fill();
    ctx.restore();
    ctx.save();
    rr(ctx, -PW / 2, -PH / 2, PW, PH, rad);
    ctx.clip();
    ctx.beginPath();
    ctx.rect(sb.x, sb.y, sb.w, sb.h);
    ctx.clip();
    paintScreen();
    ctx.restore();
    const bar = sb.bar as number,
      cy = -PH / 2 + bar / 2,
      dr = bar * 0.12;
    ["#FF5F57", "#FEBC2E", "#28C840"].forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(-PW / 2 + bar * 0.5 + i * dr * 3.2, cy, dr, 0, Math.PI * 2);
      ctx.fill();
    });
    const uw = PW * 0.42,
      uh = bar * 0.54;
    rr(ctx, -uw / 2, cy - uh / 2, uw, uh, uh / 2);
    ctx.fillStyle = rgba(fc.chromeInk, 0.14);
    ctx.fill();
    ctx.fillStyle = fc.chromeInk;
    ctx.font = `600 ${bar * 0.3}px Figtree, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(slug(appName) + ".app", 0, cy + bar * 0.01);
    ctx.textAlign = "left";
    ctx.fillStyle = rgba(fc.chromeInk, 0.2);
    ctx.fillRect(-PW / 2, sb.y - 1, PW, Math.max(1, PH * 0.002));
    return;
  }

  ctx.fillStyle = fc.btn;
  if (m.cut === "cam") {
    rr(ctx, PW * 0.22, -PH / 2 - PW * 0.008, PW * 0.12, PW * 0.014, PW * 0.006);
    ctx.fill();
  } else if (m.cut === "punch") {
    rr(ctx, PW / 2 - PW * 0.007, -PH * 0.22, PW * 0.02, PH * 0.12, PW * 0.008);
    ctx.fill();
    rr(ctx, PW / 2 - PW * 0.007, -PH * 0.06, PW * 0.02, PH * 0.06, PW * 0.008);
    ctx.fill();
  } else {
    rr(ctx, -PW / 2 - PW * 0.013, -PH * 0.24, PW * 0.02, PH * 0.07, PW * 0.008);
    ctx.fill();
    rr(ctx, -PW / 2 - PW * 0.013, -PH * 0.14, PW * 0.02, PH * 0.07, PW * 0.008);
    ctx.fill();
    rr(ctx, PW / 2 - PW * 0.007, -PH * 0.18, PW * 0.02, PH * 0.11, PW * 0.008);
    ctx.fill();
  }
  const bodyR = PW * m.r,
    rim = PW * 0.014;
  ctx.save();
  shadow();
  rr(ctx, -PW / 2, -PH / 2, PW, PH, bodyR);
  ctx.fillStyle = fc.body;
  ctx.fill();
  ctx.restore();
  rr(
    ctx,
    -PW / 2 + rim * 0.4,
    -PH / 2 + rim * 0.4,
    PW - rim * 0.8,
    PH - rim * 0.8,
    bodyR - rim * 0.4,
  );
  ctx.lineWidth = PW * 0.005;
  ctx.strokeStyle = fc.edge;
  ctx.stroke();
  rr(
    ctx,
    -PW / 2 + rim,
    -PH / 2 + rim,
    PW - rim * 2,
    PH - rim * 2,
    bodyR - rim,
  );
  ctx.fillStyle = "#050507";
  ctx.fill();
  ctx.save();
  rr(ctx, sb.x, sb.y, sb.w, sb.h, sb.r);
  ctx.clip();
  paintScreen();
  ctx.restore();

  ctx.fillStyle = "#000";
  if (m.cut === "island") {
    // Deliberate deviation from legacy/promo-studio.html (confirmed
    // byte-identical there: `sb.y + PW*0.035`, height `PW*0.085`) — that
    // positioning put the pill's bottom edge ~0.12*PW below the screen
    // top, well past the status bar and into real screenshot content
    // (covering 1-2 lines of a real header, confirmed visually against
    // captured live screenshots). Pulled up to sit near sb.y like
    // notch/punch already do, and shortened so its extent (~0.07*PW below
    // sb.y) matches theirs instead of overlapping app content.
    rr(ctx, -PW * 0.15, sb.y + PW * 0.005, PW * 0.3, PW * 0.065, PW * 0.0325);
    ctx.fill();
  } else if (m.cut === "notch") {
    const nw = PW * 0.5,
      nh = PW * 0.07,
      nr = PW * 0.035,
      top = sb.y - 1;
    ctx.beginPath();
    ctx.moveTo(-nw / 2 - nr, top);
    ctx.quadraticCurveTo(-nw / 2, top, -nw / 2, top + nr * 0.8);
    ctx.lineTo(-nw / 2, top + nh - nr);
    ctx.quadraticCurveTo(-nw / 2, top + nh, -nw / 2 + nr, top + nh);
    ctx.lineTo(nw / 2 - nr, top + nh);
    ctx.quadraticCurveTo(nw / 2, top + nh, nw / 2, top + nh - nr);
    ctx.lineTo(nw / 2, top + nr * 0.8);
    ctx.quadraticCurveTo(nw / 2, top, nw / 2 + nr, top);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#1A1C24";
    ctx.beginPath();
    ctx.arc(nw * 0.22, top + nh * 0.45, PW * 0.014, 0, Math.PI * 2);
    ctx.fill();
  } else if (m.cut === "punch") {
    ctx.beginPath();
    ctx.arc(0, sb.y + PW * 0.05, PW * 0.026, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.08)";
    ctx.lineWidth = PW * 0.004;
    ctx.stroke();
  } else if (m.cut === "cam") {
    ctx.fillStyle = "#1A1C24";
    ctx.beginPath();
    ctx.arc(0, -PH / 2 + (sb.y + PH / 2) / 2, PW * 0.009, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Normalized-ish light direction for the 3D pose renderer's side-band
 * shading — ported from legacy/device-3d-lab-download.html's LIGHT. */
const LIGHT3D = { x: -0.45, y: -0.75, z: 0.5 };

/** Fixed screen-texture mesh subdivision for this milestone — adaptive
 * density (lower for preview, higher for export) is deferred. Higher than
 * the prototype's own default (16) because each triangle's affine
 * approximation of the true perspective only agrees exactly with its
 * neighbors at shared vertices, not along the whole shared edge — visible
 * as a faint crosshatch seam pattern across the screen at strong tilts
 * when the mesh is too coarse. A finer mesh shrinks that per-edge
 * disagreement below visibility. */
const TEXTURE_SUBDIV = 16;

function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexRGB(a);
  const [br, bg, bb] = hexRGB(b);
  return `rgb(${Math.round(ar + (br - ar) * t)},${Math.round(ag + (bg - ag) * t)},${Math.round(ab + (bb - ab) * t)})`;
}

/** Lambert-ish shade between `dark` and `light` (both hex) for a
 * (rotated) surface normal. Both ends must be hex — FCOLORS' `edge` is an
 * rgba() string, which hexRGB can't parse (it silently reads as black), so
 * callers derive both ends from the frame's own hex body/btn color. */
function shadeForNormal(n: Point3, dark: string, light: string): string {
  const len = Math.hypot(n.x, n.y, n.z) || 1;
  const d = (n.x * LIGHT3D.x + n.y * LIGHT3D.y + n.z * LIGHT3D.z) / len;
  return mixHex(dark, light, clamp(0.35 + d * 0.75, 0, 1));
}

/** Projects a device-local point ring (z fixed) through the pose and
 * builds a ctx path from it — the 3D-renderer's equivalent of `rr()`,
 * used everywhere a flat rounded-rect/notch shape needs to become a
 * projected polygon instead. */
function projectedPath(
  ctx: CanvasRenderingContext2D,
  pts: Point3[],
  pose: Pose3D,
): void {
  pathFrom3d(
    ctx,
    pts.map((p) => xform3d(p, pose)),
  );
}

/** A physical side button, in device-local coordinates: which side it sits
 * on, and its extent along that side (y for left/right, x for top).
 * Positions/extents match the classic drawDevice()'s flat button rects. */
interface SideButton3D {
  side: "left" | "right" | "top";
  from: number;
  to: number;
}

function sideButtons3d(cut: string, PW: number, PH: number): SideButton3D[] {
  if (cut === "cam") return [{ side: "top", from: PW * 0.22, to: PW * 0.34 }];
  if (cut === "punch")
    return [
      { side: "right", from: -PH * 0.22, to: -PH * 0.1 },
      { side: "right", from: -PH * 0.06, to: 0 },
    ];
  if (cut === "island" || cut === "notch")
    return [
      { side: "left", from: -PH * 0.24, to: -PH * 0.17 },
      { side: "left", from: -PH * 0.14, to: -PH * 0.07 },
      { side: "right", from: -PH * 0.18, to: -PH * 0.07 },
    ];
  return [];
}

/** Draws each side button as a small box protruding from the side band,
 * centered in depth (z = 0) and projected through the same pose as the
 * body. Only camera-facing faces of each box are drawn (a convex box's
 * visible faces never overlap, so no depth sort is needed). `pass`
 * splits buttons by whether their side faces the camera: 'behind' ones
 * are drawn before the body so the body paints over them (they vanish as
 * their side turns away, leaving at most the sliver a real protruding
 * button shows past the silhouette), 'front' ones after the side band so
 * they sit on top of it. */
function drawSideButtons3d(
  ctx: CanvasRenderingContext2D,
  buttons: SideButton3D[],
  PW: number,
  PH: number,
  hz: number,
  btn: string,
  pose: Pose3D,
  pass: "behind" | "front",
): void {
  const out = PW * 0.013,
    sink = PW * 0.004,
    zt = hz * 0.55;
  const dark = shade(btn, -0.5),
    light = shade(btn, 0.12);
  for (const b of buttons) {
    // Build the box in a side-aligned frame (a = along the side, o =
    // outward distance from the body surface), then map to device-local.
    const toLocal =
      b.side === "left"
        ? (a: number, o: number, z: number): Point3 => ({
            x: -PW / 2 - o,
            y: a,
            z,
          })
        : b.side === "right"
          ? (a: number, o: number, z: number): Point3 => ({
              x: PW / 2 + o,
              y: a,
              z,
            })
          : (a: number, o: number, z: number): Point3 => ({
              x: a,
              y: -PH / 2 - o,
              z,
            });
    const sideN = toLocal(0, 1, 0),
      base = toLocal(0, 0, 0);
    const outward: Point3 = { x: sideN.x - base.x, y: sideN.y - base.y, z: 0 };
    const mid = (b.from + b.to) / 2;
    const sideVisible = facesCamera3d(toLocal(mid, 0, 0), outward, pose);
    if (sideVisible !== (pass === "front")) continue;
    const a0 = b.from,
      a1 = b.to,
      o0 = -sink,
      o1 = out;
    const alongN = ((): Point3 => {
      const p = toLocal(1, 0, 0);
      return { x: p.x - base.x, y: p.y - base.y, z: 0 };
    })();
    const faces: Array<{ pts: Point3[]; n: Point3 }> = [
      {
        pts: [
          toLocal(a0, o1, -zt),
          toLocal(a1, o1, -zt),
          toLocal(a1, o1, zt),
          toLocal(a0, o1, zt),
        ],
        n: outward,
      },
      {
        pts: [
          toLocal(a0, o0, zt),
          toLocal(a1, o0, zt),
          toLocal(a1, o1, zt),
          toLocal(a0, o1, zt),
        ],
        n: { x: 0, y: 0, z: 1 },
      },
      {
        pts: [
          toLocal(a0, o0, -zt),
          toLocal(a1, o0, -zt),
          toLocal(a1, o1, -zt),
          toLocal(a0, o1, -zt),
        ],
        n: { x: 0, y: 0, z: -1 },
      },
      {
        pts: [
          toLocal(a0, o0, -zt),
          toLocal(a0, o1, -zt),
          toLocal(a0, o1, zt),
          toLocal(a0, o0, zt),
        ],
        n: { x: -alongN.x, y: -alongN.y, z: 0 },
      },
      {
        pts: [
          toLocal(a1, o0, -zt),
          toLocal(a1, o1, -zt),
          toLocal(a1, o1, zt),
          toLocal(a1, o0, zt),
        ],
        n: alongN,
      },
    ];
    for (const f of faces) {
      const c = f.pts.reduce(
        (s, p) => ({ x: s.x + p.x / 4, y: s.y + p.y / 4, z: s.z + p.z / 4 }),
        { x: 0, y: 0, z: 0 },
      );
      if (!facesCamera3d(c, f.n, pose)) continue;
      projectedPath(ctx, f.pts, pose);
      ctx.fillStyle = shadeForNormal(
        rotate3d(f.n, pose.rx, pose.ry, pose.rz),
        dark,
        light,
      );
      ctx.fill();
    }
  }
}

/** The classic drawDevice()'s notch outline (same width/height/corner
 * curves, flush with the screen's top edge), sampled as a device-local
 * point ring at depth `z` so it can be projected. */
function notchPoints3d(
  PW: number,
  top: number,
  z: number,
  steps = 12,
): Point3[] {
  const nw = PW * 0.5,
    nh = PW * 0.07,
    nr = PW * 0.035;
  const pts: Point3[] = [];
  const quad = (
    x0: number,
    y0: number,
    cx: number,
    cy: number,
    x1: number,
    y1: number,
  ) => {
    for (let i = 0; i <= steps; i++) {
      const t = i / steps,
        u = 1 - t;
      pts.push({
        x: u * u * x0 + 2 * u * t * cx + t * t * x1,
        y: u * u * y0 + 2 * u * t * cy + t * t * y1,
        z,
      });
    }
  };
  quad(-nw / 2 - nr, top, -nw / 2, top, -nw / 2, top + nr * 0.8);
  quad(-nw / 2, top + nh - nr, -nw / 2, top + nh, -nw / 2 + nr, top + nh);
  quad(nw / 2 - nr, top + nh, nw / 2, top + nh, nw / 2, top + nh - nr);
  quad(nw / 2, top + nr * 0.8, nw / 2, top, nw / 2 + nr, top);
  return pts;
}

/** Perspective device-frame rendering — pose/motion "steps 1-3" of the 3D
 * device pose feature. Invoked from drawScene only when a slide has a
 * non-null `pose3d`; the classic drawDevice() above is completely
 * untouched and remains the path every existing/default scene uses.
 * Structure ported from legacy/device-3d-lab-download.html's drawDevice(),
 * adapted to this engine's MODELS/FCOLORS/screenBox rather than the
 * prototype's own smaller model/color tables. The front face's layering
 * (body rim → edge stroke → black glass → screen → cutout) and colors
 * mirror the classic drawDevice() exactly, so a posed device reads as the
 * same object as the flat one, just rotated. Every pose — including
 * Front — goes through this one projection, so buttons, side band and
 * front face stay consistent as a motion passes through rx=ry=rz=0. */
export function drawDevice3D(
  ctx: CanvasRenderingContext2D,
  img: ImageAsset | null,
  PW: number,
  PH: number,
  style: ResolvedStyle,
  appName: string,
  scroll: number,
  basePose: Pose3D,
): void {
  const m = MODELS[style.model];
  const hz = (PW * m.t3d) / 2;
  const pose = cameraForDevice3d(basePose, PW, PH);

  const fc = frameColor(style.fcolor, style.colors.accent);
  const sb = screenBox(PW, PH, style.model);
  const bodyR = PW * m.r;
  const phoneLike = m.cut !== "none" && m.cut !== "browser";
  // Side band / back shell tones derived from the body color itself (never
  // lighter than the flat renderer's body), so a light finish like
  // Titanium or Silver reads as a shaded metal edge rather than a pale
  // frame around the screen.
  const bandBase =
    m.cut === "browser" ? fc.chrome : m.cut === "none" ? "#1A1A1E" : fc.body;
  const bandDark = shade(bandBase, -0.55);

  const facing = facesCamera3d(
    { x: 0, y: 0, z: hz },
    { x: 0, y: 0, z: 1 },
    pose,
  );

  const front3 = roundRectPoints3d(PW, PH, bodyR, hz);
  const back3 = roundRectPoints3d(PW, PH, bodyR, -hz);
  const pf: Point2[] = front3.map((p) => xform3d(p, pose));
  const pb: Point2[] = back3.map((p) => xform3d(p, pose));

  // Contact shadow: the front ring, flattened toward a ground plane behind
  // the device and blurred — direct port of the prototype's shadow.
  ctx.save();
  ctx.globalAlpha *= 0.5;
  const lift = 0.5 + Math.abs(Math.sin(pose.ry * DEG)) * 0.35;
  const shadowPts = pf.map((p) => ({
    x: p.x + Math.sin(pose.ry * DEG) * PW * 0.06,
    y: p.y + PH * 0.04 + PH * 0.026 * lift,
  }));
  ctx.filter = `blur(${Math.max(1, PW * 0.023 * lift)}px)`;
  pathFrom3d(ctx, shadowPts);
  ctx.fillStyle = "rgba(8,10,24,.55)";
  ctx.fill();
  ctx.filter = "none";
  ctx.restore();

  const buttons = phoneLike ? sideButtons3d(m.cut, PW, PH) : [];
  drawSideButtons3d(ctx, buttons, PW, PH, hz, fc.btn, pose, "behind");

  // Back shell base — only visible as the whole back plate when !facing;
  // drawn first so everything else layers on top.
  ctx.save();
  pathFrom3d(ctx, pb);
  ctx.fillStyle = mixHex(bandDark, bandBase, 0.6);
  ctx.fill();
  ctx.restore();

  // Side band: one quad per outline segment, shaded by its own outward
  // normal and perspective back-face culled against the camera.
  for (let i = 0; i < front3.length; i++) {
    const j = (i + 1) % front3.length;
    const ex = front3[j].x - front3[i].x,
      ey = front3[j].y - front3[i].y;
    const mx = (front3[j].x + front3[i].x) / 2,
      my = (front3[j].y + front3[i].y) / 2;
    let n: Point3 = { x: ey, y: -ex, z: 0 };
    if (n.x * mx + n.y * my < 0) n = { x: -n.x, y: -n.y, z: 0 };
    if (!facesCamera3d({ x: mx, y: my, z: 0 }, n, pose)) continue;
    const a = pf[i],
      b = pf[j],
      c = pb[j],
      d = pb[i];
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    const col = shadeForNormal(
      rotate3d(n, pose.rx, pose.ry, pose.rz),
      bandDark,
      bandBase,
    );
    ctx.fillStyle = col;
    ctx.fill();
    // Same-color hairline stroke closes the antialiasing seams between
    // adjacent band quads.
    ctx.lineWidth = 0.75;
    ctx.strokeStyle = col;
    ctx.stroke();
  }

  drawSideButtons3d(ctx, buttons, PW, PH, hz, fc.btn, pose, "front");

  if (!facing) {
    // Back of the device: plain shell, no screen. Phone-shaped cuts get a
    // small camera island (matching the classic front cutouts' emphasis
    // on the camera system); browser/card/tablet — which have no physical
    // "back" concept in the flat 2D renderer either — get a plain shell
    // only.
    if (m.cut === "island" || m.cut === "notch" || m.cut === "punch") {
      const camPts = roundRectPoints3d(
        PW * 0.32,
        PW * 0.32,
        PW * 0.09,
        -hz,
      ).map((p) =>
        xform3d({ x: p.x - PW * 0.22, y: p.y - PH * 0.32, z: p.z }, pose),
      );
      ctx.save();
      pathFrom3d(ctx, camPts);
      ctx.fillStyle = mixHex(bandDark, "#000000", 0.35);
      ctx.fill();
      ctx.restore();
      [
        [-0.3, -0.37],
        [-0.14, -0.37],
        [-0.22, -0.26],
      ].forEach(([fx, fy]) => {
        const lensPts = roundRectPoints3d(
          PW * 0.11,
          PW * 0.11,
          PW * 0.055,
          -hz - 0.6,
        ).map((p) =>
          xform3d({ x: p.x + PW * fx, y: p.y + PH * fy, z: p.z }, pose),
        );
        ctx.save();
        pathFrom3d(ctx, lensPts);
        ctx.fillStyle = "#0B0D12";
        ctx.fill();
        ctx.lineWidth = Math.max(1, PW * 0.005);
        ctx.strokeStyle = "rgba(255,255,255,.22)";
        ctx.stroke();
        ctx.restore();
      });
    }
    return;
  }

  // Front face: mirrors the classic drawDevice()'s layering and insets —
  // body plate (visible only as a thin rim), edge highlight stroke, black
  // glass at the same `rim` inset, then the screen at the model's own
  // screenBox — every shape a projected point ring instead of a flat rr().
  const screenCx = sb.x + sb.w / 2,
    screenCy = sb.y + sb.h / 2;
  const centerS = xform3d({ x: 0, y: 0, z: hz }, pose).s;
  const rim = PW * 0.014;
  const glass3 = roundRectPoints3d(
    PW - rim * 2,
    PH - rim * 2,
    bodyR - rim,
    hz + 0.4,
  );

  ctx.save();
  projectedPath(ctx, front3, pose);
  ctx.fillStyle =
    m.cut === "browser" ? fc.chrome : m.cut === "none" ? "#000" : fc.body;
  ctx.fill();
  ctx.restore();

  if (phoneLike) {
    ctx.save();
    projectedPath(
      ctx,
      roundRectPoints3d(
        PW - rim * 0.8,
        PH - rim * 0.8,
        bodyR - rim * 0.4,
        hz + 0.2,
      ),
      pose,
    );
    ctx.lineWidth = PW * 0.005 * centerS;
    ctx.strokeStyle = fc.edge;
    ctx.stroke();
    ctx.restore();
    ctx.save();
    projectedPath(ctx, glass3, pose);
    ctx.fillStyle = "#050507";
    ctx.fill();
    ctx.restore();
  }

  // Screen: a quad of this model's own screenBox size (sb.w × sb.h, e.g.
  // the tablet's ~4:3 screen, not a phone's), with the screenshot
  // cover-fitted, top-aligned, into exactly that aspect ratio.
  const screen3 = roundRectPoints3d(sb.w, sb.h, sb.r, hz + 0.6);
  ctx.save();
  projectedPath(
    ctx,
    screen3.map((p) => ({ x: p.x + screenCx, y: p.y + screenCy, z: p.z })),
    pose,
  );
  ctx.clip();
  ctx.fillStyle = "#0B0B0E";
  ctx.fillRect(-PW * 2, -PH * 2, PW * 4, PH * 4);
  if (img)
    drawTexturedQuad3d(
      ctx,
      img,
      sb.w,
      sb.h,
      hz + 0.6,
      pose,
      TEXTURE_SUBDIV,
      screenCx,
      screenCy,
      scroll,
    );
  ctx.restore();

  const disc = (x: number, y: number, r: number, z: number, fill: string) => {
    ctx.fillStyle = fill;
    projectedPath(
      ctx,
      roundRectPoints3d(r * 2, r * 2, r, z).map((p) => ({
        x: p.x + x,
        y: p.y + y,
        z,
      })),
      pose,
    );
    ctx.fill();
  };

  if (m.cut === "browser") {
    const bar = sb.bar ?? PH * 0.085,
      barCy = -PH / 2 + bar / 2;
    ["#FF5F57", "#FEBC2E", "#28C840"].forEach((col, i) =>
      disc(
        -PW / 2 + bar * 0.5 + i * bar * 0.12 * 3.2,
        barCy,
        bar * 0.12,
        hz + 1,
        col,
      ),
    );
    const pillPts = roundRectPoints3d(
      PW * 0.42,
      bar * 0.54,
      bar * 0.27,
      hz + 1,
    ).map((p) => xform3d({ x: p.x, y: p.y + barCy, z: p.z }, pose));
    ctx.save();
    pathFrom3d(ctx, pillPts);
    ctx.fillStyle = rgba(fc.chromeInk, 0.14);
    ctx.fill();
    ctx.restore();
    const namePt = xform3d({ x: 0, y: barCy, z: hz + 1 }, pose);
    ctx.save();
    ctx.fillStyle = fc.chromeInk;
    ctx.font = `600 ${bar * 0.3 * namePt.s}px Figtree, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(slug(appName) + ".app", namePt.x, namePt.y);
    ctx.restore();
  } else if (m.cut === "island") {
    // Sits a bit lower than the classic 2D renderer's own island position
    // (sb.y + PW*0.038) — 3D-pose-only per explicit user feedback, so it
    // reads as level with a status bar's time/signal/battery row instead
    // of floating right at the screen's top edge. Classic drawDevice()
    // above is intentionally untouched (see its own "deliberate deviation"
    // comment on why it's tuned where it is).
    const pts = roundRectPoints3d(
      PW * 0.3,
      PW * 0.065,
      PW * 0.0325,
      hz + 1,
    ).map((p) => xform3d({ x: p.x, y: p.y + sb.y + PW * 0.058, z: p.z }, pose));
    ctx.fillStyle = "#000";
    pathFrom3d(ctx, pts);
    ctx.fill();
  } else if (m.cut === "notch") {
    // A real notch only — flush with the screen's top edge, same outline
    // and camera dot as the classic drawDevice() — never an island pill.
    const top = sb.y - 1;
    ctx.fillStyle = "#000";
    projectedPath(ctx, notchPoints3d(PW, top, hz + 1), pose);
    ctx.fill();
    disc(
      PW * 0.5 * 0.22,
      top + PW * 0.07 * 0.45,
      PW * 0.014,
      hz + 1.2,
      "#1A1C24",
    );
  } else if (m.cut === "punch") {
    disc(0, sb.y + PW * 0.05, PW * 0.026, hz + 1, "#000");
  } else if (m.cut === "cam") {
    disc(0, -PH / 2 + (sb.y + PH / 2) / 2, PW * 0.009, hz + 1, "#1A1C24");
  }

  // Glass sheen: a bright band sweeping across as yaw changes — new for
  // the 3D pose renderer (the classic 2D drawDevice has no equivalent),
  // ported from the prototype per the user's explicit "pose-driven
  // lighting" ask.
  if (phoneLike) {
    ctx.save();
    projectedPath(ctx, glass3, pose);
    ctx.clip();
    const a = xform3d({ x: -PW, y: -PH / 2, z: hz + 1 }, pose),
      b = xform3d({ x: PW, y: PH / 2, z: hz + 1 }, pose);
    const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    const yr = pose.ry * DEG;
    const pos = clamp(0.5 + Math.sin(yr) * 0.8, 0.02, 0.98);
    const str = 0.05 + Math.abs(Math.sin(yr)) * 0.22;
    g.addColorStop(Math.max(0, pos - 0.22), "rgba(255,255,255,0)");
    g.addColorStop(pos, `rgba(255,255,255,${str})`);
    g.addColorStop(Math.min(1, pos + 0.22), "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  }
}

export function focusLocal(
  focus: { x: number; y: number },
  img: ImageAsset,
  PW: number,
  PH: number,
  scroll: number,
  model: ModelKey,
) {
  const sb = screenBox(PW, PH, model),
    r = imgRect(img, sb, scroll);
  return { x: sb.x + r.x + focus.x * r.w, y: sb.y + r.y + focus.y * r.h };
}

/** Maps a normalized (0-1, 0-1, 0-1, 0-1) rect within the *full* source
 * screenshot — a CutoutLayer's `rect`, same convention as `focus` above —
 * into the local (device-centered, pre-rotation) coordinate space, sized in
 * on-screen pixels at the image's current cover-fit scale. Cutout rendering
 * (src/engine/cutouts.ts) uses this for the cutout's *rest* position; the
 * source pixels it actually samples still come from `img` at full
 * resolution, independent of this on-screen size. */
export function cutoutLocal(
  rect: { x: number; y: number; w: number; h: number },
  img: ImageAsset,
  PW: number,
  PH: number,
  scroll: number,
  model: ModelKey,
) {
  const sb = screenBox(PW, PH, model),
    r = imgRect(img, sb, scroll);
  return {
    x: sb.x + r.x + rect.x * r.w,
    y: sb.y + r.y + rect.y * r.h,
    w: rect.w * r.w,
    h: rect.h * r.h,
  };
}

export function drawGesture(
  ctx: CanvasRenderingContext2D,
  scene: ImageSlide,
  img: ImageAsset | null,
  local: number,
  PW: number,
  PH: number,
  scroll: number,
  style: ResolvedStyle,
): void {
  if (!scene.gesture || scene.gesture === "none" || !img) return;
  const f = focusLocal(scene.focus, img, PW, PH, scroll, style.model),
    gx = f.x,
    gy = f.y;
  const lt = local - scene.dur * 0.42,
    fr = Math.min(PW, PH * 0.5) * 0.075;
  const finger = (x: number, y: number, a: number, s: number) => {
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.shadowColor = "rgba(0,0,0,.3)";
    ctx.shadowBlur = fr * 0.6;
    ctx.shadowOffsetY = fr * 0.15;
    ctx.beginPath();
    ctx.arc(x, y, fr * s, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.lineWidth = fr * 0.14;
    ctx.strokeStyle = "#fff";
    ctx.stroke();
    ctx.restore();
  };
  if (scene.gesture === "tap") {
    const appear = clamp((lt + 0.35) / 0.35),
      leave = 1 - clamp((lt - 0.55) / 0.3);
    const s =
      lt < 0
        ? 1.3 - 0.3 * easeOutCubic(appear)
        : lt < 0.15
          ? 1 - 0.15 * (lt / 0.15)
          : 0.85 + 0.15 * clamp((lt - 0.15) / 0.2);
    for (let k = 0; k < 2; k++) {
      const p = clamp((lt - k * 0.15) / 0.8);
      if (p > 0 && p < 1) {
        ctx.save();
        ctx.globalAlpha *= 1 - p;
        ctx.strokeStyle = style.colors.accent;
        ctx.lineWidth = fr * 0.18;
        ctx.beginPath();
        ctx.arc(gx, gy, fr * (1 + p * 2.6), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
    finger(gx, gy, Math.min(appear, leave), s);
  } else {
    const up = scene.gesture === "swipeUp",
      dist = up ? PH * 0.14 : PW * 0.28;
    const appear = clamp((lt + 0.3) / 0.3),
      leave = 1 - clamp((lt - 0.75) / 0.3);
    const p = easeInOutCubic(clamp(lt / 0.65));
    const sx = up ? gx : gx + dist / 2,
      sy = up ? gy + dist / 2 : gy;
    const cx = up ? sx : sx - dist * p,
      cy = up ? sy - dist * p : sy;
    if (p > 0) {
      const g = ctx.createLinearGradient(sx, sy, cx, cy);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(1, "rgba(255,255,255,0.6)");
      ctx.save();
      ctx.globalAlpha *= Math.min(appear, leave);
      ctx.strokeStyle = g;
      ctx.lineCap = "round";
      ctx.lineWidth = fr * 1.2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(cx, cy);
      ctx.stroke();
      ctx.restore();
    }
    finger(cx, cy, Math.min(appear, leave), 1);
  }
}

export function drawBadge(
  ctx: CanvasRenderingContext2D,
  text: string,
  size: number,
  rot: number,
  alpha: number,
  style: ResolvedStyle,
  font: FontDef,
): void {
  const c = style.colors;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.rotate(rot);
  ctx.font = fontStr(font.h === 400 ? 400 : 800, size, font.name);
  const w = ctx.measureText(text).width + size * 1.4,
    h = size * 1.9;
  ctx.shadowColor = "rgba(0,0,0,.25)";
  ctx.shadowBlur = size * 0.8;
  ctx.shadowOffsetY = size * 0.25;
  rr(ctx, -w / 2, -h / 2, w, h, h / 2);
  ctx.fillStyle = c.accent;
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = c.a;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, size * 0.05);
  ctx.restore();
  ctx.textAlign = "left";
}

/** `value.from`/`value.to` are the raw numeric endpoints — for 'percent'
 * that's the percent number itself (87, not 0.87), so this never divides
 * by 100. Thousands separators are hand-rolled (not Intl.NumberFormat) so
 * 'percent' can mean "the number, then a % sign" without fighting Intl's
 * own fraction-based percent semantics. */
export function formatCounterValue(
  value: number,
  cfg: Pick<CounterConfig, "format" | "currencySymbol" | "decimals">,
): string {
  const sign = value < 0 ? "-" : "";
  const [intPart, fracPart] = Math.abs(value).toFixed(cfg.decimals).split(".");
  const withSeparators = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const num = fracPart ? `${withSeparators}.${fracPart}` : withSeparators;
  if (cfg.format === "currency") return `${sign}${cfg.currencySymbol}${num}`;
  if (cfg.format === "percent") return `${sign}${num}%`;
  return `${sign}${num}`;
}

/** Current value of a counter at slide-local time `local` — exported
 * separately from the draw function so callers (and tests) can sample the
 * numeric value without a canvas. Progress clamps to exactly 1 once
 * `local >= cfg.at + cfg.duration`, and every named easing function in
 * story/easing.ts returns exactly 1 at input 1 (checked directly, not
 * assumed), so the value lands exactly on `cfg.to` and stays there — never
 * one frame short from an unclamped/approaching-but-not-reaching curve. */
export function counterValueAt(cfg: CounterConfig, local: number): number {
  const progress = clamp((local - cfg.at) / cfg.duration);
  const eased = resolveEasing(cfg.easing)(progress);
  return cfg.from + (cfg.to - cfg.from) * eased;
}

export function drawCounter(
  ctx: CanvasRenderingContext2D,
  cfg: CounterConfig,
  local: number,
  tx: number,
  ty: number,
  alpha: number,
  W: number,
  H: number,
  style: ResolvedStyle,
  font: FontDef,
): void {
  if (local < cfg.at || alpha <= 0) return;
  const text = formatCounterValue(counterValueAt(cfg, local), cfg);
  const c = style.colors,
    size = Math.min(W, H) * 0.06;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = fontStr(font.h, size, font.name);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,.35)";
  ctx.shadowBlur = size * 0.5;
  ctx.shadowOffsetY = size * 0.06;
  ctx.fillStyle = c.text;
  ctx.fillText(text, tx, ty);
  ctx.restore();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

export function drawCallout(
  ctx: CanvasRenderingContext2D,
  text: string,
  tx: number,
  ty: number,
  local: number,
  alpha: number,
  W: number,
  H: number,
  style: ResolvedStyle,
  font: FontDef,
): void {
  const e = clamp((local - 1.0) / 0.6);
  if (e <= 0 || alpha <= 0) return;
  const c = style.colors,
    size = Math.min(W, H) * 0.036;
  ctx.font = fontStr(font.h === 400 ? 400 : 700, size, font.name);
  const bw = ctx.measureText(text).width + size * 1.5,
    bh = size * 2.1;
  const side = tx < W / 2 ? -1 : 1;
  let bx = tx + side * Math.min(W, H) * 0.26 - bw / 2;
  bx = clamp(bx, W * 0.03, W * 0.97 - bw);
  const by = clamp(ty - Math.min(W, H) * 0.16, H * 0.03, H * 0.97 - bh);
  const sx = side < 0 ? bx + bw * 0.7 : bx + bw * 0.3,
    sy = by + bh;
  const cx = (sx + tx) / 2 + side * Math.min(W, H) * 0.06,
    cy = Math.min(sy, ty) - Math.min(W, H) * 0.02;
  const q = (u: number): [number, number] => [
    (1 - u) * (1 - u) * sx + 2 * (1 - u) * u * cx + u * u * tx,
    (1 - u) * (1 - u) * sy + 2 * (1 - u) * u * cy + u * u * ty,
  ];
  const endU = 0.9 * easeInOutCubic(e);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = c.text;
  ctx.lineWidth = size * 0.16;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(0,0,0,.25)";
  ctx.shadowBlur = size * 0.4;
  ctx.beginPath();
  for (let i = 0; i <= 30; i++) {
    const [x, y] = q((endU * i) / 30);
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.stroke();
  if (e >= 1) {
    const [x1, y1] = q(0.9),
      [x0, y0] = q(0.84),
      a = Math.atan2(y1 - y0, x1 - x0),
      hl = size * 0.55;
    ctx.beginPath();
    ctx.moveTo(x1 - Math.cos(a - 0.5) * hl, y1 - Math.sin(a - 0.5) * hl);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x1 - Math.cos(a + 0.5) * hl, y1 - Math.sin(a + 0.5) * hl);
    ctx.stroke();
  }
  const pop = easeOutBack(clamp((local - 1.2) / 0.45));
  if (pop > 0) {
    ctx.translate(bx + bw / 2, by + bh / 2);
    ctx.scale(pop, pop);
    rr(ctx, -bw / 2, -bh / 2, bw, bh, bh / 2);
    ctx.fillStyle = c.text;
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = c.a;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 0, size * 0.05);
  }
  ctx.restore();
  ctx.textAlign = "left";
}
