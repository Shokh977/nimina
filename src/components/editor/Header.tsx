'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { createClient } from '@/lib/supabase/client';
import { useEditorStore } from '@/store/editorStore';
import SaveStatusBadge from './SaveStatusBadge';
import type { SaveStatus } from './usePersistence';
import type { PlaybackEngine } from './usePlaybackEngine';

export default function Header({
  userEmail,
  projectName,
  saveStatus,
  engine,
  onExportClick,
}: {
  userEmail: string;
  projectName: string;
  saveStatus: SaveStatus;
  engine: PlaybackEngine;
  onExportClick: () => void;
}) {
  const router = useRouter();
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.canUndo);
  const canRedo = useEditorStore((s) => s.canRedo);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="flex flex-wrap items-center gap-3.5 border-b border-white/[.07] bg-[#08090c]/90 px-5 py-3 backdrop-blur-[14px]">
      <Link href="/projects" className="flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element -- static SVG logo mark, no benefit from next/image's raster optimizer */}
        <img src="/brand/logo-mark-light.svg" alt="" className="h-6 w-6 shrink-0" />
        <span className="font-[family-name:var(--font-space-grotesk)] text-[15.5px] font-bold tracking-[-.01em] text-[#f4f5f8]">Nimina</span>
      </Link>

      <span className="h-5 w-px bg-white/10" />

      <span className="max-w-[200px] truncate text-[14.5px] font-semibold text-[#c9cdd8]" title={projectName}>
        {projectName || 'Untitled promo'}
      </span>
      <SaveStatusBadge status={saveStatus} />

      <div className="ml-auto flex items-center gap-1.5">
        <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo" className={GHOST_BTN}>
          ↺
        </button>
        <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo" className={GHOST_BTN}>
          ↻
        </button>
        <span className="mx-1 h-5 w-px bg-white/10" />
        <button
          onClick={engine.togglePreviewWatermark}
          aria-pressed={engine.previewNoWatermark}
          className="rounded-[10px] border border-white/[.16] bg-white/[.03] px-3.5 py-2 text-[13.5px] font-semibold text-[#f4f5f8] transition-colors duration-[.16s] hover:bg-white/[.08] aria-pressed:border-[#8b7dff]/60 aria-pressed:bg-[#5b4bff]/[.18] aria-pressed:text-[#cfc8ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]"
          title="Temporarily preview without the free-plan watermark"
        >
          Preview
        </button>
        <button
          onClick={onExportClick}
          className="rounded-[10px] bg-[#5b4bff] px-4 py-2 text-[13.5px] font-semibold text-white shadow-[0_10px_26px_rgba(91,75,255,.38)] transition-colors duration-[.16s] hover:bg-[#6d5eff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]"
        >
          Export
        </button>
        {userEmail && (
          <>
            <span className="hidden max-w-[160px] truncate text-[12.5px] text-[#767e8d] sm:inline" title={userEmail}>
              {userEmail}
            </span>
            <a
              href="/api/paddle/portal"
              className="rounded-[10px] border border-white/[.16] bg-white/[.03] px-3 py-2 text-[13px] font-semibold text-[#c9cdd8] transition-colors duration-[.16s] hover:bg-white/[.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]"
            >
              Manage subscription
            </a>
            <button onClick={signOut} className="rounded-[10px] border border-white/[.16] bg-white/[.03] px-3 py-2 text-[13px] font-semibold text-[#c9cdd8] transition-colors duration-[.16s] hover:bg-white/[.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]">
              Sign out
            </button>
          </>
        )}
      </div>
    </header>
  );
}

const GHOST_BTN =
  'grid h-9 w-9 place-items-center rounded-[10px] border border-white/[.12] bg-white/[.03] text-[15px] text-[#c9cdd8] transition-colors duration-[.16s] hover:bg-white/[.08] disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]';
