import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

import { isAiDirectorConfigured } from '@/lib/ai/config';
import { runTranslate, TranslateRequestSchema } from '@/lib/ai/translate';
import { featureUsage } from '@/lib/ai/usage';
import { logEvent } from '@/lib/events';
import { PLAN_LIMITS, type Plan } from '@/lib/plan';
import { createClient } from '@/lib/supabase/server';

function startOfMonthIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/**
 * "Translate all": translates a project's strings into one language and
 * returns them for review — nothing is applied server-side; the client
 * shows every change and applies only what the user accepts. Same auth /
 * plan-cap pattern as /api/ai/director (usage counted in `events`).
 */
export async function POST(request: Request) {
  if (!isAiDirectorConfigured()) {
    return NextResponse.json({ error: 'AI translation is not set up yet.' }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const parsed = TranslateRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.', details: parsed.error.flatten() }, { status: 400 });
  if (parsed.data.sourceLocale === parsed.data.targetLocale) return NextResponse.json({ error: 'Pick a language other than the source.' }, { status: 400 });

  const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle();
  const plan: Plan = profile?.plan === 'pro' ? 'pro' : 'free';
  const limit = PLAN_LIMITS[plan].maxTranslateUsesPerMonth;
  const { count } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('type', 'ai_translate_used')
    .gte('created_at', startOfMonthIso());
  const used = count ?? 0;
  if (used >= limit) {
    const error = limit === 0 ? 'AI translation is a Pro feature.' : `You've used AI translation ${used} times this month (limit ${limit}). Try again next month.`;
    return NextResponse.json({ error }, { status: limit === 0 ? 403 : 429 });
  }

  try {
    const result = await runTranslate(process.env.ANTHROPIC_API_KEY!, parsed.data);
    void logEvent(supabase, 'ai_translate_used', { target: parsed.data.targetLocale, strings: parsed.data.strings.length, missing: result.missing.length });
    return NextResponse.json({ ...result, usage: featureUsage(plan, 'translate', used + 1) });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return NextResponse.json({ error: 'The translation service is busy — try again in a minute.' }, { status: 503 });
    if (err instanceof Anthropic.APIError) console.error(`[ai translate] API error ${err.status}`, err.message);
    else console.error('[ai translate] failed', err);
    return NextResponse.json({ error: err instanceof Error && !(err instanceof Anthropic.APIError) ? err.message : "Couldn't translate this time — try again." }, { status: 502 });
  }
}
