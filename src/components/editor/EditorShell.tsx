'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { Project } from '@/engine/types';
import type { Plan } from '@/lib/plan';
import type { TemplateData } from '@/lib/supabase/templates';
import { useEditorStore } from '@/store/editorStore';
import TemplatePanel from '../admin/TemplatePanel';
import Header from './Header';
import { PlaybackProvider } from './PlaybackContext';
import ResizeHandle from './ResizeHandle';
import SlideRail from './SlideRail';
import Stage from './Stage';
import TransportBar from './TransportBar';
import { usePersistence, type SaveStatus } from './usePersistence';
import { usePlaybackEngine } from './usePlaybackEngine';
import { useTemplatePersistence } from './useTemplatePersistence';
import AiDirectorPanel from './panels/AiDirectorPanel';
import ExportPanel from './panels/ExportPanel';
import LookPanel from './panels/LookPanel';
import MotionPanel from './panels/MotionPanel';
import SlidesPanel from './panels/SlidesPanel';

// Loaded when the tab is first opened — keeps the localization UI out of
// the editor's initial bundle for projects that never use it.
const LanguagesPanel = dynamic(() => import('./panels/LanguagesPanel'));

const PROJECT_TABS = [
  { id: 'scenes', label: 'Slide' },
  { id: 'look', label: 'Look' },
  { id: 'motion', label: 'Motion' },
  { id: 'ai', label: 'AI Director' },
  { id: 'languages', label: 'Languages' },
  { id: 'export', label: 'Export' },
] as const;
const TEMPLATE_TABS = [
  { id: 'scenes', label: 'Slide' },
  { id: 'look', label: 'Look' },
  { id: 'motion', label: 'Motion' },
  { id: 'export', label: 'Export' },
  { id: 'template', label: 'Template' },
] as const;
type ProjectTabId = (typeof PROJECT_TABS)[number]['id'];
type TemplateTabId = (typeof TEMPLATE_TABS)[number]['id'];

const RAIL_MIN = 160;
const RAIL_MAX = 360;
const INSPECTOR_MIN = 260;
const INSPECTOR_MAX = 480;
const RAIL_WIDTH_KEY = 'promo-studio:editor-rail-width';
const INSPECTOR_WIDTH_KEY = 'promo-studio:editor-inspector-width';
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Normal, per-user project editing — the only mode that existed before the
 * admin Template Editor. */
export default function EditorShell({ userEmail, projectId, projectName, initialProject, plan }: { userEmail: string; projectId: string; projectName: string; initialProject: Project; plan: Plan }) {
  const [tab, setTab] = useState<ProjectTabId>('scenes');
  const saveStatus = usePersistence(projectId, initialProject);
  const setPlan = useEditorStore((s) => s.setPlan);
  useEffect(() => {
    setPlan(plan);
  }, [plan, setPlan]);

  return (
    <EditorShellBody userEmail={userEmail} projectName={projectName} saveStatus={saveStatus} onExportClick={() => setTab('export')}>
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-white/[.07] p-2 pb-0">
        {PROJECT_TABS.map((t) => (
          <TabButton key={t.id} active={tab === t.id} label={t.label} onClick={() => setTab(t.id)} />
        ))}
      </div>
      <div className="min-w-0 flex-1 overflow-y-auto p-4">
        {tab === 'scenes' && <SlidesPanel />}
        {tab === 'look' && <LookPanel />}
        {tab === 'motion' && <MotionPanel />}
        {tab === 'ai' && <AiDirectorPanel />}
        {tab === 'languages' && <LanguagesPanel />}
        {tab === 'export' && <ExportPanel />}
      </div>
    </EditorShellBody>
  );
}

/** Admin "editing a template" mode — same shell, different persistence
 * target (templates.data + template_versions instead of projects.data)
 * and an extra Template tab. No second editor built, per the spec. */
export function TemplateEditorShell({
  userEmail,
  templateId,
  templateName,
  initialProject,
  initialSlots,
  initialShortVariant,
  sampleAssetsSourceId,
}: {
  userEmail: string;
  templateId: string;
  templateName: string;
  initialProject: Project;
  initialSlots: TemplateData['slots'];
  initialShortVariant: TemplateData['shortVariant'];
  sampleAssetsSourceId: string | null;
}) {
  const [tab, setTab] = useState<TemplateTabId>('scenes');
  const saveStatus = useTemplatePersistence(templateId, initialProject, initialSlots, initialShortVariant, sampleAssetsSourceId);
  const setPlan = useEditorStore((s) => s.setPlan);
  useEffect(() => {
    // Template authoring shouldn't be limited by free-tier caps (watermark,
    // 720p export) — those gate a real user's plan, not master content.
    setPlan('pro');
  }, [setPlan]);

  return (
    <EditorShellBody userEmail={userEmail} projectName={templateName} saveStatus={saveStatus} onExportClick={() => setTab('export')}>
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-white/[.07] p-2 pb-0">
        {TEMPLATE_TABS.map((t) => (
          <TabButton key={t.id} active={tab === t.id} label={t.label} onClick={() => setTab(t.id)} />
        ))}
      </div>
      <div className="min-w-0 flex-1 overflow-y-auto p-4">
        {tab === 'scenes' && <SlidesPanel />}
        {tab === 'look' && <LookPanel />}
        {tab === 'motion' && <MotionPanel />}
        {tab === 'export' && <ExportPanel />}
        {tab === 'template' && <TemplatePanel templateId={templateId} sampleAssetsSourceId={sampleAssetsSourceId} />}
      </div>
    </EditorShellBody>
  );
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="flex-1 rounded-[9px] px-1.5 py-[9px] text-[13px] font-semibold whitespace-nowrap text-[#9aa1af] transition-colors duration-[.16s] aria-selected:bg-[#5b4bff]/[.18] aria-selected:text-[#cfc8ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]"
    >
      {label}
    </button>
  );
}

/** The fixed-height app shell: header (auto height) over a flex-1 row of
 * three columns (rail / stage+transport / inspector). Each column scrolls
 * inside itself — the page itself never scrolls. Shared by both modes
 * above; everything about *which* tabs/panels render is passed as
 * children, everything about the shell's own geometry lives here once.
 * Exported for dev harnesses that need the real shell without a saved
 * project behind it (src/app/dev/engine/localization). */
export function EditorShellBody({
  userEmail,
  projectName,
  saveStatus,
  onExportClick,
  children,
}: {
  userEmail: string;
  projectName: string;
  saveStatus: SaveStatus;
  onExportClick: () => void;
  children: React.ReactNode;
}) {
  const engine = usePlaybackEngine();
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);

  const [railWidth, setRailWidth] = useState(204);
  const [inspectorWidth, setInspectorWidth] = useState(316);
  const railStartRef = useRef(204);
  const inspectorStartRef = useRef(316);

  useEffect(() => {
    const storedRail = Number(window.localStorage.getItem(RAIL_WIDTH_KEY));
    const storedInspector = Number(window.localStorage.getItem(INSPECTOR_WIDTH_KEY));
    // One-time client-only read (localStorage isn't available during SSR).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (storedRail) setRailWidth(clamp(storedRail, RAIL_MIN, RAIL_MAX));
    if (storedInspector) setInspectorWidth(clamp(storedInspector, INSPECTOR_MIN, INSPECTOR_MAX));
  }, []);

  const onRailDragStart = () => {
    railStartRef.current = railWidth;
  };
  const onRailDrag = (deltaX: number) => {
    const next = clamp(railStartRef.current + deltaX, RAIL_MIN, RAIL_MAX);
    setRailWidth(next);
    window.localStorage.setItem(RAIL_WIDTH_KEY, String(next));
  };
  const onInspectorDragStart = () => {
    inspectorStartRef.current = inspectorWidth;
  };
  const onInspectorDrag = (deltaX: number) => {
    // The inspector sits to the right of its handle, so dragging right
    // (positive delta) shrinks it, not grows it.
    const next = clamp(inspectorStartRef.current - deltaX, INSPECTOR_MIN, INSPECTOR_MAX);
    setInspectorWidth(next);
    window.localStorage.setItem(INSPECTOR_WIDTH_KEY, String(next));
  };

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
      <div className="flex h-screen max-h-screen flex-col overflow-hidden bg-[#08090c] text-[#f4f5f8]">
        <Header userEmail={userEmail} projectName={projectName} saveStatus={saveStatus} engine={engine} onExportClick={onExportClick} />

        <div className="flex min-h-0 flex-1">
          <aside className="min-h-0 min-w-0 shrink-0 overflow-y-auto [scrollbar-gutter:stable]" style={{ width: railWidth }}>
            <SlideRail />
          </aside>

          <ResizeHandle label="Resize the slide rail" onDragStart={onRailDragStart} onDrag={onRailDrag} />

          <main className="flex min-h-0 min-w-0 flex-1 flex-col">
            <Stage engine={engine} />
            <TransportBar engine={engine} />
          </main>

          <ResizeHandle label="Resize the inspector" onDragStart={onInspectorDragStart} onDrag={onInspectorDrag} />

          <section className="flex min-h-0 min-w-0 shrink-0 flex-col" style={{ width: inspectorWidth }}>
            {children}
          </section>
        </div>
      </div>
    </PlaybackProvider>
  );
}
