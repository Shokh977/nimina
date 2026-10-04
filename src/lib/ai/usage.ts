import type { SupabaseClient } from '@supabase/supabase-js';

import { PLAN_LIMITS, type Plan } from '@/lib/plan';

/** The three AI features and the event each successful use logs. */
export const AI_FEATURES = {
  director: { event: 'ai_director_used', limitKey: 'maxAiDirectorUsesPerMonth', label: 'AI Director' },
  detect: { event: 'detect_elements_used', limitKey: 'maxElementDetectUsesPerMonth', label: 'Detect elements' },
  translate: { event: 'ai_translate_used', limitKey: 'maxTranslateUsesPerMonth', label: 'AI translation' },
} as const;
export type AiFeature = keyof typeof AI_FEATURES;

export interface AiFeatureUsage {
  used: number;
  limit: number;
  left: number;
}
export interface AiUsage {
  plan: Plan;
  /** When this month's counts start over (first of next month, UTC). */
  resetsAt: string;
  features: Record<AiFeature, AiFeatureUsage>;
}

/** Most strings one "Translate all" request may carry; longer lists are sent
 * in several requests, each counting as one use. */
export const MAX_TRANSLATE_STRINGS = 60;
/** Most screenshot slides one AI Director run looks at. */
export const MAX_DIRECTOR_SLIDES = 12;

function monthStart(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export async function userPlan(supabase: SupabaseClient, userId: string): Promise<Plan> {
  const { data } = await supabase.from('profiles').select('plan').eq('id', userId).maybeSingle();
  return data?.plan === 'pro' ? 'pro' : 'free';
}

/** Successful uses of one feature this calendar month (UTC). */
export async function usedThisMonth(supabase: SupabaseClient, userId: string, feature: AiFeature): Promise<number> {
  const { count } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', AI_FEATURES[feature].event)
    .gte('created_at', monthStart().toISOString());
  return count ?? 0;
}

export function featureUsage(plan: Plan, feature: AiFeature, used: number): AiFeatureUsage {
  const limit = PLAN_LIMITS[plan][AI_FEATURES[feature].limitKey];
  return { used, limit, left: Math.max(0, limit - used) };
}

export async function aiUsage(supabase: SupabaseClient, userId: string, plan?: Plan): Promise<AiUsage> {
  const p = plan ?? (await userPlan(supabase, userId));
  const keys = Object.keys(AI_FEATURES) as AiFeature[];
  const counts = await Promise.all(keys.map((k) => usedThisMonth(supabase, userId, k)));
  const now = new Date();
  return {
    plan: p,
    resetsAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString(),
    features: Object.fromEntries(keys.map((k, i) => [k, featureUsage(p, k, counts[i])])) as Record<AiFeature, AiFeatureUsage>,
  };
}
