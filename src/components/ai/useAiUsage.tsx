'use client';

import { useEffect, useState } from 'react';

import type { AiFeature, AiFeatureUsage, AiUsage } from '@/lib/ai/usage';

/**
 * This month's AI uses for the signed-in user, shared by every AI button:
 * loaded once from /api/ai/usage, then kept current from the `usage` each
 * AI response carries (reportAiUsage) — no polling.
 */
let cache: AiUsage | null = null;
let inflight: Promise<AiUsage | null> | null = null;
const EVENT = 'nimina:ai-usage';

function load(): Promise<AiUsage | null> {
  inflight ??= fetch('/api/ai/usage', { cache: 'no-store' })
    .then((r) => (r.ok ? (r.json() as Promise<AiUsage>) : null))
    .catch(() => null)
    .then((u) => {
      if (u) {
        cache = u;
        window.dispatchEvent(new Event(EVENT));
      }
      inflight = null;
      return u;
    });
  return inflight;
}

/** Call with the `usage` an AI response returned. */
export function reportAiUsage(feature: AiFeature, usage: AiFeatureUsage | undefined): void {
  if (!usage) return;
  if (cache) cache = { ...cache, features: { ...cache.features, [feature]: usage } };
  else void load();
  window.dispatchEvent(new Event(EVENT));
}

export function useAiUsage(): AiUsage | null {
  const [usage, setUsage] = useState<AiUsage | null>(cache);
  useEffect(() => {
    const on = () => setUsage(cache);
    window.addEventListener(EVENT, on);
    if (!cache) void load();
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return usage;
}

export function resetDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** "12 of 30 left this month · resets Nov 1" under an AI button. */
export function AiUsageNote({ feature, unit, className = '' }: { feature: AiFeature; unit: string; className?: string }) {
  const usage = useAiUsage();
  if (!usage) return null;
  const f = usage.features[feature];
  if (f.limit === 0) return <p className={`text-[12px] text-[#767e8d] ${className}`}>Part of Pro.</p>;
  const low = f.left <= Math.max(1, Math.round(f.limit * 0.1));
  return (
    <p data-ai-usage={feature} className={`text-[12px] ${f.left === 0 ? 'text-[#ff8f76]' : low ? 'text-[#ffd166]' : 'text-[#767e8d]'} ${className}`}>
      {f.left === 0 ? `No ${unit} left this month` : `${f.left} of ${f.limit} ${unit} left this month`} · resets {resetDate(usage.resetsAt)}
    </p>
  );
}

const LABELS: Record<AiFeature, [string, string]> = {
  director: ['AI Director', 'runs'],
  detect: ['Detect elements', 'detections'],
  translate: ['AI translation', 'translations'],
};

/** All three AI features as bars — for the account page. */
export function AiUsageBars() {
  const usage = useAiUsage();
  if (!usage) return <p className="text-[13px] text-[#767e8d]">Loading…</p>;
  return (
    <div className="grid gap-3.5">
      {(Object.keys(LABELS) as AiFeature[]).map((k) => {
        const f = usage.features[k];
        const pct = f.limit ? Math.min(100, (f.used / f.limit) * 100) : 0;
        return (
          <div key={k} className="text-[13px]">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold text-[#cfd3dc]">{LABELS[k][0]}</span>
              <span className="text-[#9aa1af]">{f.limit === 0 ? 'Part of Pro' : `${f.used} of ${f.limit} ${LABELS[k][1]} used · ${f.left} left`}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[.08]" role="progressbar" aria-label={`${LABELS[k][0]} used this month`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
              <div className={`h-full rounded-full ${f.left === 0 && f.limit ? 'bg-[#ff7a59]' : pct >= 80 ? 'bg-[#ffd166]' : 'bg-[#8b7dff]'}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
      <p className="text-[12px] text-[#767e8d]">Counts start over on {resetDate(usage.resetsAt)}.{usage.plan === 'free' ? ' Pro includes many more uses each month.' : ''}</p>
    </div>
  );
}
