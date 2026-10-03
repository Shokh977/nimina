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
    // Stored files (screenshots, icons, music, thumbnails) across all
    // projects, enforced server-side in /api/storage/upload via
    // public.reserve_storage (supabase/migrations/0019_storage_quota.sql).
    maxStorageBytes: 200 * 1024 * 1024,
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
    // Store-screenshot (still image) export: one store size per export, at
    // half its pixel dimensions (so not store-ready), watermarked, and no
    // Custom size. Same client-side caveat as video export (see CLAUDE.md
    // "Known limitation, by design").
    imageExport: { maxPresets: 1, scale: 0.5, customSize: false },
    // Localization: one language per project (its source) — adding a
    // second is Pro. AI translation is a paid third-party call per use,
    // capped monthly like AI Director.
    maxLanguages: 1,
    maxTranslateUsesPerMonth: 0,
  },
  pro: {
    maxStorageBytes: 5 * 1024 * 1024 * 1024,
    maxProjects: Infinity,
    maxExportResolution: '4k' as const,
    watermark: false,
    maxAiDirectorUsesPerMonth: 30,
    maxElementDetectUsesPerMonth: 50,
    imageExport: { maxPresets: Infinity, scale: 1, customSize: true },
    maxLanguages: Infinity,
    maxTranslateUsesPerMonth: 40,
  },
} satisfies Record<
  Plan,
  {
    maxStorageBytes: number;
    maxProjects: number;
    maxExportResolution: '720p' | '1080p' | '4k';
    watermark: boolean;
    maxAiDirectorUsesPerMonth: number;
    maxElementDetectUsesPerMonth: number;
    imageExport: { maxPresets: number; scale: number; customSize: boolean };
    maxLanguages: number;
    maxTranslateUsesPerMonth: number;
  }
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
