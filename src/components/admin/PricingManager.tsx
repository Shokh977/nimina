'use client';

import { useState } from 'react';

import type { Pricing, PricingEntry, PricingKey } from '@/lib/paddle/catalog';

const LABELS: Record<PricingKey, string> = {
  pro_monthly: 'Pro — monthly',
  pro_yearly: 'Pro — yearly',
  lifetime: 'Lifetime (one-time)',
};

function formatAmount(entry: PricingEntry): string {
  return `${(entry.amountCents / 100).toFixed(2)} ${entry.currency}`;
}

export default function PricingManager({ initialPricing }: { initialPricing: Pricing }) {
  const [pricing, setPricing] = useState(initialPricing);
  const [drafts, setDrafts] = useState<Record<PricingKey, string>>({ pro_monthly: '', pro_yearly: '', lifetime: '' });
  const [saving, setSaving] = useState<PricingKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async (key: PricingKey) => {
    const dollars = Number(drafts[key]);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setError('Enter a positive dollar amount, e.g. 5 or 4.99.');
      return;
    }
    const current = pricing[key];
    if (current && !confirm(`This creates a brand-new Paddle price at $${dollars.toFixed(2)} and switches new checkouts to it. The old $${(current.amountCents / 100).toFixed(2)} price stays untouched for anyone already on it. Continue?`)) {
      return;
    }

    setError(null);
    setSaving(key);
    try {
      const res = await fetch('/api/admin/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, amountCents: Math.round(dollars * 100), currency: 'USD' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save.');
      setPricing((p) => ({ ...p, [key]: json.entry }));
      setDrafts((d) => ({ ...d, [key]: '' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="mt-5 grid gap-3 max-w-[560px]">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:bg-red-500/10 dark:text-red-400">{error}</p>}

      {(['pro_monthly', 'pro_yearly', 'lifetime'] as const).map((key) => {
        const entry = pricing[key];
        return (
          <div key={key} className="rounded-xl border border-black/10 p-4 dark:border-white/10">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[14px] font-bold">{LABELS[key]}</span>
              <span className="text-[13px] text-neutral-500 dark:text-neutral-400">{entry ? `Current: $${formatAmount(entry)}` : 'Not set up yet'}</span>
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <span className="text-[13.5px] text-neutral-500 dark:text-neutral-400">$</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={drafts[key]}
                onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                placeholder={entry ? (entry.amountCents / 100).toFixed(2) : '0.00'}
                className="w-28 rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-[13.5px] dark:border-white/10 dark:bg-neutral-900"
              />
              <button onClick={() => save(key)} disabled={saving === key || !drafts[key]} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-50">
                {saving === key ? 'Creating price…' : entry ? 'Replace price' : 'Create price'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
