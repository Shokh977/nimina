import type { Effect, ModelKey } from '@/engine/types';

export type Plan = 'free' | 'pro';

/**
 * Which devices/effects count as "core" (free) vs Pro-only. This is a
 * product judgment call, not something Prompt 5 specified exactly — chosen
 * as: the three phone-style frames + no-frame are core; tablet/browser
 * frames and the flashier effects are Pro. Adjust freely.
 */
export const PRO_ONLY_MODELS: ModelKey[] = ['tablet', 'browser'];
export const PRO_ONLY_EFFECTS: Effect[] = ['confetti', 'sparkles'];

export const PLAN_LIMITS = {
  free: {
    maxProjects: 1,
    maxExportResolution: '720p' as const,
    watermark: true,
    // AI Director calls a paid third-party API per use, unlike export
    // (client-side compute) — capped per plan per calendar month, another
    // product judgment call rather than something specified exactly.
    maxAiDirectorUsesPerMonth: 3,
    // Same reasoning as AI Director — "Detect elements" is its own paid
    // vision call, capped separately so a free user can't use one to
    // sidestep the other's limit.
    maxElementDetectUsesPerMonth: 5,
  },
  pro: {
    maxProjects: Infinity,
    maxExportResolution: '4k' as const,
    watermark: false,
    maxAiDirectorUsesPerMonth: 30,
    maxElementDetectUsesPerMonth: 50,
  },
} satisfies Record<
  Plan,
  { maxProjects: number; maxExportResolution: '720p' | '1080p' | '4k'; watermark: boolean; maxAiDirectorUsesPerMonth: number; maxElementDetectUsesPerMonth: number }
>;

export function isPro(plan: Plan): boolean {
  return plan === 'pro';
}

export function isModelAllowed(plan: Plan, model: ModelKey): boolean {
  return isPro(plan) || !PRO_ONLY_MODELS.includes(model);
}

export function isEffectAllowed(plan: Plan, effect: Effect): boolean {
  return isPro(plan) || !PRO_ONLY_EFFECTS.includes(effect);
}
