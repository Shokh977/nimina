import PricingManager from '@/components/admin/PricingManager';
import { getCurrentPricing } from '@/lib/paddle/catalog';
import { createClient } from '@/lib/supabase/server';

export default async function AdminPricingPage() {
  const supabase = await createClient();
  const pricing = await getCurrentPricing(supabase);

  return (
    <div>
      <h1 className="text-2xl font-bold">Pricing</h1>
      <p className="mt-1 text-[13.5px] text-neutral-500 dark:text-neutral-400">
        Setting an amount creates a real Paddle price and points new checkouts at it. Existing subscribers keep billing at whatever price they signed up under — Paddle prices can&apos;t be edited in place, only replaced.
      </p>
      <PricingManager initialPricing={pricing} />
    </div>
  );
}
