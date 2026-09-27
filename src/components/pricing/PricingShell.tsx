'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { getPaddle } from '@/lib/paddle/client';
import type { Pricing, PricingEntry } from '@/lib/paddle/catalog';

type Cycle = 'monthly' | 'yearly';

/** Fallback only — shown until Paddle's own PricePreview response arrives
 * (or if it fails). Once a preview exists for a price, that's what's
 * rendered instead, verbatim, since it's real localized/tax-aware
 * pricing this flat amount_cents can't reproduce client-side. */
function formatPrice(amountCents: number, currency: string): string {
  return `$${(amountCents / 100).toFixed(amountCents % 100 === 0 ? 0 : 2)} ${currency !== 'USD' ? currency : ''}`.trim();
}

export default function PricingShell({
  userId,
  userEmail,
  currentPlan,
  checkoutAvailable,
  pricing,
  hasLifetime,
  countryCode,
}: {
  userId: string | null;
  userEmail: string | null;
  currentPlan: 'free' | 'pro';
  checkoutAvailable: boolean;
  pricing: Pricing;
  hasLifetime: boolean;
  /** From the visitor's `x-vercel-ip-country` request header — `null` on
   * localhost or non-Vercel hosts, in which case Paddle's PricePreview is
   * asked with no address at all and falls back to its own IP geolocation.
   * Never a synthesized placeholder country. */
  countryCode: string | null;
}) {
  const router = useRouter();
  const [cycle, setCycle] = useState<Cycle>('monthly');
  const [starting, setStarting] = useState<'subscription' | 'lifetime' | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  // Paddle price id -> Paddle's own formatted total string (e.g. "$5.00" or
  // a localized equivalent). Rendered as-is, never re-formatted/re-computed
  // — no Intl.NumberFormat, no rounding, per Paddle's own guidance.
  const [previews, setPreviews] = useState<Record<string, string>>({});

  const proEntry = cycle === 'monthly' ? pricing.pro_monthly : pricing.pro_yearly;
  const lifetimeEntry = pricing.lifetime;

  useEffect(() => {
    if (!checkoutAvailable) return;
    const priceIds = [pricing.pro_monthly?.paddlePriceId, pricing.pro_yearly?.paddlePriceId, pricing.lifetime?.paddlePriceId].filter((id): id is string => !!id);
    if (priceIds.length === 0) return;

    let cancelled = false;
    void (async () => {
      try {
        const paddle = await getPaddle();
        if (!paddle || cancelled) return;
        const response = await paddle.PricePreview({
          items: priceIds.map((priceId) => ({ priceId, quantity: 1 })),
          address: countryCode ? { countryCode } : undefined,
        });
        if (cancelled) return;
        const next: Record<string, string> = {};
        for (const item of response.data.details.lineItems) next[item.price.id] = item.formattedTotals.total;
        setPreviews(next);
      } catch (err) {
        // Non-fatal — formatPrice()'s flat DB amount is still shown.
        console.error('[pricing] PricePreview failed:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [checkoutAvailable, countryCode, pricing.pro_monthly?.paddlePriceId, pricing.pro_yearly?.paddlePriceId, pricing.lifetime?.paddlePriceId]);

  const priceLabel = (entry: PricingEntry | null, suffix: string): string => {
    if (!entry) return 'Coming soon';
    const preview = previews[entry.paddlePriceId];
    return `${preview ?? formatPrice(entry.amountCents, entry.currency)}${suffix}`;
  };

  const openCheckout = async (priceId: string, which: 'subscription' | 'lifetime') => {
    if (!userId) {
      router.push('/login?next=/pricing');
      return;
    }
    setCheckoutError(null);
    setStarting(which);
    try {
      const paddle = await getPaddle();
      if (!paddle) return;
      paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        customData: { user_id: userId },
        customer: userEmail ? { email: userEmail } : undefined,
        settings: {
          displayMode: 'overlay',
          variant: 'one-page',
          successUrl: `${window.location.origin}/welcome`,
        },
      });
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Failed to open checkout.');
    } finally {
      setStarting(null);
    }
  };

  return (
    <main className="mx-auto max-w-[900px] px-4 py-12">
      <h1 className="text-center text-3xl font-bold">Pricing</h1>
      <p className="mt-2 text-center text-[15px] text-neutral-500 dark:text-neutral-400">Start free. Upgrade when you need more.</p>

      {checkoutError && <p className="mx-auto mt-4 max-w-105 rounded-xl bg-red-50 px-3 py-2 text-center text-[13px] text-red-700 dark:bg-red-500/10 dark:text-red-400">{checkoutError}</p>}

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

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-3xl border border-black/10 p-6 dark:border-white/10">
          <h2 className="text-lg font-bold">Free</h2>
          <p className="mt-1 text-[13.5px] text-neutral-500 dark:text-neutral-400">Try it out.</p>
          <p className="mt-4 text-2xl font-bold">$0</p>
          <ul className="mt-5 space-y-2 text-[14px]">
            <li>1 saved project</li>
            <li>Export up to 720p</li>
            <li>&quot;Made with Nimina&quot; watermark</li>
            <li>Core devices &amp; effects</li>
          </ul>
          {currentPlan === 'free' && <div className="mt-6 rounded-xl bg-neutral-100 px-3 py-2 text-center text-[13px] font-semibold dark:bg-neutral-800">Your current plan</div>}
        </div>

        <div className="rounded-3xl border-2 border-indigo-500 p-6">
          <h2 className="text-lg font-bold">Pro</h2>
          <p className="mt-1 text-[13.5px] text-neutral-500 dark:text-neutral-400">For shipping real launches.</p>
          <p className="mt-4 text-2xl font-bold">{priceLabel(proEntry, ` / ${cycle === 'monthly' ? 'mo' : 'yr'}`)}</p>
          <ul className="mt-5 space-y-2 text-[14px]">
            <li>Unlimited projects</li>
            <li>Export up to 4K</li>
            <li>No watermark</li>
            <li>All devices &amp; effects</li>
          </ul>
          {currentPlan === 'pro' ? (
            <div className="mt-6 rounded-xl bg-indigo-50 px-3 py-2 text-center text-[13px] font-semibold dark:bg-indigo-500/10">{hasLifetime ? 'Your current plan — lifetime access' : 'Your current plan'}</div>
          ) : checkoutAvailable && proEntry ? (
            <button onClick={() => openCheckout(proEntry.paddlePriceId, 'subscription')} disabled={!!starting} className="mt-6 w-full rounded-xl bg-indigo-600 px-4 py-2.5 font-bold text-white disabled:opacity-50">
              {starting === 'subscription' ? 'Opening checkout…' : `Upgrade — billed ${cycle}`}
            </button>
          ) : (
            <p className="mt-6 rounded-xl bg-neutral-100 px-3 py-2 text-center text-[12.5px] text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">{checkoutAvailable ? 'Pricing is being set up — check back soon.' : "Checkout isn't set up yet."}</p>
          )}
        </div>

        <div className="rounded-3xl border border-black/10 p-6 dark:border-white/10">
          <h2 className="text-lg font-bold">Lifetime</h2>
          <p className="mt-1 text-[13.5px] text-neutral-500 dark:text-neutral-400">Pay once, Pro forever.</p>
          <p className="mt-4 text-2xl font-bold">{priceLabel(lifetimeEntry, '')}</p>
          <ul className="mt-5 space-y-2 text-[14px]">
            <li>Everything in Pro</li>
            <li>One payment, no renewals</li>
            <li>Yours for good</li>
          </ul>
          {hasLifetime ? (
            <div className="mt-6 rounded-xl bg-indigo-50 px-3 py-2 text-center text-[13px] font-semibold dark:bg-indigo-500/10">Your current plan — lifetime access</div>
          ) : checkoutAvailable && lifetimeEntry ? (
            <button onClick={() => openCheckout(lifetimeEntry.paddlePriceId, 'lifetime')} disabled={!!starting} className="mt-6 w-full rounded-xl border border-black/10 px-4 py-2.5 font-bold disabled:opacity-50 dark:border-white/10">
              {starting === 'lifetime' ? 'Opening checkout…' : 'Buy lifetime access'}
            </button>
          ) : (
            <p className="mt-6 rounded-xl bg-neutral-100 px-3 py-2 text-center text-[12.5px] text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">{checkoutAvailable ? 'Pricing is being set up — check back soon.' : "Checkout isn't set up yet."}</p>
          )}
        </div>
      </div>
    </main>
  );
}
