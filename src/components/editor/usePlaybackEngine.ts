'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getSfxEvents, playableClips, playSfx, scheduleClip, type SfxEvent } from '@/engine/audio';
import { FORMATS } from '@/engine/constants';
import { withElementCollector, type ElementReport } from '@/engine/elements';
import { customFontsInUse } from '@/engine/customFonts';
import { ensureProjectFonts } from '@/engine/fonts';
import '@/components/customFontLoader';
import { localizeProject } from '@/engine/localization';
import { getTimeline, render } from '@/engine/render';
import '@/components/scriptFontLoader';
import { useEditorStore } from '@/store/editorStore';

export interface PlaybackEngine {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  playing: boolean;
  displayT: number;
  total: number;
  togglePlay: () => void;
  seek: (t: number) => void;
  playFrom: (t: number) => void;
  /** Called by Stage's ResizeObserver with the canvas's *measured* CSS
   * size (see the stage-box formula in Stage.tsx) — sets the canvas's CSS
   * width/height, its DPR-aware backing pixel size, and recomputes
   * scaleRef so render()'s scale parameter still means what it always has
   * ("backing pixels per project-space unit"), just computed from real
   * measurement instead of a fixed 0.5/0.6 constant. */
  setDisplaySize: (cssW: number, cssH: number) => void;
  /** Header's "Preview" button — temporarily renders without the free-plan
   * watermark so a free user can see what a paid export looks like.
   * Doesn't touch plan/export, purely a live-preview toggle. */
  previewNoWatermark: boolean;
  togglePreviewWatermark: () => void;
  /** The elements drawn in the current frame, with the segment they belong
   * to — what the canvas editor (CanvasEditor.tsx) selects and moves. */
  elements: FrameElements;
  /** Elements to leave out of the drawing (text being edited inline). */
  setHiddenElements: (keys: string[]) => void;
}

export interface FrameElements {
  owner: 'intro' | 'outro' | number | null;
  list: ElementReport[];
}

/**
 * Owns the preview canvas's render loop: reads `project`/`assets` from the
 * store, drives the engine's `render()` every animation frame, and exposes
 * play/pause/seek. Also owns live preview audio (background music + story
 * action sound effects, ducked and scheduled from src/engine/audio/) — kept
 * in the same hook as the visual loop because audio scheduling needs to
 * react to exactly the same play/pause/seek transitions the canvas loop
 * already tracks via tRef/playingRef. Kept out of the Zustand store on
 * purpose — playback time is ephemeral UI state, not part of the
 * serializable Project.
 */
export function usePlaybackEngine(): PlaybackEngine {
  const storeProject = useEditorStore((s) => s.project);
  const previewLocale = useEditorStore((s) => s.previewLocale);
  // The previewed language's copy (localization.ts) — the stage, playback
  // and audio all run off it; unchanged for single-language projects.
  const project = useMemo(() => localizeProject(storeProject, previewLocale), [storeProject, previewLocale]);
  const assets = useEditorStore((s) => s.assets);
  const plan = useEditorStore((s) => s.plan);

  // Mirrors of the latest store values for the rAF loop to read, so the
  // loop effect below can have an empty dependency array (run once) instead
  // of tearing down/restarting on every keystroke-driven project update.
  const projectRef = useRef(project);
  const assetsRef = useRef(assets);
  const planRef = useRef(plan);
  useEffect(() => {
    projectRef.current = project;
    assetsRef.current = assets;
    planRef.current = plan;
  }, [project, assets, plan]);

  // Non-Latin languages: fetch the script font for the text on screen (the
  // loop redraws every frame, so it appears as soon as it arrives).
  // Uploaded typefaces must be fetched before they can draw; script fonts
  // only matter for a localized preview.
  const customIds = customFontsInUse(project)
    .map((f) => f.id)
    .join(',');
  const fontText =
    project.renderLocale || customIds
      ? JSON.stringify([project.renderLocale?.locale, project.font, customIds, project.appName, project.scenes.map((s) => (s.kind === 'story' ? '' : s.headline + s.sub + s.badge + s.callout))])
      : '';
  useEffect(() => {
    if (fontText) void ensureProjectFonts(projectRef.current);
  }, [fontText]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tRef = useRef(0);
  const playingRef = useRef(false);
  const lastRef = useRef(0);
  const rafRef = useRef(0);
  const scaleRef = useRef(0.5);

  const [playing, setPlaying] = useState(false);
  const [displayT, setDisplayT] = useState(0);
  const [previewNoWatermark, setPreviewNoWatermark] = useState(false);
  const [elements, setElements] = useState<FrameElements>({ owner: null, list: [] });
  const elementsSigRef = useRef('');
  const hiddenRef = useRef<ReadonlySet<string> | null>(null);
  const setHiddenElements = useCallback((keys: string[]) => {
    hiddenRef.current = keys.length ? new Set(keys) : null;
  }, []);
  const previewNoWatermarkRef = useRef(false);
  const togglePreviewWatermark = useCallback(() => {
    setPreviewNoWatermark((v) => {
      previewNoWatermarkRef.current = !v;
      return !v;
    });
  }, []);

  const total = getTimeline(project).total;

  /* ---------- live preview audio ---------- */
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
  const sfxGainRef = useRef<GainNode | null>(null);
  const clipSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const scheduledAtProjectTRef = useRef(0);
  const lastRestartWallRef = useRef(0);

  const stopClipSources = useCallback(() => {
    for (const src of clipSourcesRef.current) {
      try {
        src.stop();
      } catch {
        // already stopped
      }
      src.disconnect();
    }
    clipSourcesRef.current = [];
  }, []);

  const ensureAudioGraph = useCallback((): AudioContext => {
    if (audioCtxRef.current) {
      void audioCtxRef.current.resume();
      return audioCtxRef.current;
    }
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = 1;
    const music = ctx.createGain();
    const sfx = ctx.createGain();
    sfx.gain.value = 0.9;
    music.connect(master);
    sfx.connect(master);
    audioCtxRef.current = ctx;
    masterGainRef.current = master;
    musicGainRef.current = music;
    sfxGainRef.current = sfx;
    return ctx;
  }, []);

  /** (Re)schedules music + every upcoming SFX event from project-time `t`
   * onward, replacing whatever was previously scheduled. Safe to call
   * repeatedly (on play, and again on a mid-playback seek). */
  const startAudioFrom = useCallback((t: number) => {
    const ctx = ensureAudioGraph();
    const music = musicGainRef.current!;
    const sfx = sfxGainRef.current!;
    const master = masterGainRef.current!;
    master.disconnect();
    master.connect(ctx.destination);

    stopClipSources();
    sfx.gain.cancelScheduledValues(ctx.currentTime);

    const proj = projectRef.current;
    const dur = getTimeline(proj).total;
    const events: SfxEvent[] = getSfxEvents(proj).filter((e) => e.time >= t);

    // Every timeline clip, from the playhead on — the same scheduling the
    // export uses (src/engine/audio/clips.ts).
    const now = ctx.currentTime;
    const duckUnder = proj.ducking ? events : [];
    for (const { clip, buffer } of playableClips(proj, assetsRef.current.audio)) {
      const src = scheduleClip(ctx, music, clip, buffer, { total: dur, from: t, at: (pt) => now + (pt - t), duckUnder });
      if (src) clipSourcesRef.current.push(src);
    }

    for (const e of events) {
      if (e.time > dur) continue;
      playSfx(ctx, sfx, e.id, ctx.currentTime + (e.time - t));
    }

    scheduledAtProjectTRef.current = t;
    lastRestartWallRef.current = performance.now();
  }, [ensureAudioGraph, stopClipSources]);

  const stopAudio = useCallback(() => {
    masterGainRef.current?.disconnect();
    stopClipSources();
  }, [stopClipSources]);

  // Stop and release audio on unmount.
  useEffect(() => stopAudio, [stopAudio]);

  // Editing audio while it plays (dragging a clip, a fade, the volume
  // slider, a file finishing loading) is heard straight away: reschedule
  // from the playhead, debounced so a drag doesn't restart it every frame.
  const audioSig = JSON.stringify([project.audio ?? null, project.ducking]);
  useEffect(() => {
    if (!playingRef.current) return;
    const id = setTimeout(() => {
      if (playingRef.current) startAudioFrom(tRef.current);
    }, 60);
    return () => clearTimeout(id);
  }, [audioSig, assets.audio, startAudioFrom]);

  // Canvas sizing is measured, not guessed — Stage's ResizeObserver calls
  // this with the actual available CSS box (see Stage.tsx's clamp/cap
  // formula) whenever the stage resizes or the aspect ratio changes.
  const setDisplaySize = useCallback((cssW: number, cssH: number) => {
    const canvas = canvasRef.current;
    if (!canvas || cssW <= 0 || cssH <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    const bw = Math.round(cssW * dpr);
    const bh = Math.round(cssH * dpr);
    if (canvas.width !== bw) canvas.width = bw;
    if (canvas.height !== bh) canvas.height = bh;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    scaleRef.current = bw / FORMATS[projectRef.current.format].w;
  }, []);

  // Keep the playhead in range if the project got shorter (e.g. a slide was
  // deleted while scrubbed past the new end).
  useEffect(() => {
    if (tRef.current > total) {
      tRef.current = total;
      setDisplayT(total);
    }
  }, [total]);

  useEffect(() => {
    const loop = (now: number) => {
      const reported: ElementReport[] = [];
      const canvas = canvasRef.current;
      const proj = projectRef.current;
      if (canvas) {
        if (playingRef.current) {
          const dt = (now - lastRef.current) / 1000;
          lastRef.current = now;
          const dur = getTimeline(proj).total;
          let next = tRef.current + dt;
          if (next >= dur) {
            next = dur;
            playingRef.current = false;
            setPlaying(false);
            stopAudio();
          }
          // A discontinuity here (bigger than normal playback drift) means
          // the timeline was dragged mid-playback (Timeline.tsx's scrub
          // doesn't pause first) — resync audio to the new position,
          // throttled so a fast drag doesn't restart the graph every frame.
          const expected = scheduledAtProjectTRef.current + (now - lastRestartWallRef.current) / 1000;
          if (Math.abs(next - expected) > 0.25 && now - lastRestartWallRef.current > 120) {
            startAudioFrom(next);
          }
          tRef.current = next;
          setDisplayT(next);
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          withElementCollector(
            (r) => reported.push(r),
            hiddenRef.current,
            () => render(ctx, proj, assetsRef.current.images, tRef.current, scaleRef.current, { watermark: planRef.current === 'free' && !previewNoWatermarkRef.current }),
          );
          // Publish only when something changed (the list is stable while
          // nothing is edited — boxes are rest positions, not animated).
          const { list } = getTimeline(proj);
          let idx = list.findIndex((g) => tRef.current >= g.start && tRef.current < g.start + g.dur);
          if (idx < 0) idx = list.length - 1;
          const seg = list[idx];
          const owner = !seg ? null : seg.type === 'intro' ? 'intro' : seg.type === 'outro' ? 'outro' : (seg.scene?.id ?? null);
          const sig = JSON.stringify([owner, reported]);
          if (sig !== elementsSigRef.current) {
            elementsSigRef.current = sig;
            setElements({ owner, list: reported });
          }
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [startAudioFrom, stopAudio]);

  const seek = useCallback((t: number) => {
    const dur = getTimeline(projectRef.current).total;
    tRef.current = Math.min(Math.max(t, 0), dur);
    setDisplayT(tRef.current);
  }, []);

  const playFrom = useCallback(
    (t: number) => {
      seek(t);
      lastRef.current = performance.now();
      playingRef.current = true;
      setPlaying(true);
      startAudioFrom(tRef.current);
    },
    [seek, startAudioFrom],
  );

  const togglePlay = useCallback(() => {
    setPlaying((p) => {
      const next = !p;
      if (next) {
        const dur = getTimeline(projectRef.current).total;
        if (tRef.current >= dur - 0.01) tRef.current = 0;
        lastRef.current = performance.now();
        playingRef.current = next;
        startAudioFrom(tRef.current);
      } else {
        playingRef.current = next;
        stopAudio();
      }
      return next;
    });
  }, [startAudioFrom, stopAudio]);

  return { canvasRef, playing, displayT, total, togglePlay, seek, playFrom, setDisplaySize, previewNoWatermark, togglePreviewWatermark, elements, setHiddenElements };
}
