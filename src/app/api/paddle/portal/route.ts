import { NextResponse } from 'next/server';

import { isPaddleConfigured } from '@/lib/paddle/config';
import { createPaddleClient } from '@/lib/paddle/server';
import { createClient } from '@/lib/supabase/server';

/** GET so it can be a plain link in the UI — redirects straight to Paddle's
 * hosted customer portal for the signed-in user's most recent subscription. */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

  if (!isPaddleConfigured()) {
    return NextResponse.redirect(`${origin}/pricing?error=${encodeURIComponent('Billing is not set up yet.')}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login?next=/api/paddle/portal`);

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('paddle_subscription_id, paddle_customer_id')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!subscription) {
    return NextResponse.redirect(`${origin}/pricing?error=${encodeURIComponent("You don't have a subscription yet.")}`);
  }

  try {
    const paddle = createPaddleClient();
    const session = await paddle.customerPortalSessions.create(subscription.paddle_customer_id, [subscription.paddle_subscription_id]);
    return NextResponse.redirect(session.urls.general.overview);
  } catch (err) {
    console.error('[paddle portal] failed to create session:', err);
    return NextResponse.redirect(`${origin}/pricing?error=${encodeURIComponent("Couldn't open the billing portal — try again shortly.")}`);
  }
}
