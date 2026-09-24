'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { getPaddle } from '@/lib/paddle/client';
import { PRICE_IDS } from '@/lib/paddle/config';

type Cycle = 'monthly' | 'yearly';

export default function PricingShell({
  userId,
  userEmail,
  currentPlan,
  checkoutAvailable,
}: {
  userId: string | null;
  userEmail: string | null;
  currentPlan: 'free' | 'pro';
  checkoutAvailable: boolean;
}) {
  const router = useRouter();
  const [cycle, setCycle] = useState<Cycle>('monthly');
  const [starting, setStarting] = useState(false);

  const startCheckout = async () => {
    if (!userId) {
      router.push('/login?next=/pricing');
      return;
    }
    setStarting(true);
    try {
      const paddle = await getPaddle();
      if (!paddle) return;
      paddle.Checkout.open({
        items: [{ priceId: cycle === 'monthly' ? PRICE_IDS.monthly : PRICE_IDS.yearly, quantity: 1 }],
        customData: { user_id: userId },
        customer: userEmail ? { email: userEmail } : undefined,
      });
    } finally {
      setStarting(false);
    }
  };

  return (
    <main className="mx-auto max-w-[900px] px-4 py-12">
      <h1 className="text-center text-3xl font-bold">Pricing</h1>
      <p className="mt-2 text-center text-[15px] text-neutral-500 dark:text-neutral-400">Start free. Upgrade when you need more.</p>

      <div className="mt-8 flex justify-center">
        <div className="inline-flex rounded-full border border-black/10 p-1 dark:border-white/10">
          {(['monthly', 'yearly'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCycle(c)}
              aria-pressed={cycle === c}
              className="rounded-full px-4 py-1.5 text-[13.5px] font-semibold text-neutral-500 aria-pressed:bg-neutral-900 aria-pressed:text-white dark:text-neutral-400 dark:aria-pressed:bg-white dark:aria-pressed:text-neutral-900"
            >
              {c === 'monthly' ? 'Monthly' : 'Yearly'}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <div className="rounded-3xl border border-black/10 p-6 dark:border-white/10">
          <h2 className="text-lg font-bold">Free</h2>
          <p className="mt-1 text-[13.5px] text-neutral-500 dark:text-neutral-400">Try it out.</p>
          <ul className="mt-5 space-y-2 text-[14px]">
            <li>1 saved project</li>
            <li>Export up to 720p</li>
            <li>&quot;Made with Promo Studio&quot; watermark</li>
            <li>Core devices &amp; effects</li>
          </ul>
          {currentPlan === 'free' && <div className="mt-6 rounded-xl bg-neutral-100 px-3 py-2 text-center text-[13px] font-semibold dark:bg-neutral-800">Your current plan</div>}
        </div>

        <div className="rounded-3xl border-2 border-indigo-500 p-6">
          <h2 className="text-lg font-bold">Pro</h2>
          <p className="mt-1 text-[13.5px] text-neutral-500 dark:text-neutral-400">For shipping real launches.</p>
          <ul className="mt-5 space-y-2 text-[14px]">
            <li>Unlimited projects</li>
            <li>Export up to 4K</li>
            <li>No watermark</li>
            <li>All devices &amp; effects</li>
          </ul>
          {currentPlan === 'pro' ? (
            <div className="mt-6 rounded-xl bg-indigo-50 px-3 py-2 text-center text-[13px] font-semibold dark:bg-indigo-500/10">Your current plan</div>
          ) : checkoutAvailable ? (
            <button onClick={startCheckout} disabled={starting} className="mt-6 w-full rounded-xl bg-indigo-600 px-4 py-2.5 font-bold text-white disabled:opacity-50">
              {starting ? 'Opening checkout…' : `Upgrade — billed ${cycle}`}
            </button>
          ) : (
            <p className="mt-6 rounded-xl bg-neutral-100 px-3 py-2 text-center text-[12.5px] text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">Checkout isn&apos;t set up yet.</p>
          )}
          <p className="mt-2 text-center text-[11.5px] text-neutral-400">Final price shown at checkout.</p>
        </div>
      </div>
    </main>
  );
}
