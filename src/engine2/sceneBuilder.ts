/**
 * Turns a SceneProjectV2 (layers + camera + particle bursts, all data) into
 * a live Three.js scene, and returns a single deterministic `update(t)` —
 * no per-template code runs here, only evaluate.ts reading the data every
 * template produces. This is what /dev/compare and the editor drive.
 */
import * as THREE from 'three';

import { createMeshGradientBackground } from './background';
import { createCameraRig, DEFAULT_FORMAT, FORMAT_STAGE_DIMS, NO_BLOOM_LAYER, STAGE_H, STAGE_W } from './camera';
import { createCutoutMaterial, isCutoutMaterial, setCutoutOpacity } from './cutout';
import { deviceOuterSize, drawDevice } from './deviceFrame';
import { evaluateLayer } from './evaluate';
import { createLottieLayer } from './lottie';
import { createWatermarkOverlay, type WatermarkOverlay } from './watermark';
import { PALS } from './palettes';
import { buildParticleBurst, updateParticleBurst, type ParticleBurst } from './particles';
import { drawShape } from './shapes';
import { spr } from './spring';
import { STYLES } from './styles';
import { drawSticker } from './sticker';
import { buildHeadlineBeat, parseHeadline, updateHeadlineBeat, type WordPlane } from './text';
import { coverFitDraw, makeCanvas, roundRectPath, textureFromCanvas } from './texture';
import type { ContentRef, DeviceFrameSpec, ImageAsset, LayerDef, SceneProjectV2 } from './types';
import { createVideoLayer } from './video';

/** A layer whose content can't be fully drawn once at build time — lottie
 * and video need a per-frame step (lottie: a synchronous seek; video: an
 * inherently async one — see video.ts) and an async "first frame ready"
 * gate export must wait on before capturing anything. Every other content
 * kind is plain static/keyframe-driven and needs none of this. */
interface DynamicLayer {
  ready: Promise<void>;
  update(t: number): void;
  /** Export-only precise settle step — see video.ts. Absent for content
   * kinds (lottie) whose per-frame update is already fully synchronous. */
  awaitFrame?(t: number): Promise<void>;
  dispose(): void;
}

function setLayerOpacity(mesh: THREE.Mesh, value: number): void {
  const mat = mesh.material as THREE.Material;
  if (isCutoutMaterial(mat)) setCutoutOpacity(mat, value);
  else (mat as THREE.MeshBasicMaterial).opacity = value;
}

function getLayerOpacity(mesh: THREE.Mesh): number {
  const mat = mesh.material as THREE.Material;
  if (isCutoutMaterial(mat)) return (mat.uniforms.uOpacity as { value: number }).value;
  return (mat as THREE.MeshBasicMaterial).opacity;
}

export type ContentRenderer = (ctx: CanvasRenderingContext2D, w: number, h: number, props: Record<string, unknown>, palette: (typeof PALS)[string], texts: [string, string, string]) => void;

const CONTENT_RECIPES: Record<string, ContentRenderer> = {};

/** 'ui-element' recipes that are deliberate glowing accents rather than
 * surfaces — kept bloom/tone-mapping-eligible even though 'ui-element' is
 * otherwise treated as surface content now (see markAsSurfaceContent's doc
 * comment). Only checkout.ts's pay button ('checkout-pay') qualifies: it
 * fills with `palette.ui`, the palette's saturated accent/interactive
 * color. Every template's own CTA recipe ('cta') and recipeKit.ts's shared
 * one ('recipeCta') fill with `palette.ink` instead — checked across every
 * palette in palettes.ts, `ink` is always white or near-white (it's the
 * "text readable on a dark/saturated fill" color, not an accent) — so
 * those are plain white pills with dark text, i.e. surfaces with the exact
 * same self-bloom text-washout failure mode as a card or bubble. They were
 * wrongly included here previously; confirmed by rendering reactions.ts's
 * CTA at t=7.2 and sampling its center pixel at (243,243,243) — nearly
 * blown to solid white, the button's own label unreadable. Removed. If a
 * template wants a CTA that visibly glows, it needs to actually paint an
 * accent-colored highlight into the recipe (e.g. a `palette.accent` glow
 * ring behind the pill) — there is currently no such treatment to exempt. */
const CTA_LIKE_RECIPES = new Set(['checkout-pay']);

/** Templates register their drawing recipes here at module load — keeps
 * sceneBuilder.ts generic over every template instead of switching on
 * template id. */
export function registerRecipe(id: string, fn: ContentRenderer): void {
  CONTENT_RECIPES[id] = fn;
}

interface BuiltLayer {
  def: LayerDef;
  mesh: THREE.Mesh;
  dimTarget?: THREE.Mesh;
}

export interface EngineV2Scene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Deterministic — the same t always produces the same frame, so export
   * can sample it frame-by-frame exactly like the classic engine does. */
  update(t: number): void;
  render(): void;
  setSize(w: number, h: number): void;
  dispose(): void;
  /** Export-only (src/engine2/export.ts's GPU-accumulation motion blur):
   * when false, the composer's final pass writes to an offscreen buffer
   * instead of the canvas, readable via `composedTexture`. Preview never
   * touches these — `render()` above always targets the screen. */
  setRenderToScreen(v: boolean): void;
  /** The composer's most recently rendered output texture — re-read this
   * after every render() call while renderToScreen is false, since the
   * underlying buffer swaps each frame. */
  getComposedTexture(): THREE.Texture;
  /** Resolves once every lottie/video layer has loaded its first frame.
   * Preview can ignore this — assets pop in as they finish loading, same
   * as an <img> would. Export MUST await it before capturing any frame,
   * otherwise an early frame could be captured before a video/lottie layer
   * is even showing anything — a real determinism violation. */
  ready: Promise<void>;
  /** Call after update(t), before render() — settles any video layer's
   * async seek to exactly t. Preview doesn't need this (native playback,
   * not per-RAF-frame precision, is what preview is for); export must call
   * it for every frame and every motion-blur subframe. No-op (resolves
   * immediately) when the scene has no video layers. */
  awaitFrame(t: number): Promise<void>;
  /** Latency fix: redraws every palette/text-dependent texture (static
   * ui-element/shape/sticker layers, procedural cutout sources, headline
   * beats, the CTA button) in place and swaps the background/scene colors
   * — no THREE.js object is created or destroyed, no video/lottie dynamics
   * are touched, so a headline edit or palette switch never pays for a
   * full rebuild. Call this instead of rebuilding whenever the *only*
   * thing that changed is texts/paletteId (layers/particles/camera/format
   * unchanged) — subsequent update(t) calls will read the new project. */
  refreshContent(project: SceneProjectV2): void;
  /** Latency fix: re-frames the camera and resizes the background for a
   * new output format in place — updates camera distance/DOF/grain
   * scaling and the background mesh's geometry, without touching layers,
   * dynamics, or the renderer/composer. Caller must also call setSize()
   * with the new format's pixel dimensions (the canvas itself still needs
   * to resize; this only handles the world-space framing). */
  refreshFormat(project: SceneProjectV2): void;
}

export interface EngineV2SceneOptions {
  /** Whether video layers autoplay on their own native clock (true) or
   * stay paused, driven only by explicit seeks (false) — export sets this
   * false so a video's independent real-time clock can't race the
   * frame-by-frame seeks it performs. Defaults true (preview). */
  previewPlayback?: boolean;
  /** Real user screenshots ('screenshot' content, and cutout's
   * `sourceSlotId`), keyed by slot id — Prompt 6's scene recipes fill
   * themselves with these, vs. every earlier template's procedurally-drawn
   * 'ui-element'/'cutout sourceRecipe' content. */
  assets?: Record<string, ImageAsset>;
  /** Infrastructure merge — draws "Made with Promo Studio" in the
   * bottom-right corner (see watermark.ts) whenever the signed-in user is
   * on the free plan. Caller (Stage2.tsx for preview, export.ts for
   * export) derives this from editorV2Store's `plan` field — never
   * trusted from project data itself, same reason classic's render()
   * takes it as a call-time option rather than a Project field. */
  watermark?: boolean;
}

/** Renders a 'ui' recipe at a given pixel size and wraps it as a texture —
 * shared by plain UI layers and by cutout layers' source image (see
 * `sourceCache`, which renders a source recipe once and lets every cutout
 * that references it reuse the same texture). */
function renderRecipeTexture(recipe: string, props: Record<string, unknown>, w: number, h: number, palette: (typeof PALS)[string], texts: [string, string, string]): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(w, h);
  const fn = CONTENT_RECIPES[recipe];
  if (fn) fn(ctx, w, h, props, palette, texts);
  return textureFromCanvas(canvas);
}

const SOURCE_TEXTURE_BASE_SIZE = { w: 524, h: 1144 };

/** Wraps a real (already-decoded) screenshot image directly as a texture —
 * no canvas redraw needed, unlike a procedural recipe. */
function imageToTexture(img: ImageAsset): THREE.CanvasTexture {
  // THREE.CanvasTexture works for either an HTMLCanvasElement or an
  // HTMLImageElement despite the name — it just needs a CanvasImageSource.
  const tex = new THREE.CanvasTexture(img as unknown as HTMLCanvasElement);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function imgSize(img: ImageAsset): { w: number; h: number } {
  return 'naturalWidth' in img && img.naturalWidth ? { w: img.naturalWidth, h: img.naturalHeight } : { w: img.width, h: img.height };
}

/** Draws a layer's content directly into an existing 2D context — the part
 * of buildLayerMesh's per-kind dispatch that's purely a function of
 * (content, palette, texts), with no THREE.js object creation. Shared by
 * buildLayerMesh (drawing into a freshly-made canvas) and refreshContent
 * (latency fix: redrawing into an *existing* canvas in place, so a
 * palette/text edit never has to create a new texture or mesh). Only
 * 'ui-element'/'shape'/an image-less 'sticker' have palette/text-dependent
 * pixels to redraw here — screenshots, image stickers, video, lottie and
 * cutouts are handled by their own paths and never call this. */
function drawStaticContent(ctx: CanvasRenderingContext2D, w: number, h: number, content: ContentRef, palette: (typeof PALS)[string], texts: [string, string, string]): void {
  if (content.kind === 'ui-element') {
    const fn = CONTENT_RECIPES[content.recipe];
    if (fn) fn(ctx, w, h, content.props, palette, texts);
  } else if (content.kind === 'shape') {
    drawShape(ctx, w, h, content.props, palette);
  } else if (content.kind === 'sticker' && !content.props.imageSlotId) {
    drawSticker(ctx, w, h, content.props);
  } else if (content.kind === 'label') {
    drawLabel(ctx, w, h, content, palette);
  }
}

/** 'label' content — a rounded card + centered text, palette-colored. The
 * simplest content kind that isn't a full 'ui-element' recipe (see its doc
 * comment in types.ts). */
function drawLabel(ctx: CanvasRenderingContext2D, w: number, h: number, content: Extract<ContentRef, { kind: 'label' }>, palette: (typeof PALS)[string]): void {
  const r = Math.min(w, h) * 0.12;
  roundRectPath(ctx, 0, 0, w, h, r);
  ctx.fillStyle = palette.ui;
  ctx.fill();
  const fillKey = content.fill ?? 'ink';
  ctx.fillStyle = fillKey === 'accent' ? palette.accent : fillKey === 'base' ? palette.base : fillKey === 'ui' ? palette.ui : palette.ink;
  const fontPx = Math.min(w, h) * 0.14;
  ctx.font = `700 ${fontPx}px Figtree, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const maxWidth = w * 0.86;
  const words = content.text.split(' ');
  const lines: string[] = [];
  let line = '';
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  const lineHeight = fontPx * 1.25;
  const startY = h / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => ctx.fillText(l, w / 2, startY + i * lineHeight));
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/**
 * Builds one layer's material — dispatching per content kind is the whole
 * point of task 2: 'shape'/'sticker' draw with their own typed-props
 * renderer (shapes.ts/sticker.ts), 'ui-element' is the old catch-all
 * recipe registry (unchanged, just renamed from 'ui'), 'lottie'/'video'
 * each get a real, distinct player (lottie.ts/video.ts) registered into
 * `dynamics` for their per-frame update + async readiness, and
 * 'screenshot' cover-fits a real image directly. 'particles' (anchor-only),
 * 'text' (its own beat system, not here) and 'none' fall back to a blank
 * transparent texture — they have no pixels of their own at this layer.
 * 'cutout' content is NOT handled here — see buildCutoutMesh below, which
 * needs every other layer's texture already resolved first.
 */

/**
 * Render-regression fix, since broadened — marks a mesh as *surface*
 * content (a screenshot, or a ui-element/shape recipe drawing a card,
 * chrome, bubble, or any other UI panel), exempt from both post-effects
 * that were distorting it:
 *  1. Bloom (see NO_BLOOM_LAYER's doc comment in camera.ts) — a
 *     screenshot's background can be a large near-white area, nothing like
 *     the small "highlights" bloom is tuned for, and glowed/washed out the
 *     whole device. The same turned out true of hand-authored templates'
 *     own light-colored ui-element cards (checked directly against
 *     legacy/motion-lab-download.html's reference render of the same chat
 *     bubbles: fully crisp there, no glow at all) — bloom belongs on
 *     light-*emitting* things (accents, particles, the CTA's glow), not on
 *     UI surfaces, light-colored or not.
 *  2. Tone mapping — `renderer.toneMapping = ACESFilmicToneMapping`
 *     (camera.ts) is a filmic curve applied to the whole scene for
 *     everything else's sake (richer, more cinematic color on gradients/
 *     backgrounds), but filmic curves characteristically introduce a hue
 *     shift on near-white/desaturated input — measured directly: a pure
 *     white (255,255,255) source pixel rendered as (237,231,238), a
 *     visible magenta cast, not just a brightness change. A promo video's
 *     whole premise is showing the app *accurately*, so its pixels skip
 *     the curve via THREE.Material's own per-material `toneMapped` flag
 *     (Three.js applies the tone-mapping function per-fragment inside
 *     each material's shader, gated on this exact flag — it isn't only a
 *     renderer-wide setting despite living on `renderer.toneMapping`).
 *
 * NOT applied to CTA_LIKE_RECIPES (below) — currently just checkout.ts's
 * pay button, the one CTA-style element that actually paints an
 * accent-colored fill (`palette.ui`) rather than a plain white one, making
 * it a deliberate glowing accent rather than a surface.
 */
function markAsSurfaceContent(mesh: THREE.Mesh): void {
  // .enable() (adds layer 1 alongside the default layer 0) rather than
  // .set() (which would replace membership, dropping it off layer 0) — the
  // click-to-select raycaster in Stage2.tsx uses a plain `new
  // THREE.Raycaster()` with default layers (layer 0 only), so a mesh that
  // isn't on layer 0 anymore would silently stop being clickable.
  mesh.layers.enable(NO_BLOOM_LAYER);
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  mats.forEach((m) => {
    m.toneMapped = false;
  });
}

function buildLayerMesh(def: LayerDef, palette: (typeof PALS)[string], texts: [string, string, string], sourceCache: Map<string, THREE.CanvasTexture>, dynamics: DynamicLayer[], opts: EngineV2SceneOptions): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(def.width, def.height);
  const content = def.content;
  let material: THREE.Material;

  if (content.kind === 'screenshot') {
    const img = opts.assets?.[content.slotId];
    const { canvas, ctx } = makeCanvas(def.width, def.height);
    if (img) coverFitDraw(ctx, img, imgSize(img).w, imgSize(img).h, def.width, def.height);
    material = new THREE.MeshBasicMaterial({ map: textureFromCanvas(canvas), transparent: true, depthWrite: false });
  } else if (content.kind === 'lottie') {
    const layer = createLottieLayer(content.props);
    dynamics.push({ ready: layer.ready, update: (t) => layer.seekTo(t), dispose: layer.dispose });
    material = new THREE.MeshBasicMaterial({ map: layer.texture, transparent: true, depthWrite: false });
  } else if (content.kind === 'video') {
    const layer = createVideoLayer(content.props, def.width, def.height);
    if (opts.previewPlayback !== false) void layer.ready.then(() => layer.setPreviewPlaying(true));
    dynamics.push({
      ready: layer.ready,
      // Preview: fire-and-forget resync each frame (cheap no-op once the
      // native clock is already close — see video.ts's early-return).
      update: (t) => void layer.seekTo(t),
      // Export: the same seek, but awaited — guarantees the exact frame is
      // showing before the next render() call.
      awaitFrame: (t) => layer.seekTo(t),
      dispose: layer.dispose,
    });
    material = new THREE.MeshBasicMaterial({ map: layer.texture, transparent: true, depthWrite: false });
  } else {
    let texture: THREE.CanvasTexture;
    if (content.kind === 'sticker' && content.props.imageSlotId) {
      const stickerImg = opts.assets?.[content.props.imageSlotId];
      const { canvas, ctx } = makeCanvas(def.width, def.height);
      if (stickerImg) coverFitDraw(ctx, stickerImg, imgSize(stickerImg).w, imgSize(stickerImg).h, def.width, def.height);
      texture = textureFromCanvas(canvas);
    } else if (content.kind === 'ui-element' || content.kind === 'shape' || content.kind === 'sticker' || content.kind === 'label') {
      const { canvas, ctx } = makeCanvas(def.width, def.height);
      drawStaticContent(ctx, def.width, def.height, content, palette, texts);
      texture = textureFromCanvas(canvas);
    } else {
      texture = textureFromCanvas(makeCanvas(def.width, def.height).canvas);
    }
    material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
  }

  const mesh = new THREE.Mesh(geo, material);
  mesh.name = def.id;
  const isSurface = content.kind === 'screenshot' || content.kind === 'shape' || (content.kind === 'ui-element' && !CTA_LIKE_RECIPES.has(content.recipe));
  if (isSurface) markAsSurfaceContent(mesh);
  return mesh;
}

/**
 * Device frame companion mesh (Tier 1 must-have #1) — a second, slightly
 * larger plane drawn with the *full* device chrome + the same screenshot
 * (deviceFrame.ts's drawDevice, ported 1:1 from classic), added as a child
 * of the screenshot layer's own existing mesh so it inherits that mesh's
 * position/rotation/scale for free every frame (update() below only needs
 * to mirror opacity, which is a material property and isn't inherited via
 * the scene graph). Parented at a small negative local z so Three's default
 * back-to-front transparent sort always draws it before (behind) the
 * screenshot mesh, which still sits exactly over the framed screen area —
 * that overlap is intentional and invisible (see the doc comment at the
 * call site) rather than something a "screen-shaped hole" cutout needs to
 * avoid, which keeps this additive: the screenshot layer's own mesh/texture/
 * UV space is completely untouched, so nothing that already crops or
 * positions against it (cutouts, transforms) needs to change. */
const DEVICE_FRAME_Z_OFFSET = -8;

function buildDeviceFrameMesh(def: LayerDef, device: DeviceFrameSpec, img: ImageAsset | undefined, accent: string, appName: string): THREE.Mesh {
  const { w, h } = deviceOuterSize(def.width, def.height, device.model);
  const { canvas, ctx } = makeCanvas(Math.round(w), Math.round(h));
  ctx.translate(canvas.width / 2, canvas.height / 2);
  drawDevice(ctx, img ?? null, canvas.width, canvas.height, device.model, device.frameColor, accent, appName);
  const material = new THREE.MeshBasicMaterial({ map: textureFromCanvas(canvas), transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(canvas.width, canvas.height), material);
  mesh.name = `${def.id}:frame`;
  mesh.position.z = DEVICE_FRAME_Z_OFFSET;
  // Bakes the same screenshot in as the front mesh above.
  markAsSurfaceContent(mesh);
  return mesh;
}

/**
 * Resolves a cutout's source texture. `sourceSlotId` now does double duty
 * (task follow-up: "resolve sourceSlotId to image, video, lottie or
 * ui-element layers"):
 *  1. If it matches another layer's *id* in this same project, reuse that
 *     layer's own already-built texture directly — the identical
 *     THREE.Texture object, not a copy. For a video/lottie source this is
 *     what makes the cutout "stay live while it lifts out": that layer's
 *     one dynamics entry keeps calling `texture.needsUpdate = true` as it
 *     decodes/seeks, and every cutout referencing it just samples whatever
 *     the texture currently holds — no separate decode, no separate
 *     `dynamics` entry, so a video decodes once per frame no matter how
 *     many cutouts crop from it (same seekTo() staleness/collapsing in
 *     video.ts already covers the single call site this produces).
 *  2. Otherwise, the pre-existing behavior: a real uploaded asset by slot
 *     id (`opts.assets`), cached in `sourceCache` since nothing else builds
 *     a texture for a bare asset that isn't also its own layer.
 *  3. No `sourceSlotId` at all: the original procedural-recipe path,
 *     rendered once and shared across every cutout using the same
 *     recipe+props (also via `sourceCache`).
 */
function resolveCutoutSourceTexture(
  content: Extract<ContentRef, { kind: 'cutout' }>,
  palette: (typeof PALS)[string],
  texts: [string, string, string],
  sourceCache: Map<string, THREE.CanvasTexture>,
  layerTextures: Map<string, THREE.Texture>,
  opts: EngineV2SceneOptions,
): THREE.Texture {
  const { sourceRecipe, sourceProps, sourceSlotId } = content;
  if (sourceSlotId) {
    const live = layerTextures.get(sourceSlotId);
    if (live) return live;

    const cacheKey = `slot:${sourceSlotId}`;
    let tex = sourceCache.get(cacheKey);
    if (!tex) {
      const img = opts.assets?.[sourceSlotId];
      tex = img ? imageToTexture(img) : textureFromCanvas(makeCanvas(1, 1).canvas);
      sourceCache.set(cacheKey, tex);
    }
    return tex;
  }
  const cacheKey = `${sourceRecipe}:${JSON.stringify(sourceProps)}`;
  let tex = sourceCache.get(cacheKey);
  if (!tex) {
    tex = renderRecipeTexture(sourceRecipe ?? '', sourceProps ?? {}, SOURCE_TEXTURE_BASE_SIZE.w, SOURCE_TEXTURE_BASE_SIZE.h, palette, texts);
    sourceCache.set(cacheKey, tex);
  }
  return tex;
}

function buildCutoutMesh(
  def: LayerDef,
  content: Extract<ContentRef, { kind: 'cutout' }>,
  palette: (typeof PALS)[string],
  texts: [string, string, string],
  sourceCache: Map<string, THREE.CanvasTexture>,
  layerTextures: Map<string, THREE.Texture>,
  opts: EngineV2SceneOptions,
): THREE.Mesh {
  const sourceTexture = resolveCutoutSourceTexture(content, palette, texts, sourceCache, layerTextures, opts);
  const material = createCutoutMaterial(sourceTexture, content.rectUv, def.width, def.height, content.radiusPx);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(def.width, def.height), material);
  mesh.name = def.id;
  // A cutout of a real image (uploaded asset, or another live layer's own
  // texture — sourceSlotId covers both) is still screenshot content. A
  // cutout of a *procedural* recipe (chat bubbles, etc.) is stylized
  // content, not a real screenshot, so it's left to render (and bloom) as
  // before — this only exempts cutouts of real images.
  if (content.sourceSlotId) markAsSurfaceContent(mesh);
  return mesh;
}

export function buildEngineV2Scene(renderer: THREE.WebGLRenderer, project: SceneProjectV2, width: number, height: number, opts: EngineV2SceneOptions = {}): EngineV2Scene {
  // Reassigned by refreshContent()/refreshFormat() (latency fix) so update()
  // and any later refresh call always reads the current project — `project`
  // the parameter is only ever the *initial* build's snapshot.
  let currentProject = project;
  const scene = new THREE.Scene();
  const palette = PALS[project.paletteId];
  scene.background = new THREE.Color(palette.base);

  // Tier 1 item 1 (aspect ratio): every template still authors layer
  // positions in the fixed 1080x1920 *design space* (STAGE_W/STAGE_H) —
  // nothing in templates/*.ts changes per format. What DOES change: the
  // camera frames the format's actual FORMAT_STAGE_DIMS (so 1:1/16:9
  // genuinely render at that aspect, not a 9:16 frame cropped to look
  // square), and `contentRoot` uniformly scales the whole 1080x1920 design
  // down to fit entirely inside the new frame — `contentScale` is exactly
  // the same "fit both dimensions" factor a designer would use to shrink
  // a poster to fit a smaller canvas without cropping it. This means every
  // format shows the *same* composition, just re-scaled/centered, rather
  // than a bespoke per-format redesign of each template — an intentional,
  // disclosed tradeoff (see the Tier-1 report) rather than an oversight.
  const format = project.format ?? DEFAULT_FORMAT;
  const stageDims = FORMAT_STAGE_DIMS[format];
  const contentScale = Math.min(stageDims.w / STAGE_W, stageDims.h / STAGE_H);

  const camGroup = new THREE.Group();
  scene.add(camGroup);
  const bgGroup = new THREE.Group();
  bgGroup.position.z = -900;
  camGroup.add(bgGroup);
  const contentRoot = new THREE.Group();
  contentRoot.scale.setScalar(contentScale);
  camGroup.add(contentRoot);
  const pw = new THREE.Group();
  contentRoot.add(pw);
  const freeGroup = new THREE.Group();
  contentRoot.add(freeGroup);
  const headlineGroup = new THREE.Group();
  // Phone screen (SCREEN_H≈1144) is centered at world Y=0 (see reactions.ts's
  // 'chrome' layer, which has no y transform) — its top edge sits at
  // roughly Y=+572, so the headline's baseline needs meaningful clearance
  // above that (this is the first of the layout numbers /dev/compare's
  // side-by-side view is meant to help tune further). Still authored
  // against the fixed design-space STAGE_H, not the format's stageDims.h —
  // contentRoot's scale is what adapts this to the actual output format.
  headlineGroup.position.set(0, STAGE_H / 2 - 340, 40);
  contentRoot.add(headlineGroup);
  const ctaGroup = new THREE.Group();
  ctaGroup.position.set(0, -STAGE_H / 2 + 204, 60);
  contentRoot.add(ctaGroup);

  // Animated mesh-gradient background (docs/MOTION_GUIDE.md: "mesh or
  // multi-stop gradients, never flat" + idle drift) — sized from the
  // FORMAT's actual stage dims, deliberately NOT scaled by contentScale,
  // so it always fills the real output frame instead of shrinking along
  // with the content and leaving dead space around it.
  const background = createMeshGradientBackground(stageDims.w * 2.4, stageDims.h * 2.4, { base: palette.base, b: palette.b });
  bgGroup.add(background.mesh);

  const sourceCache = new Map<string, THREE.CanvasTexture>();
  const dynamics: DynamicLayer[] = [];
  // Two passes so a cutout can crop from *any other* layer regardless of
  // array order: every non-cutout layer builds its mesh (and, for
  // video/lottie, registers its one `dynamics` entry) first, recording its
  // live content texture by layer id; cutouts are then built from that map
  // — see buildCutoutMesh/resolveCutoutSourceTexture above.
  const layerTextures = new Map<string, THREE.Texture>();
  const nonCutoutMeshes = new Map<string, THREE.Mesh>();
  // Device-frame companion meshes (must-have #1), keyed by their owning
  // screenshot layer's id — update() mirrors opacity onto these every
  // frame (position/rotation/scale come for free via THREE parenting).
  const frameMeshes = new Map<string, THREE.Mesh>();
  project.layers.forEach((def) => {
    if (def.content.kind === 'cutout') return;
    const mesh = buildLayerMesh(def, palette, project.texts, sourceCache, dynamics, opts);
    nonCutoutMeshes.set(def.id, mesh);
    const map = (mesh.material as THREE.MeshBasicMaterial).map;
    if (map) layerTextures.set(def.id, map);
    if (def.content.kind === 'screenshot') {
      const device = def.content.device ?? project.device;
      if (device) {
        const frameMesh = buildDeviceFrameMesh(def, device, opts.assets?.[def.content.slotId], palette.accent, project.appName ?? '');
        mesh.add(frameMesh);
        frameMeshes.set(def.id, frameMesh);
      }
    }
  });
  const layerMeshes: BuiltLayer[] = project.layers.map((def) => {
    const mesh =
      def.content.kind === 'cutout'
        ? buildCutoutMesh(def, def.content, palette, project.texts, sourceCache, layerTextures, opts)
        : nonCutoutMeshes.get(def.id)!;
    const parent = def.plane === 'popout' ? (def.liftOf ? pw : freeGroup) : pw;
    parent.add(mesh);
    return { def, mesh };
  });
  const byId = new Map(layerMeshes.map((l) => [l.def.id, l]));

  // Back-face companion meshes (must-have "Flip to second screenshot" /
  // "Flip reveal") — a second mesh per layer that has `backContent`,
  // parented with a fixed local 180° rotateY so Three's default backface
  // culling (every material here is FrontSide, the default) reveals it
  // naturally once the layer's own animated rotateY crosses ~90°. Built
  // after every front mesh exists (works for cutout layers too, unlike
  // the device-frame pass above which only runs for non-cutout layers).
  const backMeshes = new Map<string, THREE.Mesh>();
  project.layers.forEach((def) => {
    if (!def.backContent) return;
    const built = byId.get(def.id);
    if (!built) return;
    const backMesh = buildLayerMesh({ ...def, content: def.backContent }, palette, project.texts, sourceCache, dynamics, opts);
    backMesh.rotation.y = Math.PI;
    built.mesh.add(backMesh);
    backMeshes.set(def.id, backMesh);
  });

  // Particle bursts.
  const bursts: ParticleBurst[] = project.particles.map((pdef) => buildParticleBurst(pdef, pw, palette.accent, palette.ui));

  // Headline beats. `group` is retained (not just `planes`) so
  // refreshContent() can rebuild a beat's word planes in place, reusing
  // the same parent group, when its text changes.
  const beatPlanes: { at: number; out: number; textId: string; group: THREE.Group; planes: WordPlane[] }[] = project.beats.map((beat) => {
    const words = parseHeadline(project.texts[beat.textId === 't1' ? 0 : beat.textId === 't2' ? 1 : 2]);
    const group = new THREE.Group();
    headlineGroup.add(group);
    const planes = buildHeadlineBeat(group, words, { maxWidth: STAGE_W - 168, fontPx: 100, align: project.align, ink: palette.ink, accent: palette.accent, mark: palette.mark });
    return { at: beat.at, out: beat.out, textId: beat.textId, group, planes };
  });

  // CTA.
  const cta = buildLayerMesh(
    { id: 'cta', label: 'CTA', plane: 'popout', content: { kind: 'ui-element', recipe: 'cta', props: {} }, width: 640, height: 120, transform: {}, overrides: {} },
    palette,
    project.texts,
    sourceCache,
    dynamics,
    opts,
  );
  ctaGroup.add(cta);

  const rig = createCameraRig(renderer, scene, width, height, {
    stageH: stageDims.h,
    grainIntensity: project.grainIntensity ?? 0.04,
    vignetteIntensity: project.vignetteIntensity ?? 0,
    // threshold: 0.5, not 0.94 — see camera.ts's bloomOpts doc comment for
    // why (0.94 only ever gated whole-surface bloom-wash, a job the
    // NO_BLOOM_LAYER exclusion now does regardless of threshold; left at
    // 0.94 most colored accents/particles never crossed it and never
    // glowed at all).
    bloom: { strength: project.bloomStrength ?? 0.22, radius: 0.35, threshold: 0.5 },
  });
  const watermark: WatermarkOverlay | null = opts.watermark ? createWatermarkOverlay(width, height) : null;

  function update(t: number): void {
    const style = STYLES[currentProject.styleId];

    layerMeshes.forEach(({ def, mesh }) => {
      const tr = evaluateLayer(t, def, style);
      mesh.position.set(tr.x, -tr.y, tr.z);
      mesh.rotation.set(THREE.MathUtils.degToRad(tr.rx), THREE.MathUtils.degToRad(tr.ry), THREE.MathUtils.degToRad(tr.rz));
      mesh.scale.set(tr.scale, tr.scale, 1);
      setLayerOpacity(mesh, tr.opacity);
      // def.visible is the Layers panel's show/hide toggle (Prompt 5) —
      // undefined means "visible" (every pre-existing template's layers
      // never set it), false always wins over whatever the opacity track
      // would otherwise show.
      mesh.visible = def.visible !== false && tr.opacity > 0.001;
      // Device-frame companion mesh: position/rotation/scale are inherited
      // for free (it's a scene-graph child of `mesh`), but material opacity
      // isn't — mirror it explicitly so a screenshot layer's enter/exit
      // fade takes its frame along with it instead of popping in solid.
      const frameMesh = frameMeshes.get(def.id);
      if (frameMesh) setLayerOpacity(frameMesh, tr.opacity);
      // Back-face companion mesh — same opacity-mirroring reasoning as the
      // device frame above (position/rotation/scale already inherited via
      // parenting; only opacity needs an explicit copy).
      const backMesh = backMeshes.get(def.id);
      if (backMesh) setLayerOpacity(backMesh, tr.opacity);
    });
    currentProject.layers.forEach((def) => {
      if (!def.liftOf) return;
      const source = byId.get(def.liftOf);
      const lift = byId.get(def.id);
      if (!source || !lift) return;
      const dimAmount = Math.min(0.32, Math.max(0, (getLayerOpacity(lift.mesh) - 0.02) * 0.35));
      setLayerOpacity(source.mesh, 1 - dimAmount);
      const sourceFrame = frameMeshes.get(def.liftOf);
      if (sourceFrame) setLayerOpacity(sourceFrame, 1 - dimAmount);
    });

    bursts.forEach((burst) => {
      const origin = byId.get(burst.def.originLayerId);
      const pos = origin ? origin.mesh.position : new THREE.Vector3();
      updateParticleBurst(t, burst, pos.x, pos.y, pos.z + 20);
      if ((window as unknown as { __debugParticles?: boolean }).__debugParticles) {
        const s0 = burst.meshes[0];
        console.log('BURST_DEBUG', t, 'origin', pos.x, pos.y, pos.z, 'sprite0', s0.visible, s0.position.x, s0.position.y, s0.position.z, s0.scale.x, s0.material.opacity);
      }
    });

    beatPlanes.forEach((b) => {
      const visible = updateHeadlineBeat(t, b.planes, b.at, b.out, style.enter, style);
      b.planes.forEach((p) => (p.mesh.visible = visible));
    });

    dynamics.forEach((d) => d.update(t));

    const ctaOpacity = Math.max(0, Math.min(1, (t - currentProject.ctaAt) * 6));
    setLayerOpacity(cta, ctaOpacity);
    cta.visible = ctaOpacity > 0.001;
    const ctaPop = spr(t - currentProject.ctaAt, style.pop);
    const ctaScale = Math.max(0.001, 0.7 + 0.3 * ctaPop);
    cta.scale.set(ctaScale, ctaScale, 1);
    // Local to ctaGroup, which already sits at the correct on-screen
    // position (STAGE_H/2-204 from center) — this is only the small
    // settle-in slide as the pop spring resolves, not another full
    // offset. (Re-adding the full offset here was a real, previously
    // unnoticed bug: it doubled ctaGroup's own position, landing the CTA
    // ~756 world units below the camera frustum — invisible in every
    // template, always.)
    cta.position.y = (1 - ctaPop) * 60;

    const camResult = rig.update(t, currentProject.camera, style);
    // Parallax 0.3 per docs/MOTION_GUIDE.md.
    bgGroup.position.x = (-camResult.x * 0.25 - camResult.ry * 6) * 0.3;
    bgGroup.position.y = camResult.y * 0.22 * 0.3;
    background.update(t, currentProject.seed);

    // Tier 2 item 14 — cheap to just re-sync every frame from whatever the
    // project's current values are (a plain uniform assignment each pass,
    // not a rebuild) rather than adding refresh-detection for three scalar
    // sliders that change rarely.
    rig.setGrainIntensity(currentProject.grainIntensity ?? 0.04);
    rig.setBloomStrength(currentProject.bloomStrength ?? 0.22);
    rig.setVignetteIntensity(currentProject.vignetteIntensity ?? 0);
  }

  /** Latency fix — see EngineV2Scene.refreshContent's doc comment. Redraws
   * in place instead of rebuilding; the only THREE.js churn is disposing
   * and recreating the handful of word-plane meshes per headline beat
   * (proportional to word count, not scene size) since a text edit can
   * change how many words there are. */
  function refreshContent(nextProject: SceneProjectV2): void {
    currentProject = nextProject;
    const nextPalette = PALS[nextProject.paletteId];

    (scene.background as THREE.Color).set(nextPalette.base);
    background.updateColors({ base: nextPalette.base, b: nextPalette.b });

    layerMeshes.forEach(({ def, mesh }) => {
      const content = def.content;
      if (content.kind !== 'ui-element' && content.kind !== 'shape' && content.kind !== 'label' && !(content.kind === 'sticker' && !content.props.imageSlotId)) return;
      const tex = (mesh.material as THREE.MeshBasicMaterial).map as THREE.CanvasTexture | null;
      if (!tex) return;
      const canvas = tex.image as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawStaticContent(ctx, canvas.width, canvas.height, content, nextPalette, nextProject.texts);
      tex.needsUpdate = true;
    });

    // Device-frame companion meshes — redrawn unconditionally (cheap,
    // matches the CTA/ui-element treatment below) rather than only when
    // frameColor is 'theme', since that's the only case that actually
    // depends on the new palette but keeping this branch-free avoids
    // silently going stale if another palette-dependent input is added
    // here later.
    layerMeshes.forEach(({ def }) => {
      if (def.content.kind !== 'screenshot') return;
      const device = def.content.device ?? nextProject.device;
      const frameMesh = frameMeshes.get(def.id);
      if (!device || !frameMesh) return;
      const tex = (frameMesh.material as THREE.MeshBasicMaterial).map as THREE.CanvasTexture | null;
      const canvas = tex?.image as HTMLCanvasElement | undefined;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx || !tex) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      drawDevice(ctx, opts.assets?.[def.content.slotId] ?? null, canvas.width, canvas.height, device.model, device.frameColor, nextPalette.accent, nextProject.appName ?? '');
      ctx.restore();
      tex.needsUpdate = true;
    });

    // Back-face companion meshes — same "redraw whatever's palette/text-
    // dependent" treatment as the front mesh loop above.
    layerMeshes.forEach(({ def }) => {
      const back = def.backContent;
      const backMesh = backMeshes.get(def.id);
      if (!back || !backMesh) return;
      if (back.kind !== 'ui-element' && back.kind !== 'shape' && back.kind !== 'label' && !(back.kind === 'sticker' && !back.props.imageSlotId)) return;
      const tex = (backMesh.material as THREE.MeshBasicMaterial).map as THREE.CanvasTexture | null;
      if (!tex) return;
      const canvas = tex.image as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawStaticContent(ctx, canvas.width, canvas.height, back, nextPalette, nextProject.texts);
      tex.needsUpdate = true;
    });

    // Procedural cutout sources — shared/deduped by recipe+props (see
    // resolveCutoutSourceTexture), so redraw each distinct one once even
    // if several cutouts reference it.
    const redrawnRecipeKeys = new Set<string>();
    layerMeshes.forEach(({ def }) => {
      if (def.content.kind !== 'cutout' || def.content.sourceSlotId) return;
      const { sourceRecipe, sourceProps } = def.content;
      const cacheKey = `${sourceRecipe}:${JSON.stringify(sourceProps)}`;
      if (redrawnRecipeKeys.has(cacheKey)) return;
      redrawnRecipeKeys.add(cacheKey);
      const tex = sourceCache.get(cacheKey);
      if (!tex) return;
      const canvas = tex.image as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const fn = CONTENT_RECIPES[sourceRecipe ?? ''];
      if (fn) fn(ctx, canvas.width, canvas.height, sourceProps ?? {}, nextPalette, nextProject.texts);
      tex.needsUpdate = true;
    });

    // Headline beats — text content itself may differ (word count), so
    // rebuild each beat's word-plane meshes in place, reusing the same
    // parent group (no scene-graph restructuring).
    beatPlanes.forEach((entry) => {
      entry.planes.forEach((p) => {
        p.mesh.geometry.dispose();
        const mat = p.mesh.material as THREE.MeshBasicMaterial;
        mat.map?.dispose();
        mat.dispose();
        entry.group.remove(p.mesh);
      });
      const words = parseHeadline(nextProject.texts[entry.textId === 't1' ? 0 : entry.textId === 't2' ? 1 : 2]);
      entry.planes = buildHeadlineBeat(entry.group, words, { maxWidth: STAGE_W - 168, fontPx: 100, align: nextProject.align, ink: nextPalette.ink, accent: nextPalette.accent, mark: nextPalette.mark });
    });

    // CTA button.
    {
      const tex = (cta.material as THREE.MeshBasicMaterial).map as THREE.CanvasTexture | null;
      const canvas = tex?.image as HTMLCanvasElement | undefined;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx && tex) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const fn = CONTENT_RECIPES.cta;
        if (fn) fn(ctx, canvas.width, canvas.height, {}, nextPalette, nextProject.texts);
        tex.needsUpdate = true;
      }
    }
  }

  /** Latency fix — see EngineV2Scene.refreshFormat's doc comment. */
  function refreshFormat(nextProject: SceneProjectV2): void {
    currentProject = nextProject;
    const nextFormat = nextProject.format ?? DEFAULT_FORMAT;
    const nextStageDims = FORMAT_STAGE_DIMS[nextFormat];
    contentRoot.scale.setScalar(Math.min(nextStageDims.w / STAGE_W, nextStageDims.h / STAGE_H));
    rig.setStageH(nextStageDims.h);
    background.resize(nextStageDims.w * 2.4, nextStageDims.h * 2.4);
  }

  function render(): void {
    rig.render();
    // Drawn last, using whatever render target is currently active — for
    // preview and a plain export frame that's the screen; during export's
    // motion-blur accumulation it's the accumulation target (export.ts
    // sets that before calling this), which is correct: the watermark
    // doesn't move, so accumulating N identical copies of it at weight
    // 1/N each averages back to the same opacity, not a blurred one.
    watermark?.render(renderer);
  }

  function setSize(w: number, h: number): void {
    renderer.setSize(w, h, false);
    rig.setSize(w, h);
    watermark?.setSize(w, h);
  }
  setSize(width, height);

  function dispose(): void {
    rig.dispose();
    watermark?.dispose();
    background.dispose();
    // lottie/video layers own a DOM element (a detached container div, or
    // a <video>) the generic mesh sweep below can't reach — only their own
    // dispose() cleans that up (and pauses/detaches the video, destroys
    // the lottie animation instance).
    dynamics.forEach((d) => d.dispose());
    // Shared cutout source textures (sourceCache) aren't reachable via any
    // single mesh's `.map` — cutout materials hold them in a `uMap`
    // uniform instead, so the generic per-mesh sweep below can't find
    // them; dispose the cache directly.
    sourceCache.forEach((tex) => tex.dispose());
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Sprite) {
        obj.geometry?.dispose?.();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => {
          const map = (m as THREE.MeshBasicMaterial).map;
          map?.dispose();
          m.dispose();
        });
      }
    });
  }

  function setRenderToScreen(v: boolean): void {
    rig.composer.renderToScreen = v;
  }
  function getComposedTexture(): THREE.Texture {
    return rig.composer.readBuffer.texture;
  }

  const ready = Promise.all(dynamics.map((d) => d.ready)).then(() => undefined);

  function awaitFrame(t: number): Promise<void> {
    const pending = dynamics.map((d) => d.awaitFrame?.(t)).filter((p): p is Promise<void> => p !== undefined);
    return pending.length === 0 ? Promise.resolve() : Promise.all(pending).then(() => undefined);
  }

  return { scene, camera: rig.camera, update, render, setSize, dispose, setRenderToScreen, getComposedTexture, ready, awaitFrame, refreshContent, refreshFormat };
}
