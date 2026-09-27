/**
 * Static config data, ported 1:1 from legacy/promo-studio.html.
 * Values here must stay exactly in sync with the prototype — changing them
 * changes rendered output.
 */
import type {
  BgPattern,
  Camera,
  ColorPreset,
  CounterConfig,
  CutoutPreset,
  Effect,
  FontDef,
  Format,
  FormatDef,
  FrameColorDef,
  Gesture,
  HlStyle,
  ModelDef,
  ModelKey,
  Motion3DKey,
  Pose3D,
  PosePresetKey,
  SlideAnim,
  SlideLayout,
  TextAnim,
  Transition,
} from './types';

export const FORMATS: Record<Format, FormatDef> = {
  '9:16': { w: 1080, h: 1920, name: 'Vertical', use: 'Shorts, Reels, TikTok' },
  '1:1': { w: 1080, h: 1080, name: 'Square', use: 'Feed posts' },
  '16:9': { w: 1920, h: 1080, name: 'Wide', use: 'YouTube, websites' },
};

export const PRESETS: ColorPreset[] = [
  { name: 'Cobalt', a: '#3347FF', b: '#0C1662', text: '#FFFFFF', accent: '#FFD23F' },
  { name: 'Sherbet', a: '#FFA38F', b: '#E94B75', text: '#FFFFFF', accent: '#2B1A3D' },
  { name: 'Mint', a: '#DDF5E8', b: '#86D3AF', text: '#0F2A20', accent: '#0E7A52' },
  { name: 'Night', a: '#2B2F3A', b: '#0E1015', text: '#F3F4F7', accent: '#7CF0FF' },
  { name: 'Paper', a: '#F7F4EE', b: '#E0D8C8', text: '#1E1C19', accent: '#FF5A36' },
  { name: 'Grape', a: '#8B5CF6', b: '#3B0F7A', text: '#FFFFFF', accent: '#F9A8D4' },
  // Appended (not inserted) — Project.preset is a literal index into this
  // array, so anything above must keep its position. Added for the
  // Nimina Template Pack (docs/TEMPLATE_PACK.md §4).
  { name: 'Sunset', a: '#FF7A59', b: '#7A2BFF', text: '#FFFFFF', accent: '#FFE066' },
  { name: 'Midnight', a: '#0F1B3D', b: '#050912', text: '#F3F4FF', accent: '#7CF0FF' },
  { name: 'Candy', a: '#FFE3EC', b: '#FF6FB0', text: '#2A1030', accent: '#FF3E7F' },
  { name: 'Aurora', a: '#3EC5FF', b: '#8B5CF6', text: '#FFFFFF', accent: '#FFE066' },
];

export const FONTS: FontDef[] = [
  { name: 'Bricolage Grotesque', h: 800, s: 400, label: 'Bricolage' },
  { name: 'Syne', h: 800, s: 400, label: 'Syne' },
  { name: 'Space Grotesk', h: 700, s: 400, label: 'Space Grotesk' },
  { name: 'Fraunces', h: 700, s: 400, label: 'Fraunces' },
  { name: 'DM Serif Display', h: 400, s: 400, label: 'DM Serif' },
  { name: 'Figtree', h: 800, s: 500, label: 'Figtree' },
];

export const ANIMS: Array<[SlideAnim, string]> = [
  ['rise', 'Rise up'],
  ['pop', 'Pop in'],
  ['slide', 'Slide across'],
  ['swing', 'Swing in'],
  ['spotlight', 'Zoom to detail'],
];
export const CAMERAS: Array<[Camera, string]> = [
  ['none', 'Still'],
  ['push', 'Slow push in'],
  ['pull', 'Slow pull out'],
  ['drift', 'Drift sideways'],
  ['shake', 'Handheld'],
];
export const GESTURES: Array<[Gesture, string]> = [
  ['none', 'None'],
  ['tap', 'Tap'],
  ['swipeUp', 'Swipe up'],
  ['swipeLeft', 'Swipe left'],
];
export const LAYOUTS: Array<[SlideLayout, string]> = [
  ['single', 'Single device'],
  ['fan', 'Fan of three'],
];
export const MOTION3D: Array<[Motion3DKey, string]> = [
  ['none', 'Still'],
  ['turntable', 'Turntable'],
  ['swing', 'Swing in'],
  ['flip', 'Flip reveal'],
  ['unfold', 'Unfold'],
  ['handheld', 'Handheld'],
  ['orbit', 'Orbit'],
];
/** rx/ry/rz in degrees. `front`/`threeQL`/`threeQR`/`hero`/`flat` ported
 * directly from legacy/device-3d-lab-download.html's POSES object
 * (fov→distance, with `scale` folded in below since the prototype's fov
 * and scale are independent sliders but this engine folds "how big/far"
 * into one `scale` multiplier applied on top of a fixed reference
 * distance). `floating` is new (not in the prototype) — a gentle tilt
 * with a reduced scale, so the device reads as smaller/hovering rather
 * than posed against a surface. No static "Back" preset, per explicit
 * user feedback — the back of the device is still reachable dynamically
 * via the 'flip'/'unfold' motion presets (resolveMotion3d in
 * src/engine/pose3d.ts), just not offered as its own static pose. */
export const POSE_PRESETS: Record<PosePresetKey, { label: string } & Pose3D> = {
  front: { label: 'Front', rx: 0, ry: 0, rz: 0, distance: 2600, scale: 1 },
  threeQL: { label: '¾ left', rx: -8, ry: -26, rz: 3, distance: 2600, scale: 1 },
  threeQR: { label: '¾ right', rx: -8, ry: 26, rz: -3, distance: 2600, scale: 1 },
  hero: { label: 'Hero tilt', rx: -16, ry: -34, rz: 6, distance: 2600, scale: 1 },
  flat: { label: 'Lying flat', rx: 46, ry: -12, rz: -4, distance: 2600, scale: 1 },
  floating: { label: 'Floating', rx: -10, ry: -14, rz: 2, distance: 3400, scale: 0.82 },
};
export const EFFECTS: Array<[Effect, string]> = [
  ['none', 'None'],
  ['confetti', 'Confetti burst'],
  ['sparkles', 'Sparkles'],
  ['stickers', 'Emoji stickers'],
];
export const TEXT_ANIMS: Array<[TextAnim, string]> = [
  ['rise', 'Rise'],
  ['pop', 'Pop'],
  ['type', 'Typewriter'],
  ['slide', 'Slide'],
  ['letters', 'Letter drop'],
];
export const HL_STYLES: Array<[HlStyle, string]> = [
  ['marker', 'Marker'],
  ['color', 'Color'],
  ['underline', 'Underline'],
];
export const TRANSITIONS: Array<[Transition, string]> = [
  ['none', 'None'],
  ['wipe', 'Color wipe'],
  ['flash', 'Flash'],
  ['iris', 'Circle'],
  ['bars', 'Blinds'],
];
export const BG_PATTERNS: Array<[BgPattern, string]> = [
  ['glow', 'Glow'],
  ['grid', 'Grid'],
  ['dots', 'Dots'],
  ['rays', 'Rays'],
  ['waves', 'Waves'],
];

export const MODELS: Record<ModelKey, ModelDef> = {
  // t3d (device thickness, fraction of width) is only used by the 3D pose
  // renderer (drawDevice3D) — ported from legacy/device-3d-lab-download.html's
  // per-model `t` values (t/w), which only defined island/notch/android/tablet;
  // browser/card have no real-world "thickness" so use a thin nominal value
  // (just enough for a visible edge when tilted).
  island: { label: 'Island phone', ratio: 0.486, r: 0.165, bez: 0.04, sr: 0.125, cut: 'island', t3d: 0.1 },
  notch: { label: 'Notch phone', ratio: 0.486, r: 0.155, bez: 0.042, sr: 0.115, cut: 'notch', t3d: 0.104 },
  punch: { label: 'Android', ratio: 0.465, r: 0.11, bez: 0.032, sr: 0.085, cut: 'punch', t3d: 0.096 },
  tablet: { label: 'Tablet', ratio: 0.72, r: 0.075, bez: 0.05, sr: 0.035, cut: 'cam', t3d: 0.058 },
  browser: { label: 'Browser', ratio: 1.5, r: 0.03, bez: 0, sr: 0, cut: 'browser', t3d: 0.02 },
  card: { label: 'No frame', ratio: 0.486, r: 0.09, bez: 0, sr: 0.09, cut: 'none', t3d: 0.02 },
};

export const FCOLORS: FrameColorDef[] = [
  { id: 'graphite', label: 'Graphite', body: '#2A2C33', btn: '#1A1C21', edge: 'rgba(255,255,255,.12)', chrome: '#2A2D34', chromeInk: '#A9AFBC' },
  { id: 'silver', label: 'Silver', body: '#DADDE2', btn: '#B9BEC6', edge: 'rgba(255,255,255,.75)', chrome: '#F1F2F5', chromeInk: '#6B7180' },
  { id: 'titanium', label: 'Titanium', body: '#B9AF9F', btn: '#9C9282', edge: 'rgba(255,255,255,.4)', chrome: '#ECE7DE', chromeInk: '#6E665A' },
  { id: 'midnight', label: 'Midnight', body: '#1F2A44', btn: '#141C30', edge: 'rgba(255,255,255,.14)', chrome: '#243150', chromeInk: '#A7B3D1' },
  { id: 'rose', label: 'Rose', body: '#E6B5B0', btn: '#D19A94', edge: 'rgba(255,255,255,.55)', chrome: '#F7E4E1', chromeInk: '#8A5B57' },
  { id: 'theme', label: 'Theme' },
];

export const DURS = [2, 2.5, 3, 3.5, 4, 5, 6, 8];
export const TYPE_CPS = 34;
export const LETTER_STAGGER = 0.03;

/** Defaults applied to every newly-created slide, then overridden per field. */
export const SLIDE_DEFAULTS = {
  headline: 'Describe this *screen*',
  sub: '',
  anim: 'rise' as SlideAnim,
  dur: 3.5,
  focus: { x: 0.5, y: 0.4 },
  gesture: 'none' as Gesture,
  layout: 'single' as SlideLayout,
  badge: '',
  callout: '',
  camera: 'none' as Camera,
  effect: 'none' as Effect,
  stickers: '🔥⭐💯',
  scroll: false,
  counter: null as CounterConfig | null,
  hidden: false,
  pose3d: null as Pose3D | null,
  motion3d: 'none' as Motion3DKey,
};

/** Starting values when a user first enables a counter in the editor —
 * templates override every field as needed. */
export const DEFAULT_COUNTER: CounterConfig = {
  from: 0,
  to: 100,
  format: 'integer',
  currencySymbol: '$',
  decimals: 0,
  at: 0.3,
  duration: 1.2,
  easing: 'easeOutCubic',
  x: 0.5,
  y: 0.5,
};

export const CUTOUT_PRESETS: Array<[CutoutPreset, string]> = [
  ['liftOut', 'Lift out'],
  ['popReturn', 'Pop and return'],
  ['flyToSide', 'Fly to side'],
  ['zoomHero', 'Zoom hero'],
  ['stack', 'Stack'],
];
