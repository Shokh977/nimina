/**
 * Data model for the Promo Studio rendering engine.
 *
 * This module has no React/Next.js/DOM-framework dependencies. It describes
 * the shape of a "Project" (the full editable state of a promo video) and
 * the smaller pieces the renderer needs, derived 1:1 from the prototype's
 * `state` object in legacy/promo-studio.html.
 */

/* ---------- enums / option unions ---------- */

export type Format = '9:16' | '1:1' | '16:9';

export type ModelKey = 'island' | 'notch' | 'punch' | 'tablet' | 'browser' | 'card';

/** Which cutout/chrome style a device frame draws (derived from ModelKey). */
export type FrameCut = 'island' | 'notch' | 'punch' | 'cam' | 'browser' | 'none';

export type FrameColorId = 'graphite' | 'silver' | 'titanium' | 'midnight' | 'rose' | 'theme';

export type SlideAnim = 'rise' | 'pop' | 'slide' | 'swing' | 'spotlight';
export type Camera = 'none' | 'push' | 'pull' | 'drift' | 'shake';
export type Gesture = 'none' | 'tap' | 'swipeUp' | 'swipeLeft';
export type SlideLayout = 'single' | 'fan';
export type Effect = 'none' | 'confetti' | 'sparkles' | 'stickers';
export type TextAnim = 'rise' | 'pop' | 'type' | 'slide' | 'letters';
export type HlStyle = 'marker' | 'color' | 'underline';
export type Transition = 'none' | 'wipe' | 'flash' | 'iris' | 'bars';
export type BgPattern = 'glow' | 'grid' | 'dots' | 'rays' | 'waves';
export type TextPos = 'top' | 'bottom';
export type Quality = '720' | '1080' | '2160';

/* ---------- assets ---------- */

/** Anything the canvas can draw as an image: an uploaded photo, or a
 * procedurally-generated placeholder (the sample screenshot generator
 * returns a canvas, exactly like the prototype). */
export type ImageAsset = HTMLImageElement | HTMLCanvasElement;

/** Slides/intro/outro reference images by id; the caller resolves ids to
 * actual decoded assets via this map before/while rendering. */
export type AssetMap = Record<string, ImageAsset>;

/* ---------- static config shapes (constants.ts is typed against these) ---------- */

export interface FormatDef {
  w: number;
  h: number;
  name: string;
  use: string;
}

export interface Colors {
  a: string;
  b: string;
  text: string;
  accent: string;
}

export interface ColorPreset extends Colors {
  name: string;
}

export interface FontDef {
  name: string;
  /** headline weight */
  h: number;
  /** subtitle weight */
  s: number;
  label: string;
}

export interface ModelDef {
  label: string;
  /** width / height ratio of the device */
  ratio: number;
  /** body corner radius, as a fraction of width */
  r: number;
  /** bezel thickness, as a fraction of width */
  bez: number;
  /** screen corner radius, as a fraction of width */
  sr: number;
  cut: FrameCut;
}

export interface FrameColorDef {
  id: FrameColorId;
  label: string;
  /** absent for the 'theme' entry, which is resolved dynamically from the
   * active color theme's accent color */
  body?: string;
  btn?: string;
  edge?: string;
  chrome?: string;
  chromeInk?: string;
}

/** frameColor() always returns one of these, theme-resolved or not. */
export interface FrameColorResolved {
  body: string;
  btn: string;
  edge: string;
  chrome: string;
  chromeInk: string;
}

/* ---------- slide-level style overrides ---------- */

/**
 * Per-slide (and per intro/outro) overrides of the project-wide defaults.
 * An absent/empty-string key means "use the project default" — this mirrors
 * the prototype's <select> "Default (...)" option, whose empty value
 * deletes the override.
 */
export interface SlideStyle {
  /** index into PRESETS, stored as a string (matches a <select> value) */
  theme?: string;
  textAnim?: TextAnim;
  hlStyle?: HlStyle;
  transition?: Transition;
  bgPattern?: BgPattern;
  /** stored as 'on' | 'off' rather than boolean, matching the prototype */
  shapes?: 'on' | 'off';
  textPos?: TextPos;
  model?: ModelKey;
  fcolor?: FrameColorId;
}

/** The project-wide defaults resolved against a slide's overrides. */
export interface ResolvedStyle {
  colors: Colors;
  textAnim: TextAnim;
  hlStyle: HlStyle;
  transition: Transition;
  bgPattern: BgPattern;
  shapes: boolean;
  textPos: TextPos;
  model: ModelKey;
  fcolor: FrameColorId;
}

/* ---------- cutouts (pop-out screenshot elements) ---------- */

export type CutoutPreset = 'liftOut' | 'popReturn' | 'flyToSide' | 'zoomHero' | 'stack';

/**
 * A user-drawn rectangle on a screenshot that pops out toward the camera as
 * its own animated layer — a button, card or list item "lifted" out of the
 * screen. Rendered by src/engine/cutouts.ts, edited via the Cutouts editor
 * (src/components/editor/panels/CutoutsEditor.tsx).
 */
export interface CutoutLayer {
  id: string;
  /** Normalized (0-1, 0-1) rect within the *full* source screenshot — same
   * convention as `focus` below, not the cover-fit/cropped device screen
   * box, so it stays correct across format/device changes. */
  rect: { x: number; y: number; w: number; h: number };
  /** Corner radius as a fraction (0-0.5) of the rect's shorter side, in
   * *source image* pixels — resolution-independent like every other
   * normalized field here. */
  radius: number;
  preset: CutoutPreset;
  /** Darkens/blurs the region left behind in the base screenshot while this
   * cutout is lifted, so it reads as "this came out of the screen." */
  hollow: boolean;
  /** Seconds within the slide when this cutout starts animating out. */
  at: number;
  /** 'stack' preset only: this cutout's position among the other 'stack'
   * cutouts on the same slide (0 = front of the fan). Ignored by every
   * other preset. */
  stackIndex: number;
}

export type CounterFormat = 'integer' | 'currency' | 'percent';

/**
 * An animated count-up number overlaid on a slide (a balance ticking up,
 * likes/XP incrementing, a percentage climbing). `from`/`to` are the raw
 * numeric endpoints regardless of format — for 'percent' that means the
 * percent number itself (0 to 87 reads "87%", not a 0-1 fraction), for
 * 'currency' the plain amount (`currencySymbol` is prepended separately).
 * Positioned the same way callout/gesture are (`x`/`y` normalized 0-1
 * within the screenshot, resolved via the same `focusLocal` helper), timed
 * the same way a cutout is (`at`/`duration` in seconds within the slide).
 */
export interface CounterConfig {
  from: number;
  to: number;
  format: CounterFormat;
  /** Only used when format === 'currency'. */
  currencySymbol: string;
  decimals: number;
  at: number;
  duration: number;
  easing: EasingName;
  x: number;
  y: number;
}

interface SlideBase {
  id: number;
  headline: string;
  sub: string;
  anim: SlideAnim;
  dur: number;
  /** fractional point (0-1, 0-1) within the screenshot that zoom/gesture/
   * callout target */
  focus: { x: number; y: number };
  gesture: Gesture;
  layout: SlideLayout;
  badge: string;
  callout: string;
  camera: Camera;
  effect: Effect;
  /** up to 5 graphemes, used when effect === 'stickers' */
  stickers: string;
  /** scroll through a tall screenshot instead of holding still */
  scroll: boolean;
  /** Pop-out cutout layers cropped from this slide's screenshot — empty for
   * TextSlide/StorySlide, which have no single screenshot to draw one from
   * (only ImageSlide's UI ever creates these). */
  cutouts: CutoutLayer[];
  /** null = no counter on this slide (the common case) — same "absent
   * object" convention as `iconAssetId`, not an empty-string sentinel like
   * badge/callout, since there's no single scalar default that means off. */
  counter: CounterConfig | null;
  style: SlideStyle;
}

export interface ImageSlide extends SlideBase {
  kind: 'image';
  /** key into the AssetMap passed to render(); null if no image assigned yet */
  imgAssetId: string | null;
}

export interface TextSlide extends SlideBase {
  kind: 'text';
  imgAssetId: null;
}

/* ---------- story slides ---------- */
/**
 * One continuous phone shot driven by an ordered list of actions (tap,
 * scroll, show a different screenshot, etc.) instead of a single static
 * screenshot. See src/engine/story/ for the renderer.
 */

export type Point = { x: number; y: number };

/** Matches the engine's existing easing function names (src/engine/utils.ts). */
export type EasingName = 'linear' | 'easeOutCubic' | 'easeInCubic' | 'easeInOutCubic' | 'easeOutBack';

export type ScreenTransition = 'push' | 'modal' | 'fade' | 'zoom' | 'none';
export type LoadingStyle = 'spinner' | 'skeleton' | 'splash';
export type TapPress = 'ripple' | 'press' | 'both';
export type BuiltInIcon = 'bell' | 'heart' | 'cart' | 'check' | 'star';
export type IconAnimKind = 'ring' | 'bounce' | 'pulse' | 'pop';
export type BuiltInSprite = 'scooter' | 'car' | 'bike' | 'pin' | 'bell' | 'heart' | 'cart' | 'pizza-box';

export type Wallpaper = { kind: 'color'; color: string } | { kind: 'gradient'; from: string; to: string };

/** One of the story's tall/full screenshots, referenced by id from `showScreen` actions. */
export interface StoryScreen {
  id: string;
  /** key into the AssetMap passed to renderStory() */
  assetId: string;
}

interface ActionCommon {
  id: string;
  /** seconds */
  duration: number;
  /** 'after-previous' starts when the previous action in the array ends;
   * 'with-previous' starts at the same time the previous action started
   * (i.e. runs in parallel with it) — same semantics as PowerPoint/Keynote
   * animation triggers. */
  startMode: 'after-previous' | 'with-previous';
  easing: EasingName;
  /** '' uses this action type's default sound (see src/engine/audio/sfx.ts's
   * DEFAULT_SFX_FOR_ACTION), an explicit SfxId overrides it, and 'none'
   * explicitly silences it — mirrors SlideStyle's "Default (...)" pattern. */
  sfx: string;
}

/**
 * Home screen with a grid of placeholder icons, wallpaper, a finger tap on
 * the app icon, and the icon scaling up into a full-screen app-open animation.
 */
export type LaunchAppAction = ActionCommon & {
  type: 'launchApp';
  iconAssetId?: string;
  wallpaper: Wallpaper;
  iconPosition: Point;
};
export type ShowScreenAction = ActionCommon & { type: 'showScreen'; screenId: string; transition: ScreenTransition };
export type LoadingAction = ActionCommon & { type: 'loading'; style: LoadingStyle; logoAssetId?: string };
/** Vertical scroll through the current tall screenshot. `from`/`to` are
 * normalized 0-1 scroll fractions. */
export type ScrollAction = ActionCommon & { type: 'scroll'; from: number; to: number; overshoot?: boolean };
export type TapAction = ActionCommon & { type: 'tap'; x: number; y: number; press: TapPress };
export type LongPressAction = ActionCommon & { type: 'longPress'; x: number; y: number };
export type SwipeAction = ActionCommon & { type: 'swipe'; from: Point; to: Point };
export type TypeTextAction = ActionCommon & { type: 'typeText'; x: number; y: number; width: number; text: string; charsPerSecond: number };
/** Dims everything except a rounded rect at (x,y,w,h). */
export type HighlightAction = ActionCommon & { type: 'highlight'; x: number; y: number; w: number; h: number };
/** Banner slides down from the top of the phone, holds, then slides back up. */
export type NotificationAction = ActionCommon & { type: 'notification'; title: string; body: string; iconAssetId?: string };
export type IconAnimAction = ActionCommon & { type: 'iconAnim'; x: number; y: number; builtIn: BuiltInIcon; anim: IconAnimKind };
/** Plays a Sprite (see below) by id over the current screen. */
export type SpriteAction = ActionCommon & { type: 'sprite'; spriteId: string };
export type SuccessCheckAction = ActionCommon & { type: 'successCheck'; x: number; y: number };
export type WaitAction = ActionCommon & { type: 'wait' };

export type Action =
  | LaunchAppAction
  | ShowScreenAction
  | LoadingAction
  | ScrollAction
  | TapAction
  | LongPressAction
  | SwipeAction
  | TypeTextAction
  | HighlightAction
  | NotificationAction
  | IconAnimAction
  | SpriteAction
  | SuccessCheckAction
  | WaitAction;

export type ActionType = Action['type'];

export type SpriteSource = { kind: 'asset'; assetId: string } | { kind: 'builtin'; name: BuiltInSprite };

/** Moves along a smooth Catmull-Rom path over the current screen when
 * played by a `sprite` action. `size` is normalized relative to the
 * device screen box's shorter side. */
export interface Sprite {
  id: string;
  source: SpriteSource;
  path: Point[];
  size: number;
  rotateAlongPath: boolean;
  easing: EasingName;
}

/** A manual-camera keyframe, anchored either to an absolute `time` (seconds
 * within the slide) or to the start of a given action. `target` is a
 * normalized (0-1, 0-1) focus point within the current screenshot. */
export type CameraKey = { target: Point; zoom: number; rotation?: number } & ({ time: number; actionId?: never } | { actionId: string; time?: never });

export interface StorySlide {
  kind: 'story';
  id: number;
  style: SlideStyle;
  screens: StoryScreen[];
  actions: Action[];
  sprites: Sprite[];
  cameraMode: 'auto' | 'manual';
  /** Only used when cameraMode === 'manual'. */
  cameraKeys: CameraKey[];
}

export type Slide = ImageSlide | TextSlide | StorySlide;

/** ImageSlide | TextSlide — the two "classic" single-screenshot slide kinds,
 * which share SlideBase's full field set (headline/dur/effect/etc). Used
 * where a function only ever operates on those two, never on a StorySlide. */
export type ClassicSlide = ImageSlide | TextSlide;

export interface IntroConfig {
  on: boolean;
  dur: number;
  tagline: string;
  style: SlideStyle;
}

export interface OutroConfig {
  on: boolean;
  dur: number;
  cta: string;
  button: string;
  small: string;
  style: SlideStyle;
}

/* ---------- project ---------- */

export interface Project {
  format: Format;
  /** index into PRESETS, or -1 if colors were customized away from any preset */
  preset: number;
  colors: Colors;
  /** index into FONTS */
  font: number;
  model: ModelKey;
  fcolor: FrameColorId;
  bgPattern: BgPattern;
  shapes: boolean;
  grain: boolean;
  vignette: boolean;
  storyBars: boolean;
  hlStyle: HlStyle;
  textPos: TextPos;
  textAnim: TextAnim;
  transition: Transition;
  appName: string;
  intro: IntroConfig;
  /** key into the AssetMap for the app icon; null uses the initial letter */
  iconAssetId: string | null;
  outro: OutroConfig;
  scenes: Slide[];
  quality: Quality;
  /** Audio is not consumed by render() — it belongs to the playback/export
   * layer built on top of the engine (see src/engine/audio/). Kept here so
   * Project is a complete, persistable model. `bpm` is known for music
   * library tracks (drives snap-to-beat in the story editor); absent for a
   * user's own uploaded file unless they set it. */
  music: { assetId: string; name: string; bpm?: number } | null;
  volume: number;
  /** Whether background music ducks (briefly lowers) under story-slide
   * sound effects during preview and export. */
  ducking: boolean;
}

/* ---------- timeline ---------- */

export type SegmentType = 'intro' | 'scene' | 'outro';

export interface Segment {
  type: SegmentType;
  owner: IntroConfig | OutroConfig | Slide;
  /** only present when type === 'scene' */
  scene?: Slide;
  start: number;
  dur: number;
  label: string;
}

export interface Timeline {
  list: Segment[];
  total: number;
}

/* ---------- text layout ---------- */

export interface TextToken {
  t: string;
  hi: boolean;
  w: number;
}

export interface TextLine {
  words: TextToken[];
  width: number;
}

export interface TextLayout {
  lines: TextLine[];
  space: number;
  lh: number;
  height: number;
  count: number;
  chars: number;
  size: number;
  font: string;
  weight: number;
}

/* ---------- device geometry ---------- */

export interface ScreenBox {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  /** browser model only: top chrome bar height */
  bar?: number;
}

export interface ImgRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The on-screen bounds of a slide's device/content, used to anchor effects
 * (confetti, sparkles, stickers) around it. */
export interface EffectBox {
  cx: number;
  cy: number;
  w: number;
  h: number;
  top: number;
}

/** Text layout region for a format/textPos combination (layout() in the prototype). */
export interface LayoutRegion {
  mode: 'stack' | 'side';
  edge: 'top' | 'bottom' | 'left' | 'right';
  textX: number;
  textY: number | null;
  textW: number;
  hSize: number;
  sSize: number;
  align: 'center' | 'left';
  PH: number;
  maxW: number;
  cx: number;
  cy: number;
}
