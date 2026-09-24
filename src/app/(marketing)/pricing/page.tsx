import { isPaddleConfigured } from '@/lib/paddle/config';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import PricingShell from '@/components/pricing/PricingShell';

export default async function PricingPage() {
  let userEmail: string | null = null;
  let userId: string | null = null;
  let plan: 'free' | 'pro' = 'free';

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
    }
  }

  return <PricingShell userId={userId} userEmail={userEmail} currentPlan={plan} checkoutAvailable={isPaddleConfigured()} />;
}
