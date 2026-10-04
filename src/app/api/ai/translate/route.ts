import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

import { isAiDirectorConfigured } from '@/lib/ai/config';
import { runTranslate, TranslateRequestSchema } from '@/lib/ai/translate';
import { aiFailureMessage, limitMessage, releaseAiUse, reserveAiUse } from '@/lib/ai/reserve';
import type { Plan } from '@/lib/plan';
import { createClient } from '@/lib/supabase/server';

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
  const reservation = await reserveAiUse(supabase, user.id, 'translate', plan, { target: parsed.data.targetLocale, strings: parsed.data.strings.length });
  if (!reservation.ok) return NextResponse.json({ error: limitMessage('AI translation', reservation.usage, plan) }, { status: reservation.usage.limit === 0 ? 403 : 429 });

  try {
    const result = await runTranslate(process.env.ANTHROPIC_API_KEY!, parsed.data);
    return NextResponse.json({ ...result, usage: reservation.usage });
  } catch (err) {
    await releaseAiUse(reservation.id);
    if (err instanceof Anthropic.APIError) console.error(`[ai translate] API error ${err.status}`, err.message);
    else console.error('[ai translate] failed', err);
    // Our own validation errors (cut off, declined) are worth showing as they are.
    if (err instanceof Error && !(err instanceof Anthropic.APIError)) return NextResponse.json({ error: `${err.message} Your use wasn’t counted.` }, { status: 502 });
    return NextResponse.json({ error: aiFailureMessage(err, "Couldn't translate this time — try again.") }, { status: 502 });
  }
}
