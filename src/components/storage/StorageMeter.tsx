'use client';

import { useEffect, useState } from 'react';

import { cachedUsage, fetchUsage, STORAGE_USAGE_EVENT, UPLOAD_ERROR_EVENT } from '@/lib/storage/assets';
import { formatBytes, type StorageUsage } from '@/lib/storage/rules';

export const NEAR_LIMIT = 0.8;

/**
 * "1.2 GB of 5 GB used" with a bar. Keeps itself current: it loads the
 * usage on mount and follows every change the storage helpers announce
 * (uploads, deleted/duplicated projects). When storage is full — or an
 * upload was just refused for space — it says what to do about it.
 */
export default function StorageMeter({
  initial,
  compact = false,
  onlyNearLimit = false,
  wrapperClassName = '',
}: {
  initial?: StorageUsage | null;
  compact?: boolean;
  /** Render nothing until usage reaches NEAR_LIMIT (or an upload was refused) —
   * for the editor and dashboard, where routine usage isn't worth the space.
   * The account page and the avatar menu always show it. */
  onlyNearLimit?: boolean;
  /** Classes for the outer box (so a hidden meter leaves no empty card). */
  wrapperClassName?: string;
}) {
  const [usage, setUsage] = useState<StorageUsage | null>(initial ?? cachedUsage());
  const [refused, setRefused] = useState(false);

  useEffect(() => {
    const onUsage = (e: Event) => setUsage((e as CustomEvent<StorageUsage>).detail);
    const onError = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (/of storage/.test(detail)) {
        setRefused(true);
        void fetchUsage(true);
      }
    };
    window.addEventListener(STORAGE_USAGE_EVENT, onUsage);
    window.addEventListener(UPLOAD_ERROR_EVENT, onError);
    if (!initial) void fetchUsage().catch(() => {});
    return () => {
      window.removeEventListener(STORAGE_USAGE_EVENT, onUsage);
      window.removeEventListener(UPLOAD_ERROR_EVENT, onError);
    };
  }, [initial]);

  if (!usage) return null;
  const pct = Math.min(100, (usage.used / usage.limit) * 100);
  const full = usage.used >= usage.limit * 0.98 || refused;
  const high = pct >= 80;
  if (onlyNearLimit && pct < NEAR_LIMIT * 100 && !full) return null;
  const bar = full ? 'bg-[#ff7a59]' : high ? 'bg-[#ffd166]' : 'bg-[#8b7dff]';

  return (
    <div className={`${compact ? 'text-[12px]' : 'text-[13px]'} ${wrapperClassName}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold text-[#cfd3dc]">Storage</span>
        <span className="text-[#9aa1af]">
          {formatBytes(usage.used)} of {formatBytes(usage.limit)} used
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[.08]" role="progressbar" aria-label="Storage used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.max(pct, usage.used > 0 ? 2 : 0)}%` }} />
      </div>
      {full && (
        <p className="mt-2 leading-snug text-[#ff8f76]">
          {refused ? 'Not enough space for that file. ' : 'Storage is full. '}
          <a href="/projects" className="font-semibold underline">
            Delete a project
          </a>{' '}
          you no longer need
          {usage.plan === 'free' ? (
            <>
              , or{' '}
              <a href="/pricing" className="font-semibold underline">
                upgrade to Pro
              </a>{' '}
              for 5 GB
            </>
          ) : null}
          .
        </p>
      )}
    </div>
  );
}
