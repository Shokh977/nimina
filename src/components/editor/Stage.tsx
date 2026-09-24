'use client';

import { FORMATS } from '@/engine/constants';
import { getTimeline } from '@/engine/render';
import { useEditorStore } from '@/store/editorStore';
import type { PlaybackEngine } from './usePlaybackEngine';
import Timeline from './Timeline';

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, '0')}`;
}

const FORMAT_KEYS = Object.keys(FORMATS) as Array<keyof typeof FORMATS>;

/** The preview canvas, transport controls, timeline scrubber, format
 * switcher and undo/redo — the left-hand "stage" panel from the prototype. */
export default function Stage({ engine }: { engine: PlaybackEngine }) {
  const project = useEditorStore((s) => s.project);
  const setFormat = useEditorStore((s) => s.setFormat);
  const canUndo = useEditorStore((s) => s.canUndo);
  const canRedo = useEditorStore((s) => s.canRedo);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);

  const { canvasRef, playing, displayT, total, togglePlay, seek } = engine;
  const { list: segments } = getTimeline(project);

  return (
    <section aria-label="Preview" className="rounded-3xl bg-[#1B1E26] p-4.5 text-[#E8EAF0] lg:sticky lg:top-3">
      <div className="flex h-[min(60vh,640px)] min-h-[300px] items-center justify-center">
        <canvas ref={canvasRef} className="block max-h-full max-w-full rounded-xl shadow-[0_24px_60px_rgba(0,0,0,.5)]" />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={togglePlay}
          aria-label={playing ? 'Pause' : 'Play'}
          className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-full bg-indigo-500 text-white"
        >
          {playing ? (
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]" aria-hidden>
              <rect x="5" y="4" width="5" height="16" rx="1.5" />
              <rect x="14" y="4" width="5" height="16" rx="1.5" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]" aria-hidden>
              <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" />
            </svg>
          )}
        </button>
        <div className="min-w-[92px] font-mono text-[13px] tabular-nums text-neutral-400">
          {formatTime(displayT)} / {formatTime(total)}
        </div>
        <Timeline project={project} segments={segments} total={total} t={displayT} onSeek={seek} />
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
        {FORMAT_KEYS.map((k) => (
          <button
            key={k}
            aria-pressed={project.format === k}
            onClick={() => setFormat(k)}
            className="rounded-full border border-neutral-600 px-3.5 py-1.5 text-[13px] font-semibold text-neutral-100 aria-pressed:border-neutral-100 aria-pressed:bg-neutral-100 aria-pressed:text-[#1B1E26]"
          >
            {k}
            <small className="ml-1 opacity-70">{FORMATS[k].name}</small>
          </button>
        ))}
        <div className="ml-auto flex gap-1.5">
          <button
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="rounded-full border border-neutral-600 px-3.5 py-1.5 text-[13px] font-semibold text-neutral-100 disabled:opacity-35"
          >
            Undo
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
            className="rounded-full border border-neutral-600 px-3.5 py-1.5 text-[13px] font-semibold text-neutral-100 disabled:opacity-35"
          >
            Redo
          </button>
        </div>
      </div>
    </section>
  );
}
