/**
 * UI metadata (labels, defaults) for the story-slide action inspector.
 * Lives in components/ (not src/engine/), same rationale as styleFields.ts:
 * presentation metadata, not rendering data the engine itself needs.
 */
import { resolveSfx, SFX_IDS, type SfxId } from '@/engine/audio';
import type { Action, ActionType, BuiltInIcon, BuiltInSprite, EasingName, IconAnimKind, LoadingStyle, ScreenTransition, TapPress } from '@/engine/types';

export const ACTION_TYPES: Array<[ActionType, string]> = [
  ['launchApp', 'Launch app'],
  ['showScreen', 'Show screen'],
  ['loading', 'Loading'],
  ['scroll', 'Scroll'],
  ['tap', 'Tap'],
  ['longPress', 'Long press'],
  ['swipe', 'Swipe'],
  ['typeText', 'Type text'],
  ['highlight', 'Highlight'],
  ['notification', 'Notification'],
  ['iconAnim', 'Icon animation'],
  ['sprite', 'Sprite'],
  ['successCheck', 'Success check'],
  ['wait', 'Wait'],
];

export const ACTION_LABELS: Record<ActionType, string> = Object.fromEntries(ACTION_TYPES) as Record<ActionType, string>;

export const SCREEN_TRANSITIONS: Array<[ScreenTransition, string]> = [
  ['fade', 'Fade'],
  ['push', 'Push'],
  ['modal', 'Modal (slide up)'],
  ['zoom', 'Zoom'],
  ['none', 'None (instant)'],
];

export const LOADING_STYLES: Array<[LoadingStyle, string]> = [
  ['spinner', 'Spinner'],
  ['skeleton', 'Skeleton'],
  ['splash', 'Splash logo'],
];

export const TAP_PRESSES: Array<[TapPress, string]> = [
  ['both', 'Ripple + press'],
  ['ripple', 'Ripple only'],
  ['press', 'Press only'],
];

export const BUILTIN_ICONS: Array<[BuiltInIcon, string]> = [
  ['bell', 'Bell'],
  ['heart', 'Heart'],
  ['cart', 'Cart'],
  ['check', 'Check'],
  ['star', 'Star'],
];

export const ICON_ANIMS: Array<[IconAnimKind, string]> = [
  ['ring', 'Ring'],
  ['bounce', 'Bounce'],
  ['pulse', 'Pulse'],
  ['pop', 'Pop'],
];

export const BUILTIN_SPRITES: Array<[BuiltInSprite, string]> = [
  ['scooter', 'Scooter'],
  ['car', 'Car'],
  ['bike', 'Bike'],
  ['pin', 'Pin'],
  ['bell', 'Bell'],
  ['heart', 'Heart'],
  ['cart', 'Cart'],
  ['pizza-box', 'Pizza box'],
];

export const EASINGS: Array<[EasingName, string]> = [
  ['linear', 'Linear'],
  ['easeOutCubic', 'Ease out'],
  ['easeInCubic', 'Ease in'],
  ['easeInOutCubic', 'Ease in-out'],
  ['easeOutBack', 'Ease out (bounce)'],
];

export const START_MODES: Array<['after-previous' | 'with-previous', string]> = [
  ['after-previous', 'After previous'],
  ['with-previous', 'With previous'],
];

const SFX_LABELS: Record<SfxId, string> = {
  none: 'None (silent)',
  tap: 'Tap',
  longPress: 'Long press',
  swipe: 'Swipe whoosh',
  type: 'Key click',
  highlight: 'Highlight chime',
  notification: 'Notification',
  success: 'Success chime',
  launch: 'Launch whoosh',
  loading: 'Loading blip',
  scroll: 'Scroll whoosh',
  iconRing: 'Ring',
  iconBounce: 'Bounce',
  iconPulse: 'Pulse',
  iconPop: 'Pop',
  sprite: 'Sprite whoosh',
};

/** '' (auto) plus every explicit SfxId, for an action's sound-effect select
 * — mirrors the style-override "Default (...)" pattern (see styleFields.ts). */
export function sfxOptionsFor(action: Action): Array<[string, string]> {
  const resolvedDefault = resolveSfx({ ...action, sfx: '' });
  return [['', `Default (${SFX_LABELS[resolvedDefault]})`], ...SFX_IDS.map((id): [string, string] => [id, SFX_LABELS[id]])];
}
