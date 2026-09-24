'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { FORMATS } from '@/engine/constants';
import { getTimeline, render } from '@/engine/render';
import type { AssetMap, Project } from '@/engine/types';
import { buildDemoProject } from '@/dev/sampleProject';
import { buildStoryDemoProject } from '@/dev/storyDemo';

const PREVIEW_SCALE = 0.5;
type DemoKind = 'classic' | 'story';

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, '0')}`;
}

/**
 * Temporary engine comparison page — not part of the production app.
 * Renders the same demo project the prototype boots with, so the ported
 * TypeScript engine (src/engine/) can be checked side by side with
 * legacy/promo-studio.html for identical output.
 */
export default function EngineDevPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const assetsRef = useRef<AssetMap>({});
  const tRef = useRef(0);
  const playingRef = useRef(false);
  const lastRef = useRef(0);
  const rafRef = useRef(0);

  const [project, setProject] = useState<Project | null>(null);
  const [playing, setPlaying] = useState(false);
  const [displayT, setDisplayT] = useState(0);
  const [demoKind, setDemoKind] = useState<DemoKind>('classic');
  const total = project ? getTimeline(project).total : 0;

  // Build the selected demo project client-side only (canvas/Image APIs
  // aren't available during server rendering), and whenever the tab changes.
  useEffect(() => {
    const { project: p, assets } = demoKind === 'story' ? buildStoryDemoProject() : buildDemoProject();
    assetsRef.current = assets;
    const canvas = canvasRef.current;
    if (canvas) {
      const fmt = FORMATS[p.format];
      canvas.width = Math.round(fmt.w * PREVIEW_SCALE);
      canvas.height = Math.round(fmt.h * PREVIEW_SCALE);
    }
    tRef.current = 0;
    playingRef.current = false;
    // One-time-per-tab client-only init: buildDemoProject()/buildStoryDemoProject()
    // need canvas/Image APIs, which don't exist during SSR, so this effect
    // *is* the data source, and switching tabs must reset playback state
    // synchronously with it (otherwise a stale scrub position could point
    // past the end of the newly-built project's timeline).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlaying(false);
    setDisplayT(0);
    setProject(p);
  }, [demoKind]);

  // Playback loop: renders every animation frame (simpler than the
  // prototype's dirty-flag optimization, fine for a dev-only comparison
  // page) so scrubbing, font-load snap-in, and playback all stay live.
  useEffect(() => {
    if (!project) return;
    const loop = (now: number) => {
      const canvas = canvasRef.current;
      if (canvas) {
        if (playingRef.current) {
          const dt = (now - lastRef.current) / 1000;
          lastRef.current = now;
          const dur = getTimeline(project).total;
          let next = tRef.current + dt;
          if (next >= dur) {
            next = dur;
            playingRef.current = false;
            setPlaying(false);
          }
          tRef.current = next;
          setDisplayT(next);
        }
        const ctx = canvas.getContext('2d');
        if (ctx) render(ctx, project, assetsRef.current, tRef.current, PREVIEW_SCALE);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [project]);

  const togglePlay = useCallback(() => {
    setPlaying((p) => {
      const next = !p;
      if (next) {
        if (tRef.current >= total - 0.01) tRef.current = 0;
        lastRef.current = performance.now();
      }
      playingRef.current = next;
      return next;
    });
  }, [total]);

  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    tRef.current = v;
    setDisplayT(v);
  }, []);

  const pauseForScrub = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
  }, []);

  return (
    <main className="min-h-full flex flex-col items-center gap-6 bg-neutral-950 px-4 py-10 text-neutral-100">
      <div className="text-center">
        <h1 className="text-xl font-semibold">Engine dev preview</h1>
        <p className="text-sm text-neutral-400">Compare against legacy/promo-studio.html — same demo project, ported TypeScript engine.</p>
      </div>

      <div className="flex gap-2 rounded-full bg-neutral-900 p-1">
        <button
          onClick={() => setDemoKind('classic')}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${demoKind === 'classic' ? 'bg-indigo-500 text-white' : 'text-neutral-400 hover:text-neutral-200'}`}
        >
          Classic slides
        </button>
        <button
          onClick={() => setDemoKind('story')}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${demoKind === 'story' ? 'bg-indigo-500 text-white' : 'text-neutral-400 hover:text-neutral-200'}`}
        >
          Story slide
        </button>
      </div>

      <div className="flex items-center justify-center rounded-2xl bg-black p-4 shadow-2xl">
        <canvas ref={canvasRef} className="block max-h-[70vh] w-auto rounded-xl" />
      </div>

      {!project ? (
        <p className="text-sm text-neutral-400">Building demo project…</p>
      ) : (
        <div className="flex w-full max-w-xl flex-col gap-2">
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-indigo-500 font-bold text-white"
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing ? '❚❚' : '▶'}
            </button>
            <span className="min-w-[100px] font-mono text-xs text-neutral-400">
              {formatTime(displayT)} / {formatTime(total)}
            </span>
            <input
              type="range"
              min={0}
              max={total || 0.0001}
              step={0.01}
              value={displayT}
              onChange={handleScrub}
              onPointerDown={pauseForScrub}
              className="flex-1 accent-indigo-500"
            />
          </div>
        </div>
      )}
    </main>
  );
}
