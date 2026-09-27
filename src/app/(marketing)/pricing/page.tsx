import { headers } from 'next/headers';

import { isPaddleConfigured } from '@/lib/paddle/config';
import { getCurrentPricing } from '@/lib/paddle/catalog';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import PricingShell from '@/components/pricing/PricingShell';

export default async function PricingPage() {
  let userEmail: string | null = null;
  let userId: string | null = null;
  let plan: 'free' | 'pro' = 'free';
  let hasLifetime = false;

  // Pricing itself is public — even a signed-out visitor needs to see it —
  // so this is read unconditionally, not gated behind a signed-in check.
  const anonSupabase = await createClient();
  const pricing = await getCurrentPricing(anonSupabase);

  // Vercel sets this from the visitor's IP; absent locally and on other
  // hosts. Deliberately `null`, never an internal "unknown" placeholder —
  // PricingShell only forwards a country to Paddle's PricePreview when one
  // is genuinely known, letting Paddle fall back to its own IP-based
  // geolocation otherwise.
  const countryCode = (await headers()).get('x-vercel-ip-country');

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      userEmail = user.email ?? null;
      userId = user.id;
      const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle();
      if (profile?.plan === 'pro') plan = 'pro';
      const { data: purchase } = await supabase.from('purchases').select('id').eq('user_id', user.id).limit(1).maybeSingle();
      hasLifetime = !!purchase;
    }
  }

  return <PricingShell userId={userId} userEmail={userEmail} currentPlan={plan} checkoutAvailable={isPaddleConfigured()} pricing={pricing} hasLifetime={hasLifetime} countryCode={countryCode} />;
}
