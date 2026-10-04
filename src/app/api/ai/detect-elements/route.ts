import { NextResponse } from 'next/server';

import { isAiDirectorConfigured } from '@/lib/ai/config';
import { shrinkForAi } from '@/lib/ai/image';
import { aiFailureMessage, limitMessage, releaseAiUse, reserveAiUse } from '@/lib/ai/reserve';
import { runElementDetector } from '@/lib/ai/elementDetector';
import { DetectElementsRequestSchema } from '@/lib/ai/schema';
import type { Plan } from '@/lib/plan';
import { isR2Configured, projectKey, r2 } from '@/lib/r2/server';
import { createClient } from '@/lib/supabase/server';

/** "Detect elements" — Claude-with-vision bounding boxes for buttons/cards/
 * list items/bubbles on one screenshot, shown as clickable cutout
 * suggestions (Prompt 3). Same shape as /api/ai/director's route: reuses
 * ANTHROPIC_API_KEY, the same signed-URL screenshot fetch, and its own
 * separate monthly usage cap (src/lib/plan.ts's maxElementDetectUsesPerMonth). */
export async function POST(request: Request) {
  if (!isAiDirectorConfigured()) {
    return NextResponse.json({ error: 'AI features are not set up yet.' }, { status: 503 });
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
  const parsedRequest = DetectElementsRequestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return NextResponse.json({ error: 'Invalid request.', details: parsedRequest.error.flatten() }, { status: 400 });
  }
  const { projectId, assetId } = parsedRequest.data;

  const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle();
  const plan: Plan = profile?.plan === 'pro' ? 'pro' : 'free';


  let base64: string;
  let mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
  try {
    // The key is built from this user's own id — an asset id from someone
    // else's project simply won't resolve.
    if (!isR2Configured()) throw new Error('File storage is not configured');
    const store = r2();
    const res = await store.get(store.bucketName('private'), projectKey(user.id, projectId, assetId));
    if (!res.ok) throw new Error("Couldn't fetch the screenshot");
    ({ base64, mediaType } = await shrinkForAi(Buffer.from(await res.arrayBuffer())));
  } catch (err) {
    console.error('[detect elements] failed to load screenshot', err);
    return NextResponse.json({ error: "Couldn't load the screenshot to analyze." }, { status: 400 });
  }

  const reservation = await reserveAiUse(supabase, user.id, 'detect', plan, { projectId });
  if (!reservation.ok) return NextResponse.json({ error: limitMessage('Detect elements', reservation.usage, plan) }, { status: 429 });
  try {
    const result = await runElementDetector(process.env.ANTHROPIC_API_KEY!, base64, mediaType);
    return NextResponse.json({ ...result, usage: reservation.usage });
  } catch (err) {
    await releaseAiUse(reservation.id);
    console.error('[detect elements] request failed', err);
    return NextResponse.json({ error: aiFailureMessage(err, "Couldn't detect elements this time — try again.") }, { status: 502 });
  }
}
