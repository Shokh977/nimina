'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import UserMenu from '@/components/auth/UserMenu';
import type { EngineFormat } from '@/engine2/camera';
import { exportEngine2Video, type ExportV2Resolution } from '@/engine2/export';
import type { SceneProjectV2 } from '@/engine2/types';
import { isPro, PLAN_LIMITS, type Plan } from '@/lib/plan';
import { useEditorV2Store } from '@/store/editorV2Store';
import AddMenu from './AddMenu';
import Inspector from './Inspector';
import LayersPanel from './LayersPanel';
import Stage2, { type GizmoMode } from './Stage2';
import { buttonStyle, color, font, radius, space } from './tokens';
import TimelineV2 from './TimelineV2';
import { usePersistenceV2 } from './usePersistenceV2';

/** Rough measured cost of motion-blur export relative to no-blur, at the
 * same resolution — see the Tier-1 performance report: ~4-6x on real GPU
 * hardware (49s -> 196-280s for a 20s/1080p clip in testing). Shown to the
 * user before they commit to a multi-minute render, not baked in as a
 * promise — real time depends on scene complexity and hardware. */
const MOTION_BLUR_COST_MULTIPLIER = 5;

/** Resolution tiers ordered smallest-to-largest, for capping a request
 * against a plan's maximum — mirrors classic's useVideoExport.ts exactly. */
const RESOLUTION_RANK: Record<ExportV2Resolution, number> = { '720p': 0, '1080p': 1, '4k': 2 };

const FORMATS: EngineFormat[] = ['9:16', '1:1', '16:9'];

/**
 * The Engine v2 editor shell — layout rebuild: a standard three-zone
 * editor (left: layer tree; center: format switcher, canvas, transport,
 * timeline, docked as one scrollable unit; right: a single tabbed
 * inspector that follows selection — see Inspector.tsx) replacing the
 * earlier one-long-horizontal-strip-of-panels layout. Design tokens
 * (radii, spacing, type scale, accent hue) are shared with classic's
 * editor via tokens.ts, deliberately keeping v2's own dark surface rather
 * than adopting classic's light theme — see that file's doc comment for
 * the reasoning.
 *
 * A separate surface from the classic `/editor` (src/components/editor/)
 * — see editorV2Store.ts's header comment for why they don't share state.
 *
 * Infrastructure merge: real Supabase persistence (usePersistenceV2,
 * src/lib/supabase/projectsV2.ts — same `projects` table + RLS project
 * limit as classic) replacing the earlier localStorage-only
 * engine2Projects.ts, and real plan gating (resolution cap, watermark)
 * matching classic's exactly (src/lib/plan.ts).
 */
export default function EditorV2Shell({ userEmail, projectId, initialProject, plan }: { userEmail: string; projectId: string; initialProject: SceneProjectV2; plan: Plan }) {
  const project = useEditorV2Store((s) => s.project);
  const assets = useEditorV2Store((s) => s.assets);
  const setPlan = useEditorV2Store((s) => s.setPlan);
  const setFormat = useEditorV2Store((s) => s.setFormat);
  const canUndo = useEditorV2Store((s) => s.canUndo);
  const canRedo = useEditorV2Store((s) => s.canRedo);
  const undo = useEditorV2Store((s) => s.undo);
  const redo = useEditorV2Store((s) => s.redo);
  const playheadT = useEditorV2Store((s) => s.playheadT);
  const setPlayhead = useEditorV2Store((s) => s.setPlayhead);
  const music = useEditorV2Store((s) => s.music);
  const musicVolume = useEditorV2Store((s) => s.musicVolume);

  const [mode, setMode] = useState<GizmoMode>('translate');
  const [playing, setPlaying] = useState(false);
  const [exportState, setExportState] = useState<{ busy: boolean; progress: string; url?: string }>({ busy: false, progress: '' });
  const [exportResolution, setExportResolution] = useState<ExportV2Resolution>('1080p');
  const [exportMotionBlur, setExportMotionBlur] = useState(false);
  const lastFrameRef = useRef(0);
  // Playback loop's accumulator — see that effect's comment for why this
  // can't just read the `playheadT` React state inside the RAF closure.
  const playheadAccumRef = useRef(playheadT);

  const saveStatus = usePersistenceV2(projectId, initialProject);

  useEffect(() => {
    setPlan(plan);
  }, [plan, setPlan]);

  const estimatedExportSeconds = project ? Math.round(project.duration * (exportMotionBlur ? MOTION_BLUR_COST_MULTIPLIER : 1) * 2.5) : 0;

  const handleExport = async () => {
    if (!project || exportState.busy) return;
    setExportState({ busy: true, progress: 'Rendering…' });
    try {
      // Enforced here, not just disabled in the UI — last line of defense,
      // same caveat classic's useVideoExport.ts documents: export runs
      // entirely client-side, so this can't be a true security boundary,
      // but it does mean a free user can never actually get a
      // higher-than-720p file out of this code path regardless of how the
      // request got here.
      const maxResolution = PLAN_LIMITS[plan].maxExportResolution;
      const resolution = RESOLUTION_RANK[exportResolution] > RESOLUTION_RANK[maxResolution] ? maxResolution : exportResolution;
      const controller = new AbortController();
      const result = await exportEngine2Video(
        project,
        music?.buffer ?? null,
        { resolution, fps: 30, motionBlur: exportMotionBlur, musicVolume, watermark: !isPro(plan), assets },
        controller.signal,
        (done, total) => setExportState({ busy: true, progress: `Rendering ${done}/${total}` }),
      );
      const a = document.createElement('a');
      a.href = result.url;
      a.download = `${project.templateId || 'promo'}.mp4`;
      a.click();
      setExportState({ busy: false, progress: `Exported ${(result.sizeBytes / 1024).toFixed(0)} KB`, url: result.url });
    } catch (err) {
      setExportState({ busy: false, progress: err instanceof Error ? err.message : 'Export failed' });
    }
  };

  // Playback loop. Real bug fixed here: this used to read `playheadT`
  // (React state) directly inside the RAF closure while depending on
  // `[playing, project]` only — since `playheadT` wasn't a dependency, the
  // closure captured whatever value it held the instant Play was pressed
  // and never saw it change again, so every frame recomputed `next =
  // thatFrozenValue + thisFrame'sTinyDelta` — barely creeping forward from
  // the same frozen base instead of accumulating, which read as "stuck
  // near the start" or jittering, never actually playing. Fixed by driving
  // the accumulation from a ref (`playheadAccumRef`, mutated imperatively
  // every frame — the same pattern Stage2.tsx's own `playheadRef` and the
  // /dev/engine2 page's `tRef` already use correctly) instead of the state
  // value, and only calling setPlayhead() to sync React/the UI for display.
  useEffect(() => {
    if (!playing || !project) return;
    playheadAccumRef.current = playheadT;
    let raf = 0;
    lastFrameRef.current = performance.now();
    const loop = (now: number) => {
      const dt = (now - lastFrameRef.current) / 1000;
      lastFrameRef.current = now;
      const next = playheadAccumRef.current + dt;
      playheadAccumRef.current = next > project.duration ? 0 : next;
      setPlayhead(playheadAccumRef.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // playheadT intentionally excluded — see the comment above: reading it
    // fresh here is exactly the bug this fixes. Starting position is
    // captured once above when playback begins (or the project changes),
    // then the ref alone drives every subsequent frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, project]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const onScrub = useCallback(
    (v: number) => {
      // Keeps a mid-playback scrub from being overwritten on the very next
      // frame by the playback loop's own accumulator.
      playheadAccumRef.current = v;
      setPlayhead(v);
    },
    [setPlayhead],
  );

  if (!project) return <div style={{ color: color.textSecondary, padding: 24 }}>Loading…</div>;

  return (
    <div style={{ height: '100vh', background: color.bg, color: color.text, fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: space.md, padding: '10px 16px', borderBottom: `1px solid ${color.border}`, flexWrap: 'wrap', flex: 'none' }}>
        <Link href="/editor2" style={{ color: color.textSecondary, fontSize: font.md, textDecoration: 'none' }} title="Back to your projects">
          ←
        </Link>
        <strong style={{ fontSize: font.lg }}>Engine v2 Editor</strong>
        <button onClick={undo} disabled={!canUndo} style={buttonStyle(false, !canUndo)}>
          Undo
        </button>
        <button onClick={redo} disabled={!canRedo} style={buttonStyle(false, !canRedo)}>
          Redo
        </button>
        <AddMenu />
        <span style={{ fontSize: font.sm, opacity: 0.5 }}>{saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Save failed' : ''}</span>
        <select value={exportResolution} onChange={(e) => setExportResolution(e.target.value as ExportV2Resolution)} disabled={exportState.busy} style={{ ...buttonStyle(false, exportState.busy), padding: '5px 8px' }}>
          <option value="720p">720p</option>
          <option value="1080p" disabled={!isPro(plan)}>
            1080p{!isPro(plan) ? ' (Pro)' : ''}
          </option>
          <option value="4k" disabled={!isPro(plan)}>
            4K{!isPro(plan) ? ' (Pro)' : ''}
          </option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: font.sm, opacity: 0.8 }} title="Slower, smoother motion on fast moves — roughly 4-6x the render time of a normal export.">
          <input type="checkbox" checked={exportMotionBlur} disabled={exportState.busy} onChange={(e) => setExportMotionBlur(e.target.checked)} />
          Motion blur (slow, high quality)
        </label>
        <button onClick={handleExport} disabled={exportState.busy} style={buttonStyle(false, exportState.busy)}>
          {exportState.busy ? 'Exporting…' : 'Export MP4'}
        </button>
        <span style={{ fontSize: font.sm, opacity: 0.5 }}>{exportState.busy ? '' : `~${estimatedExportSeconds < 60 ? `${estimatedExportSeconds}s` : `${Math.round(estimatedExportSeconds / 60)} min`} estimated`}</span>
        {exportState.progress && <span style={{ fontSize: font.sm, opacity: 0.6 }}>{exportState.progress}</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: space.md }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['translate', 'scale', 'rotate'] as GizmoMode[]).map((m) => (
              <button key={m} onClick={() => setMode(m)} style={buttonStyle(mode === m)}>
                {m}
              </button>
            ))}
          </div>
          {userEmail && <UserMenu email={userEmail} />}
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* LEFT — layer tree */}
        <div style={{ width: 260, flex: 'none', borderRight: `1px solid ${color.border}`, padding: 16, overflowY: 'auto' }}>
          <LayersPanel />
        </div>

        {/* CENTER — format switcher, canvas, transport, timeline: one scrollable unit */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <div style={{ flex: 'none', padding: '16px 16px 0', display: 'flex', gap: space.sm }}>
            {FORMATS.map((f) => (
              <button key={f} onClick={() => setFormat(f)} style={buttonStyle(project.format === f || (!project.format && f === '9:16'))}>
                {f}
              </button>
            ))}
          </div>
          <div style={{ flex: 'none', padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: space.md }}>
            <Stage2 mode={mode} />
            <div style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
              <button onClick={() => setPlaying((p) => !p)} style={buttonStyle(false)}>
                {playing ? 'Pause' : 'Play'}
              </button>
              <input type="range" min={0} max={project.duration} step={0.01} value={playheadT} onChange={(e) => onScrub(Number(e.target.value))} style={{ width: 260 }} />
              <span style={{ fontSize: font.sm, opacity: 0.6, fontVariantNumeric: 'tabular-nums' }}>
                {playheadT.toFixed(2)}/{project.duration.toFixed(2)}s
              </span>
            </div>
          </div>
          <div style={{ flex: 'none', borderTop: `1px solid ${color.border}`, padding: 16 }}>
            <TimelineV2 />
          </div>
        </div>

        {/* RIGHT — single tabbed inspector, follows selection */}
        <div style={{ width: 320, flex: 'none', borderLeft: `1px solid ${color.border}`, minHeight: 0, background: color.surface, borderRadius: `${radius.xl}px 0 0 0` }}>
          <Inspector />
        </div>
      </div>
    </div>
  );
}
