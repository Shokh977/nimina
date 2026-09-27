'use client';

import { getTimeline } from '@/engine/render';
import { useEditorStore } from '@/store/editorStore';
import type { PlaybackEngine } from './usePlaybackEngine';
import SegmentedControl from './ui/SegmentedControl';
import Timeline from './Timeline';

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, '0')}`;
}

const FORMAT_OPTIONS: Array<['9:16' | '1:1' | '16:9', React.ReactNode]> = [
  ['9:16', <>9:16 <span className="font-normal text-[#767e8d]">Vertical</span></>],
  ['1:1', <>1:1 <span className="font-normal text-[#767e8d]">Square</span></>],
  ['16:9', <>16:9 <span className="font-normal text-[#767e8d]">Wide</span></>],
];

export default function TransportBar({ engine }: { engine: PlaybackEngine }) {
  const project = useEditorStore((s) => s.project);
  const setFormat = useEditorStore((s) => s.setFormat);
  const { playing, displayT, total, togglePlay, seek } = engine;
  const { list: segments } = getTimeline(project);

  return (
    <div className="flex flex-col gap-3 border-t border-white/[.07] bg-[#0a0b10] px-[18px] pt-3 pb-4">
      <div className="flex flex-wrap items-center gap-3.5">
        <button
          onClick={togglePlay}
          aria-label={playing ? 'Pause' : 'Play'}
          className="grid h-[42px] w-[42px] flex-none place-items-center rounded-full bg-[#5b4bff] text-white shadow-[0_10px_26px_rgba(91,75,255,.4)] transition-colors duration-[.16s] hover:bg-[#6d5eff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]"
        >
          {playing ? (
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-[16px] w-[16px]" aria-hidden>
              <rect x="5" y="4" width="5" height="16" rx="1.5" />
              <rect x="14" y="4" width="5" height="16" rx="1.5" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-[16px] w-[16px]" aria-hidden>
              <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" />
            </svg>
          )}
        </button>
        <div className="font-[family-name:var(--font-space-grotesk)] text-[13px] text-[#9aa1af] tabular-nums">
          {formatTime(displayT)} / {formatTime(total)}
        </div>
        <div className="ml-auto">
          <SegmentedControl options={FORMAT_OPTIONS as Array<[typeof project.format, React.ReactNode]>} value={project.format} onChange={setFormat} />
        </div>
      </div>

      <Timeline project={project} segments={segments} total={total} t={displayT} onSeek={seek} />
    </div>
  );
}
