'use client';

import { useEffect, useRef } from 'react';

export default function DeleteConfirmDialog({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    cardRef.current?.querySelector('button')?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onCancel}>
      <div
        ref={cardRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[380px] rounded-[18px] border border-white/[.08] bg-[#11131a] p-6 shadow-[0_26px_60px_rgba(0,0,0,.6)]"
      >
        <p id="delete-dialog-title" className="font-[family-name:var(--font-space-grotesk)] text-[17px] font-semibold text-[#f4f5f8]">
          Delete &ldquo;{name}&rdquo;?
        </p>
        <p className="mt-2 text-[14.5px] text-[#9aa1af]">This can&apos;t be undone.</p>
        <div className="mt-6 flex justify-end gap-2.5">
          <button
            onClick={onCancel}
            className="rounded-xl border border-white/[.16] bg-white/[.03] px-4 py-2.5 text-[13.5px] font-semibold text-[#f4f5f8] transition-colors hover:bg-white/[.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-xl border border-[#ff7a59]/[.28] bg-[#ff7a59]/[.07] px-4 py-2.5 text-[13.5px] font-semibold text-[#ff8f76] transition-colors hover:bg-[#ff7a59]/[.16] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]"
          >
            Delete project
          </button>
        </div>
      </div>
    </div>
  );
}
