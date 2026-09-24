import type { EasingName } from '../types';
import { easeInCubic, easeInOutCubic, easeOutBack, easeOutCubic } from '../utils';

const EASINGS: Record<EasingName, (x: number) => number> = {
  linear: (x) => x,
  easeOutCubic,
  easeInCubic,
  easeInOutCubic,
  easeOutBack,
};

export function resolveEasing(name: EasingName): (x: number) => number {
  return EASINGS[name] ?? EASINGS.easeInOutCubic;
}
