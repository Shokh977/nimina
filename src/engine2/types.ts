/**
 * Engine v2's declarative project model. A template is authored as data —
 * an array of LayerDefs, each carrying keyframe tracks — evaluated at
 * runtime by one generic function (evaluate.ts) with zero per-template
 * code paths. This is what makes every part of a template editable: the
 * Manual editor level edits this same data the templates ship with.
 *
 * A template's buildLayers() (see templates/*.ts) still runs as code, but
 * only once, at build time, to *produce* this data — exactly like
 * src/engine/templates.ts's TemplateDef.build() produces a plain Project
 * for the classic (2D) engine. Nothing here is evaluated by calling into
 * template-specific code per frame.
 */
import type { EngineFormat } from './camera';
import type { SpringPresetId } from './spring';
import type { PaletteId } from './palettes';
import type { StyleId } from './styles';
import type { ModelKey, FrameColorId } from './deviceFrame';

/** A device frame choice — 6 models x 6 colors (deviceFrame.ts), applied to
 * a 'screenshot' layer either per-layer (ContentRef's `device`) or as the
 * project-wide default every screenshot layer without its own override
 * falls back to (SceneProjectV2.device). v2 has no discrete "slide" the
 * way classic's `scenes[]` does — a template's screenshot layers are its
 * closest equivalent, so "per-slide" (Tier 1 must-have #1) means per
 * screenshot layer here. */
export interface DeviceFrameSpec {
  model: ModelKey;
  frameColor: FrameColorId;
}

export type Vec3 = { x: number; y: number; z: number };

/** Anything drawImage()-able that holds decoded pixels — a real screenshot
 * (HTMLImageElement) or a procedurally-drawn one (HTMLCanvasElement, e.g.
 * ui-kit/paletteExtractor.ts's demo content). Used by 'screenshot' content
 * and cutout's `sourceSlotId` (see ContentRef below) — the `assets` map
 * passed to buildEngineV2Scene resolves slot ids to one of these. */
export type ImageAsset = HTMLImageElement | HTMLCanvasElement;

/** A track that never moves — shorthand for content/camera fields a given
 * template doesn't animate (e.g. most templates' camera.rotation.rz). */
export function constTrack(base: number): PropertyTrack {
  return { base, steps: [] };
}

/** Which style multiplier (if any — see styles.ts) scales this step's
 * delta at bake time. 'none' means the step's value is used as authored,
 * unscaled by motion style. */
export type ScaleBy = 'R' | 'F' | 'stag' | 'burst' | 'none';

/** Cubic-bezier control points `[x1,y1,x2,y2]`, the same convention CSS's
 * `cubic-bezier()` uses (implicit P0=(0,0), P3=(1,1); x1/x2 must stay in
 * [0,1] so the curve is monotonic in time). See bezier.ts. */
export type CubicBezier = [number, number, number, number];

export interface KeyframeStep {
  /** Seconds from the layer's local start (or scene start for camera/global tracks). */
  at: number;
  /** Target value this step springs toward. */
  to: number;
  spring: SpringPresetId;
  /** When set, this step plays a fixed-duration cubic-bezier curve instead
   * of `spring`'s open-ended analytic spring (Prompt 5: "advanced users can
   * ... edit spring presets or bezier curves in a curve editor"). `spring`
   * stays populated as the fallback if `easing` is later cleared in the
   * inspector, but is ignored while `easing` is present. */
  easing?: CubicBezier;
  /** Duration in seconds for `easing` — springs settle asymptotically and
   * don't need one; a bezier curve does. Ignored unless `easing` is set.
   * Defaults to 0.5s when omitted. */
  dur?: number;
  scaleBy?: ScaleBy;
}

export interface PropertyTrack {
  base: number;
  steps: KeyframeStep[];
  /** Idle float layered on top — `amp` is the *unscaled* base amplitude;
   * evaluate.ts multiplies by the current style's F at read time (same as
   * every 'F'-scaled step), so switching Style never needs to touch this
   * data, only which multiplier is applied to it. Period in seconds, phase
   * in radians. */
  float?: { amp: number; period: number; phase: number };
  /** Continuous one-directional motion (units/sec, added on top of
   * base+steps+float, unconditionally: `spin * t`) — MOTION_GUIDE.md's
   * explicit exception to "springs for everything": "continuous scroll/
   * rotation". A sticker's "spin" idle animation is this on `rz`; nothing
   * else in this engine currently needs a literal unbounded ramp, which is
   * why it's opt-in per track rather than a general easing mode. */
  spin?: number;
}

export type Axis = 'x' | 'y' | 'z' | 'rx' | 'ry' | 'rz' | 'scale' | 'opacity';

export type Transform3DTrack = Partial<Record<Axis, PropertyTrack>>;

/** Distinct shapes 'shape' content can draw — plain vector primitives, not
 * a hand-drawn recipe. Colors are palette keys (see palettes.ts) resolved
 * at render time so shapes stay theme-consistent across a Remix. */
export type ShapeKind = 'rect' | 'roundrect' | 'circle' | 'ellipse' | 'ring';

export interface ShapeProps {
  shape: ShapeKind;
  fill?: 'ink' | 'ui' | 'accent' | 'base' | 'none';
  stroke?: 'ink' | 'ui' | 'accent' | 'base' | 'none';
  strokeWidth?: number;
  /** 'roundrect' only — pixels. */
  cornerRadius?: number;
  /** 'ring' only — inner radius as a fraction (0-1) of the layer's half-size. */
  ringThickness?: number;
}

/** A sticker's idle animation — Prompt 7: "enter/idle animations (bob,
 * spin, wobble)". "Enter" is just an ordinary Prompt-5 preset applied to
 * the layer like any other (pop/rise/scaleFromPoint all suit a sticker
 * fine); these three are the *idle*, continuous-forever ones a one-shot
 * spring step can't express — see PropertyTrack's `float`/`spin` fields,
 * which is what stickerKit.ts's createStickerLayer() actually sets. */
export type StickerIdle = 'none' | 'bob' | 'spin' | 'wobble';

export interface StickerProps {
  /** A single emoji or short glyph, drawn centered and as large as the
   * layer's box allows — a literal sticker stamp, not a card (see
   * 'ui-element' for anything with a background/label). Exactly one of
   * `emoji`/`imageSlotId` is set. */
  emoji?: string;
  /** An uploaded PNG (or any drawImage()-able asset), looked up the same
   * way 'screenshot' content resolves slotId -> pixels (sceneBuilder.ts's
   * `assets` map) — Prompt 7: "emoji and uploaded PNGs". */
  imageSlotId?: string;
}

export interface LottieProps {
  /** Parsed Lottie JSON, inlined at build time (never fetched mid-render —
   * keeps a template's build() the only place that does async/IO work, and
   * every later evaluation a pure sync function of time). A user-uploaded
   * .json/.lottie file is parsed once at upload time (lottieAssets.ts) and
   * stored here the same way — this field never holds a URL. */
  data: object;
  /** Loops by default — a one-shot sticker animation should set this false
   * and let its containing layer's opacity track hide it once played. */
  loop?: boolean;
}

export interface VideoProps {
  /** Any playable URL (blob:, Supabase Storage signed URL, ...) — always
   * the *live, currently-resolved* URL the engine actually decodes from.
   * Never persisted as authoritative once `assetId` is set (see below) —
   * signed URLs expire, so it would go stale between sessions. */
  src: string;
  /** Stable Storage reference (infrastructure merge: Supabase persistence)
   * — when set, the persistence hydration step always re-derives `src`
   * from a freshly-signed URL for this id before the engine sees the
   * project, ignoring whatever `src` was last saved. Absent for a video
   * that's only ever lived in the current browser session (not yet
   * autosaved) or hasn't been migrated to durable storage. */
  assetId?: string;
  loop?: boolean;
  /** Muted by default — matches every other layer type having no audio of
   * its own; a project's music/SFX pipeline stays the single audio path. */
  muted?: boolean;
  /** Trim in/out, seconds within the *source* file — defaults to the
   * whole clip. Playback (and looping) only ever covers [trimStart, trimEnd). */
  trimStart?: number;
  trimEnd?: number;
  /** Playback rate multiplier — 2 plays twice as fast, 0.5 half speed.
   * Defaults to 1. */
  speed?: number;
  /** When set, the layer always shows the single source frame at this
   * timestamp (seconds, within the untrimmed source) regardless of the
   * scene's own time — a freeze-frame, not a video anymore. */
  freezeAt?: number;
}

/** Content a layer renders. Each kind has its own typed props and its own
 * renderer (sceneBuilder.ts's buildLayerContent) — replaces the earlier
 * catch-all 'ui' kind, which lumped genuine UI chrome (cards, bubbles,
 * buttons — now 'ui-element', same recipe registry as before) together
 * with things that are really vector shapes, stickers, or media. */
export type ContentRef =
  | { kind: 'shape'; props: ShapeProps }
  | { kind: 'ui-element'; recipe: string; props: Record<string, unknown> }
  | { kind: 'lottie'; props: LottieProps }
  | { kind: 'video'; props: VideoProps }
  | { kind: 'sticker'; props: StickerProps }
  /** An anchor layer with no pixels of its own — purely a positioned
   * `originLayerId` target for a ParticleBurstDef (see
   * SceneProjectV2.particles). Bursts remain their own system (deterministic,
   * seeded, precomputed once per burst — see particles.ts) rather than being
   * folded into the keyframe/evaluate model, since a particle field isn't a
   * single animatable transform the way every other layer is; this content
   * kind exists so a burst's origin can still be authored and moved exactly
   * like any other layer instead of as a bare id reference. */
  | { kind: 'particles' }
  | { kind: 'text'; textId: string }
  /** A real image (a user's screenshot, not a procedural recipe) — `slotId`
   * looks it up in the `assets` map passed to buildEngineV2Scene (Prompt 6's
   * scene recipes; see sceneBuilder.ts). Cover-fit into width/height, same
   * as the classic engine's screen content. `device`, when set, overrides
   * SceneProjectV2.device's project-wide default for this layer only
   * (Tier 1 must-have #1) — sceneBuilder.ts draws a device-frame companion
   * mesh behind this layer's own plane when either is present; absent on
   * both means a bare screenshot, no chrome, exactly like before this
   * field existed. */
  | { kind: 'screenshot'; slotId: string; device?: DeviceFrameSpec }
  /** A rounded-corner rectangle cropped from a full-size source — the
   * literal "cutout" layer type. The source is *either* a procedural recipe
   * (`sourceRecipe`/`sourceProps`, rendered once and shared across every
   * cutout referencing the same recipe+props — sceneBuilder.ts's source-
   * texture cache) *or* `sourceSlotId`, which resolves two ways: first
   * checked against every other layer's *id* in the same project — if it
   * matches a 'screenshot', 'video', 'lottie' or 'ui-element' layer, the
   * cutout crops directly from that layer's own live texture (so a cutout
   * of a playing video keeps decoding/updating in lockstep with it, no
   * separate decode); otherwise it falls back to a real uploaded asset by
   * slot id, looked up the same way 'screenshot' content is. Exactly one of
   * `sourceRecipe`/`sourceSlotId` is set. `rectUv` is the crop region in
   * the source's normalized 0-1 UV space (relative to the source layer's
   * own width/height, for a live-layer source); `radiusPx` is corner
   * radius in this layer's own width/height units. */
  | { kind: 'cutout'; sourceRecipe?: string; sourceProps?: Record<string, unknown>; sourceSlotId?: string; rectUv: [number, number, number, number]; radiusPx: number }
  /** Plain drawn text on a rounded card — a lightweight content kind for
   * cases that don't need a full 'ui-element' recipe (Tier 1 part C's
   * "Flip reveal": text on a cutout's back face). Not a headline beat (see
   * 'text' above) — this is ordinary per-layer content, resolved the same
   * static way 'shape'/'sticker' are. */
  | { kind: 'label'; text: string; fill?: 'ink' | 'ui' | 'accent' | 'base' }
  | { kind: 'none' };

export type LayerPlane = 'background' | 'device' | 'popout';

export interface LayerDef {
  id: string;
  label: string;
  plane: LayerPlane;
  content: ContentRef;
  /** Pixel size of the content's own drawing surface (before any transform). */
  width: number;
  height: number;
  transform: Transform3DTrack;
  /** Axes the Manual editor level has hand-edited — a UI signal only (shows
   * a "customized" indicator), not something evaluate.ts branches on: style
   * scaling is applied per-step via `scaleBy`, so a manually-set step
   * simply carries `scaleBy: 'none'` and is otherwise evaluated exactly
   * like every other step. Switching Style never rewrites keyframe data. */
  overrides: Partial<Record<Axis, true>>;
  /** True while this layer is a "lift" copy of another (see LIFT_OF) —
   * dims the source and pops this one toward the camera. */
  liftOf?: string;
  /** Layers panel state (Prompt 5) — optional and defaulted (true/false/
   * undefined) so every existing template's LayerDef literals stay valid
   * with no changes. Hidden/locked are editor-only concerns: sceneBuilder.ts
   * honors `visible` (skips building/rendering the mesh entirely) but has
   * no notion of "locked" itself — that's purely an editorV2Store guard
   * against further edits, never read by the renderer. */
  visible?: boolean;
  locked?: boolean;
  /** Layers sharing a groupId are shown nested under a group header in the
   * Layers panel; toggling the group's visibility/lock cascades to members
   * (editorV2Store, not sceneBuilder). Not a transform hierarchy — a group
   * has no transform of its own, unlike `liftOf`/`plane`. */
  groupId?: string;
  /** Tier 1 "Flip to second screenshot" / "Flip reveal" — content shown on
   * this layer's reverse face during a rotateY flip (deviceFlipToSecond/
   * cutoutFlipReveal presets). Rendered as a second mesh, same width/
   * height, parented as this layer's child with a fixed local 180°
   * rotateY — Three.js's default backface culling (every material here
   * uses the default FrontSide) means it's naturally invisible until the
   * layer's *own* animated rotateY crosses roughly 90°, at which point the
   * front mesh culls and this one faces the camera instead. No per-frame
   * texture-swap logic needed; the existing rotation animation does all
   * the work. Absent means no back face (every layer predating this field
   * shows nothing — a flip preset applied without one just spins through
   * to blank, which is a content-authoring gap, not a renderer bug). */
  backContent?: ContentRef;
}

export interface HeadlineBeat {
  /** Seconds this beat's words start entering. */
  at: number;
  /** Seconds this beat starts exiting. */
  out: number;
  textId: string;
}

export interface ParticleBurstDef {
  id: string;
  at: number;
  count: number;
  kind: 'confetti' | 'hearts' | 'sparkles' | 'stars' | 'coins';
  originLayerId: string;
  dir: number;
  spread: number;
  speed: number;
  gravity: number;
  life: number;
  seedOffset: number;
}

/**
 * The camera, promoted to the same kind of thing every content layer is:
 * every property below is a `PropertyTrack` played by the exact same
 * `evaluateProperty()` (spring steps, style scaling, idle float) — nothing
 * camera-specific in evaluate.ts. It isn't stored inside `LayerDef[]`
 * because it has no content/width/height/plane and needs target/fov, which
 * are camera-only concepts; keeping it a sibling field
 * (`SceneProjectV2.camera`) avoids a `LayerDef` union branch every other
 * layer consumer would have to account for.
 */
export interface CameraLayerDef {
  position: { x: PropertyTrack; y: PropertyTrack; z: PropertyTrack };
  /** World point the camera looks at, same CSS-down convention as every
   * other y track. Most templates set this to literally the same
   * PropertyTrack objects as `position.x`/`position.y` (shared by
   * reference, not copied) so the camera looks straight ahead as it
   * pans/dollies — target.z stays 0 (the subject plane). A template can
   * give it independent tracks for a real pan (camera moves one way,
   * looks another). */
  target: { x: PropertyTrack; y: PropertyTrack; z: PropertyTrack };
  /** Extra rotation applied on top of the look-at orientation, Euler
   * degrees. (Before this existed, camera.ts computed rx/ry and then
   * immediately called `camera.lookAt()`, which silently overwrites any
   * manually-set rotation — so every template's old `rx`/`ry` values were
   * dead code. Rotation now composes after the look-at, so these finally
   * have a visible effect: a slight look-away from center, or roll via rz.) */
  rotation: { rx: PropertyTrack; ry: PropertyTrack; rz: PropertyTrack };
  /** Dolly-zoom multiplier (>1 = pushed in). Preferred over animating
   * `fov` for a push-in, since a dolly doesn't distort perspective the way
   * a lens/FOV change does (docs/MOTION_GUIDE.md). */
  zoom: PropertyTrack;
  /** Vertical FOV, degrees. Templates should leave this a constTrack (no
   * steps) and use `zoom` for push-ins — exposed as animatable mainly so a
   * template can make a deliberate, rare "lens" choice, not as the default
   * way to zoom. */
  fov: PropertyTrack;
  /** Always-on subtle idle drift (MOTION_GUIDE: "subtle continuous drift
   * (0.5-1% scale) between moves... never perfectly still") — true for
   * every existing template (their prior, hardcoded-always-on behavior);
   * set false for a deliberately locked-off shot. */
  drift: boolean;
  /** Camera preset "Rack focus" (Tier 1 part B) — an independent world-Z
   * delta from the subject plane the camera focuses on at rest, decoupled
   * from `zoom`: without this, DOF is entirely zoom-derived (camera.ts's
   * `dofPx` from `(zoom-1)*70`), so a rack focus that shifts sharpness
   * between two layers *without* also pushing in wasn't expressible.
   * Absent (every template predating this field) means focus = the
   * camera-to-subject distance exactly as before — no behavior change. */
  focusOffset?: PropertyTrack;
}

/** The fully-resolved, ready-to-evaluate project for one template instance
 * — this is what the Manual editor level edits directly, and what
 * evaluate.ts's evaluateScene() consumes every frame. */
export interface SceneProjectV2 {
  templateId: string;
  styleId: StyleId;
  paletteId: PaletteId;
  seed: number;
  texts: [string, string, string];
  duration: number;
  ctaAt: number;
  beats: HeadlineBeat[];
  layers: LayerDef[];
  particles: ParticleBurstDef[];
  camera: CameraLayerDef;
  /** Per-instance layout facts baked in at build time from the seed (sign
   * flip, alignment, ...) — kept for Remix to regenerate cleanly. */
  sign: 1 | -1;
  align: 'center' | 'left';
  /** Output aspect ratio (Tier 1 item 1) — '9:16'/'1:1'/'16:9'. Optional
   * and defaults to '9:16' (camera.ts's DEFAULT_FORMAT) wherever read, so
   * every project saved before this field existed keeps rendering exactly
   * as it always did. Templates never read this — they always author in
   * the fixed 1080x1920 design space; only sceneBuilder.ts's camera/
   * contentRoot setup and export.ts's output dimensions consult it. */
  format?: EngineFormat;
  /** Optional — when set, the layer timeline (Prompt 5) offers snapping to
   * beat/half-beat intervals (60/bpm seconds) alongside snapping to other
   * layers' keyframe times. Absent for every template built before this,
   * and for any project that isn't music-driven. */
  bpm?: number;
  /** Music (Tier 1 item 4, infrastructure merge) — a stable Storage asset
   * id, resolved to a decoded AudioBuffer by the persistence hydration
   * step and kept in editorV2Store's `music` field (an AudioBuffer can't
   * be JSON-serialized, so it never lives here directly — same split
   * classic's Project.music.assetId / assets.audio[] uses). Absent means
   * no music track. */
  musicAssetId?: string;
  /** 0-1, defaults to 0.8 if absent (same default the classic engine's
   * Project.volume and this engine's export.ts musicVolume option use). */
  musicVolume?: number;
  /** Project-wide default device frame (Tier 1 must-have #1) — every
   * 'screenshot' layer without its own `content.device` override uses
   * this. Absent means no frame anywhere (every project/template built
   * before this field existed keeps rendering exactly as it always did —
   * a bare cover-fit screenshot). */
  device?: DeviceFrameSpec;
  /** Shown in the browser model's url bar ("appname.app") — same field
   * classic's Project.appName is, mirrored here for the same purpose.
   * Defaults to 'app' (deviceFrame.ts's own slug() fallback) when absent. */
  appName?: string;
  /** Tier 2 item 14 — post-process intensity sliders. Each is absent by
   * default, meaning "use camera.ts's built-in default" (0.04 grain, 0.22
   * bloom strength, 0 i.e. no vignette) — every project/template
   * predating these fields renders exactly as it always did. */
  grainIntensity?: number;
  bloomStrength?: number;
  vignetteIntensity?: number;
}

export interface BuildContext {
  seed: number;
  sign: 1 | -1;
  align: 'center' | 'left';
  v: [number, number];
  paletteId: PaletteId;
}

export interface TemplateRecipeV2 {
  id: string;
  label: string;
  icon: string;
  sub: string;
  defaultPalette: PaletteId;
  /** Seconds at style.speed === 1. */
  duration: number;
  ctaAt: number;
  beats: Array<[at: number, out: number]>;
  defaultTexts: [string, string, string];
  build(ctx: BuildContext): { layers: LayerDef[]; particles: ParticleBurstDef[]; camera: CameraLayerDef };
}
