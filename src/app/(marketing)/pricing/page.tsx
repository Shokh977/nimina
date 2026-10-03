import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { isPaddleConfigured } from '@/lib/paddle/config';
import { getCurrentPricing } from '@/lib/paddle/catalog';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import PricingShell from '@/components/pricing/PricingShell';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Start free. Pro unlocks 4K video, every App Store and Google Play screenshot size, unlimited languages with AI translation, and no watermark.',
  alternates: { canonical: '/pricing' },
};

export default async function PricingPage() {
  let userEmail: string | null = null;
  let userId: string | null = null;
  let plan: 'free' | 'pro' = 'free';
  let hasLifetime = false;

  // Vercel sets this from the visitor's IP; absent locally and on other
  // hosts. Deliberately `null`, never an internal "unknown" placeholder —
  // PricingShell only forwards a country to Paddle's PricePreview when one
  // is genuinely known, letting Paddle fall back to its own IP-based
  // geolocation otherwise.
  const countryCode = (await headers()).get('x-vercel-ip-country');

  // Pricing itself is public — even a signed-out visitor needs to see it —
  // so it's read unconditionally, alongside (not after) who's signed in.
  const supabase = await createClient();
  const [pricing, user] = await Promise.all([getCurrentPricing(supabase), isSupabaseConfigured() ? supabase.auth.getUser().then((r) => r.data.user) : Promise.resolve(null)]);
  if (user) {
    userEmail = user.email ?? null;
    userId = user.id;
    const [{ data: profile }, { data: purchase }] = await Promise.all([
      supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle(),
      supabase.from('purchases').select('id').eq('user_id', user.id).limit(1).maybeSingle(),
    ]);
    if (profile?.plan === 'pro') plan = 'pro';
    hasLifetime = !!purchase;
  }

  return <PricingShell userId={userId} userEmail={userEmail} currentPlan={plan} checkoutAvailable={isPaddleConfigured()} pricing={pricing} hasLifetime={hasLifetime} countryCode={countryCode} />;
}
