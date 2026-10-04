import { NextResponse } from 'next/server';

import type { Plan } from '@/lib/plan';
import { isAiDirectorConfigured } from '@/lib/ai/config';
import { shrinkForAi } from '@/lib/ai/image';
import { aiFailureMessage, limitMessage, releaseAiUse, reserveAiUse } from '@/lib/ai/reserve';
import { runDirector, type DirectorImage } from '@/lib/ai/director';
import { DirectorRequestSchema } from '@/lib/ai/schema';
import { isR2Configured, projectKey, r2 } from '@/lib/r2/server';
import { createClient } from '@/lib/supabase/server';

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
        return { sceneId, ...(await shrinkForAi(Buffer.from(await res.arrayBuffer()))) };
      }),
    );
  } catch (err) {
    console.error('[ai director] failed to load screenshots', err);
    return NextResponse.json({ error: "Couldn't load one of the screenshots to analyze." }, { status: 400 });
  }

  const reservation = await reserveAiUse(supabase, user.id, 'director', plan, { projectId, slides: images.length });
  if (!reservation.ok) return NextResponse.json({ error: limitMessage('AI Director', reservation.usage, plan) }, { status: 429 });
  try {
    const result = await runDirector(process.env.ANTHROPIC_API_KEY!, goal, images);
    return NextResponse.json({ ...result, usage: reservation.usage });
  } catch (err) {
    await releaseAiUse(reservation.id);
    console.error('[ai director] request failed', err);
    return NextResponse.json({ error: aiFailureMessage(err, "AI Director couldn't come up with suggestions this time — try again.") }, { status: 502 });
  }
}
