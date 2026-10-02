import { NextResponse } from 'next/server';

import type { Plan } from '@/lib/plan';
import { PLAN_LIMITS } from '@/lib/plan';
import { isAiDirectorConfigured } from '@/lib/ai/config';
import { runDirector, type DirectorImage } from '@/lib/ai/director';
import { DirectorRequestSchema } from '@/lib/ai/schema';
import { logEvent } from '@/lib/events';
import { isR2Configured, projectKey, r2 } from '@/lib/r2/server';
import { createClient } from '@/lib/supabase/server';

function startOfMonthIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function POST(request: Request) {
  if (!isAiDirectorConfigured()) {
    return NextResponse.json({ error: 'AI Director is not set up yet.' }, { status: 503 });
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
  const parsedRequest = DirectorRequestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return NextResponse.json({ error: 'Invalid request.', details: parsedRequest.error.flatten() }, { status: 400 });
  }
  const { projectId, goal, screenshots } = parsedRequest.data;

  const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle();
  const plan: Plan = profile?.plan === 'pro' ? 'pro' : 'free';

  const { count } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('type', 'ai_director_used')
    .gte('created_at', startOfMonthIso());
  const used = count ?? 0;
  const limit = PLAN_LIMITS[plan].maxAiDirectorUsesPerMonth;
  if (used >= limit) {
    return NextResponse.json({ error: `You've used AI Director ${used} times this month (limit ${limit} on the ${plan} plan). Try again next month${plan === 'free' ? ', or upgrade to Pro' : ''}.` }, { status: 429 });
  }

  // Keys are built from this user's own id — a screenshot asset id from
  // someone else's project simply won't resolve, there's no cross-account
  // read path here.
  let images: DirectorImage[];
  try {
    images = await Promise.all(
      screenshots.map(async ({ sceneId, assetId }): Promise<DirectorImage> => {
        if (!isR2Configured()) throw new Error('File storage is not configured');
        const store = r2();
        const res = await store.get(store.bucketName('private'), projectKey(user.id, projectId, assetId));
        if (!res.ok) throw new Error(`Couldn't fetch screenshot ${assetId}`);
        const contentType = res.headers.get('content-type') ?? '';
        const mediaType = contentType.includes('png') ? 'image/png' : contentType.includes('webp') ? 'image/webp' : contentType.includes('gif') ? 'image/gif' : 'image/jpeg';
        const buffer = Buffer.from(await res.arrayBuffer());
        return { sceneId, base64: buffer.toString('base64'), mediaType };
      }),
    );
  } catch (err) {
    console.error('[ai director] failed to load screenshots', err);
    return NextResponse.json({ error: "Couldn't load one of the screenshots to analyze." }, { status: 400 });
  }

  try {
    const result = await runDirector(process.env.ANTHROPIC_API_KEY!, goal, images);
    void logEvent(supabase, 'ai_director_used', { projectId, slideCount: result.slides.length });
    return NextResponse.json(result);
  } catch (err) {
    console.error('[ai director] request failed', err);
    return NextResponse.json({ error: "AI Director couldn't come up with suggestions this time — try again." }, { status: 502 });
  }
}
