'use client';

import { useRef, useState } from 'react';

import { useEditorStore } from '@/store/editorStore';
import { missingScreens, useScreenshots } from './useScreenshots';

/**
 * "3 screens need a screenshot — Add screenshots": pick several images at
 * once and they fill the empty phones in slide order. Shown in the slide
 * list whenever a slide has an empty phone (typically a template whose
 * slots weren't all filled).
 */
export default function FillScreensBanner({ compact = false }: { compact?: boolean }) {
  const project = useEditorStore((s) => s.project);
  const images = useEditorStore((s) => s.assets.images);
  const ready = useEditorStore((s) => s.assetsReady);
  const { fillMissing } = useScreenshots();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const count = missingScreens(project, images, ready).length;
  if (!count) return null;

  return (
    <div data-fill-screens className={`rounded-[11px] border border-[#ffd166]/35 bg-[#ffd166]/[.08] ${compact ? 'px-3 py-2' : 'mb-2.5 p-2.5'}`}>
      <p className="text-[12.5px] leading-snug text-[#ffe3a3]">
        {count === 1 ? '1 screen needs a screenshot' : `${count} screens need a screenshot`}
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="mt-1.5 w-full rounded-[9px] bg-[#ffd166] px-3 py-1.5 text-[12.5px] font-semibold text-[#1a1408] hover:bg-[#ffdc85] disabled:opacity-60"
      >
        {busy ? 'Adding…' : count === 1 ? 'Add screenshot' : 'Add screenshots'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          if (!files.length) return;
          setBusy(true);
          await fillMissing(files);
          setBusy(false);
        }}
      />
      {!compact && <p className="mt-1.5 text-[11.5px] leading-snug text-[#9aa1af]">Pick several at once — they fill the empty phones in slide order.</p>}
    </div>
  );
}
