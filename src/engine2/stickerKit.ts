/**
 * Builds a sticker LayerDef with one of the three idle animations Prompt 7
 * asks for — "bob" and "wobble" are PropertyTrack.float (continuous
 * sinusoidal drift, the same mechanism every "nothing is fully static"
 * idle float in this engine already uses), "spin" is PropertyTrack.spin
 * (continuous one-directional rotation — MOTION_GUIDE.md's explicit
 * exception to springs-only). An *enter* animation is a separate, ordinary
 * concern: apply any Prompt-5 preset (pop/rise/scaleFromPoint all suit a
 * sticker) to the resulting layer the normal way, via
 * editorV2Store.applyPreset — not duplicated here.
 */
import { constTrack } from './types';
import type { ContentRef, LayerDef, LayerPlane, StickerIdle } from './types';

export interface CreateStickerOptions {
  id: string;
  label: string;
  content: ContentRef & { kind: 'sticker' };
  width: number;
  height: number;
  plane?: LayerPlane;
  idle?: StickerIdle;
  /** Phase offset (radians) for bob/wobble so multiple stickers don't move
   * in lockstep — MOTION_GUIDE.md: "randomized phase per element". */
  phase?: number;
}

export function createStickerLayer(opts: CreateStickerOptions): LayerDef {
  const transform: LayerDef['transform'] = {};
  const idle = opts.idle ?? 'none';
  if (idle === 'bob') {
    transform.y = { ...constTrack(0), float: { amp: 10, period: 2.1, phase: opts.phase ?? 0 } };
  } else if (idle === 'wobble') {
    transform.rz = { ...constTrack(0), float: { amp: 7, period: 1.7, phase: opts.phase ?? 0 } };
  } else if (idle === 'spin') {
    transform.rz = { ...constTrack(0), spin: 70 };
  }
  return {
    id: opts.id,
    label: opts.label,
    plane: opts.plane ?? 'popout',
    content: opts.content,
    width: opts.width,
    height: opts.height,
    overrides: {},
    transform,
  };
}
