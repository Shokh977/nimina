'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import UserMenu from '@/components/auth/UserMenu';
import type { Project } from '@/engine/types';
import type { Plan } from '@/lib/plan';
import { useEditorStore } from '@/store/editorStore';
import { PlaybackProvider } from './PlaybackContext';
import SaveStatusBadge from './SaveStatusBadge';
import Stage from './Stage';
import { usePersistence } from './usePersistence';
import { usePlaybackEngine } from './usePlaybackEngine';
import AiDirectorPanel from './panels/AiDirectorPanel';
import ExportPanel from './panels/ExportPanel';
import LookPanel from './panels/LookPanel';
import MotionPanel from './panels/MotionPanel';
import SlidesPanel from './panels/SlidesPanel';

const TABS = [
  { id: 'scenes', label: 'Slides' },
  { id: 'look', label: 'Look' },
  { id: 'motion', label: 'Motion' },
  { id: 'ai', label: 'AI Director' },
  { id: 'export', label: 'Export' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export default function EditorShell({
  userEmail,
  projectId,
  initialProject,
  plan,
}: {
  userEmail: string;
  projectId: string;
  initialProject: Project;
  plan: Plan;
}) {
  const [tab, setTab] = useState<TabId>('scenes');
  const engine = usePlaybackEngine();
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const setPlan = useEditorStore((s) => s.setPlan);
  const saveStatus = usePersistence(projectId, initialProject);

  useEffect(() => {
    setPlan(plan);
  }, [plan, setPlan]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inText = !!target?.closest('input[type=text],textarea');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !inText) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && !inText) {
        e.preventDefault();
        redo();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

  const playbackApi = useMemo(() => ({ seek: engine.seek, playFrom: engine.playFrom }), [engine.seek, engine.playFrom]);

  return (
    <PlaybackProvider value={playbackApi}>
      <div className="mx-auto flex max-w-[1340px] items-baseline justify-between gap-4 px-3 pt-5 sm:px-6">
        <div className="flex items-baseline gap-4">
          <Link href="/projects" className="text-lg font-bold hover:underline">
            Promo Studio
          </Link>
          <SaveStatusBadge status={saveStatus} />
        </div>
        {userEmail && <UserMenu email={userEmail} />}
      </div>
      {plan === 'free' && (
        <div className="mx-auto max-w-[1340px] px-3 pt-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-indigo-50 px-3.5 py-2.5 text-[13px] dark:bg-indigo-500/10">
            <span>You&apos;re on the Free plan — 1 project, 720p exports, and a watermark. Upgrade for unlimited projects, 4K, and no watermark.</span>
            <Link href="/pricing" className="font-bold text-indigo-600 hover:underline dark:text-indigo-400">
              Upgrade to Pro
            </Link>
          </div>
        </div>
      )}
      <div className="mx-auto grid max-w-[1340px] grid-cols-1 items-start gap-5 px-3 py-5 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <Stage engine={engine} />

        <section className="overflow-hidden rounded-3xl border border-black/10 bg-white dark:border-white/10 dark:bg-neutral-900">
          <div role="tablist" className="flex overflow-x-auto border-b border-black/10 px-2.5 dark:border-white/10">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className="-mb-px border-b-2 border-transparent px-3.5 py-3.5 pb-3 text-[15px] font-bold whitespace-nowrap text-neutral-500 aria-selected:border-indigo-500 aria-selected:text-neutral-900 dark:aria-selected:text-neutral-100"
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="p-4.5">
            {tab === 'scenes' && <SlidesPanel />}
            {tab === 'look' && <LookPanel />}
            {tab === 'motion' && <MotionPanel />}
            {tab === 'ai' && <AiDirectorPanel />}
            {tab === 'export' && <ExportPanel />}
          </div>
        </section>
      </div>
    </PlaybackProvider>
  );
}
