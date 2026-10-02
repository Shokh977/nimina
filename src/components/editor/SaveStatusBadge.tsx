'use client';

import { useEffect, useState } from 'react';

import { UPLOAD_ERROR_EVENT } from '@/lib/storage/assets';
import type { SaveStatus } from './usePersistence';

const LABEL: Record<SaveStatus, string> = {
  loading: 'Loading…',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed',
};

const PILL: Record<SaveStatus, string> = {
  loading: 'bg-white/[.06] text-[#9aa1af]',
  saving: 'bg-[#ffd166]/[.12] text-[#ffd166]',
  saved: 'bg-[#5ee6b5]/[.1] text-[#5ee6b5]',
  error: 'bg-[#ff7a59]/[.12] text-[#ff8f76]',
};

const DOT: Record<SaveStatus, string> = {
  loading: 'bg-[#9aa1af]',
  saving: 'bg-[#ffd166]',
  saved: 'bg-[#5ee6b5] home-pulse-dot',
  error: 'bg-[#ff8f76]',
};

/** Also shows a failed file upload (too large, wrong type, network) for a
 * few seconds — uploads run in the background, so this is the only place
 * the user would otherwise never hear about it. */
export default function SaveStatusBadge({ status }: { status: SaveStatus }) {
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onError = (e: Event) => {
      setUploadError((e as CustomEvent<string>).detail);
      clearTimeout(timer);
      timer = setTimeout(() => setUploadError(null), 10_000);
    };
    window.addEventListener(UPLOAD_ERROR_EVENT, onError);
    return () => {
      window.removeEventListener(UPLOAD_ERROR_EVENT, onError);
      clearTimeout(timer);
    };
  }, []);

  if (uploadError) {
    return (
      <span role="alert" title={uploadError} className={`flex max-w-[360px] items-center gap-1.5 truncate rounded-full px-[9px] py-1 text-[12.5px] font-medium ${PILL.error}`}>
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT.error}`} />
        <span className="truncate">Upload failed: {uploadError}</span>
      </span>
    );
  }

  return (
    <span className={`flex items-center gap-1.5 rounded-full px-[9px] py-1 text-[12.5px] font-medium ${PILL[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[status]}`} />
      {LABEL[status]}
    </span>
  );
}
