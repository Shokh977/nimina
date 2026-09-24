/**
 * Sound-effect identifiers and per-action-type defaults. An action's
 * `sfx` field (see types.ts's ActionCommon) is `''` for "use this action
 * type's default sound", an explicit SfxId to override it, or `'none'` to
 * explicitly silence it — the same three-state pattern as SlideStyle's
 * "Default (...)" override fields (see styleFields.ts).
 */
import type { Action, ActionType, IconAnimKind } from '../types';

export type SfxId =
  | 'none'
  | 'tap'
  | 'longPress'
  | 'swipe'
  | 'type'
  | 'highlight'
  | 'notification'
  | 'success'
  | 'launch'
  | 'loading'
  | 'scroll'
  | 'iconRing'
  | 'iconBounce'
  | 'iconPulse'
  | 'iconPop'
  | 'sprite';

export const SFX_IDS: SfxId[] = ['tap', 'longPress', 'swipe', 'type', 'highlight', 'notification', 'success', 'launch', 'loading', 'scroll', 'iconRing', 'iconBounce', 'iconPulse', 'iconPop', 'sprite', 'none'];

export const DEFAULT_SFX_FOR_ACTION: Record<ActionType, SfxId> = {
  launchApp: 'launch',
  showScreen: 'none',
  loading: 'loading',
  scroll: 'scroll',
  tap: 'tap',
  longPress: 'longPress',
  swipe: 'swipe',
  typeText: 'type',
  highlight: 'highlight',
  notification: 'notification',
  iconAnim: 'iconPop',
  sprite: 'sprite',
  successCheck: 'success',
  wait: 'none',
};

/** For iconAnim, the animation kind picks a more specific default than the
 * blanket per-type table above. */
function defaultForIconAnim(anim: IconAnimKind): SfxId {
  if (anim === 'ring') return 'iconRing';
  if (anim === 'bounce') return 'iconBounce';
  if (anim === 'pulse') return 'iconPulse';
  return 'iconPop';
}

/** Resolves an action's actual sound: its own override, else the type's
 * (possibly animation-specific) default, else silence. */
export function resolveSfx(action: Action): SfxId {
  if (action.sfx && action.sfx !== '') return action.sfx as SfxId;
  if (action.type === 'iconAnim') return defaultForIconAnim(action.anim);
  return DEFAULT_SFX_FOR_ACTION[action.type];
}
