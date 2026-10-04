import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Plan } from '@/lib/plan';
import { createAdminClient } from '@/lib/supabase/admin';
import { AI_FEATURES, featureUsage, usedThisMonth, type AiFeature, type AiFeatureUsage } from './usage';

/**
 * Counts an AI use *before* the (slow, paid) model call, so several requests
 * fired at once can't all slip under the monthly limit: the use is recorded
 * first, then the count is checked; over the limit, the record is removed
 * and the request refused. A failed call gives the use back (releaseAiUse).
 * Deleting needs the service role — users can't delete their own events.
 */
export async function reserveAiUse(
  supabase: SupabaseClient,
  userId: string,
  feature: AiFeature,
  plan: Plan,
  meta: Record<string, unknown> = {},
): Promise<{ ok: true; id: string; usage: AiFeatureUsage } | { ok: false; usage: AiFeatureUsage }> {
  const before = await usedThisMonth(supabase, userId, feature);
  const pre = featureUsage(plan, feature, before);
  if (pre.left <= 0) return { ok: false, usage: pre };

  const { data, error } = await supabase.from('events').insert({ user_id: userId, type: AI_FEATURES[feature].event, meta }).select('id, created_at').single();
  if (error || !data) throw error ?? new Error('could not record AI use');
  // This use's place in the month: uses recorded before it (ties broken by
  // id), plus itself. Concurrent requests each get a distinct place, so
  // exactly the ones that fit under the limit go ahead.
  const { count } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', AI_FEATURES[feature].event)
    .gte('created_at', monthStartIso())
    .or(`created_at.lt."${data.created_at}",and(created_at.eq."${data.created_at}",id.lte.${data.id})`);
  const place = count ?? Number.POSITIVE_INFINITY;
  if (place > pre.limit) {
    await releaseAiUse(data.id);
    return { ok: false, usage: featureUsage(plan, feature, pre.limit) };
  }
  return { ok: true, id: data.id, usage: featureUsage(plan, feature, Math.max(place, await usedThisMonth(supabase, userId, feature))) };
}

function monthStartIso(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

/** Gives a reserved use back (the model call failed). */
export async function releaseAiUse(id: string): Promise<void> {
  const { error } = await createAdminClient().from('events').delete().eq('id', id);
  if (error) console.error('[ai] could not release a reserved use', id, error.message);
}

/** What to tell the user when the model call fails. Running out of API
 * credit is our problem, not theirs — say so, and log it loudly. */
export function aiFailureMessage(err: unknown, fallback: string): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (err instanceof Anthropic.APIError && /credit balance|billing|quota/i.test(msg)) {
    console.error('[ai] ANTHROPIC CREDIT EXHAUSTED — top up at console.anthropic.com (Billing).', msg);
    return 'AI features are temporarily unavailable. Please try again later — your use wasn’t counted.';
  }
  if (err instanceof Anthropic.APIError && (err.status === 429 || err.status === 529 || err.status === 503)) {
    return 'The AI service is busy right now. Please try again in a minute — your use wasn’t counted.';
  }
  return `${fallback} Your use wasn’t counted.`;
}

/** "You've used AI Director 30 times this month (limit 30 …)". */
export function limitMessage(label: string, usage: AiFeatureUsage, plan: Plan): string {
  if (usage.limit === 0) return `${label} is part of Pro.`;
  return `You've used ${label} ${usage.used} times this month (limit ${usage.limit} on the ${plan === 'pro' ? 'Pro' : 'Free'} plan). It resets on the 1st${plan === 'free' ? ', or upgrade to Pro for more' : ''}.`;
}
