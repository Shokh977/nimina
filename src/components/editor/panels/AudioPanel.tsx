'use client';

import { clipWindow, findClip } from '@/engine/audio/clips';
import { getTimeline } from '@/engine/render';
import { useEditorStore } from '@/store/editorStore';
import RangeInput from '../ui/RangeInput';
import SectionLabel from '../ui/SectionLabel';
import ToggleRow from '../ui/ToggleRow';

function mmss(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`;
}

/**
 * What the inspector shows in place of its tabs while an audio clip is
 * selected on the timeline: the clip's settings (Replace opens the music
 * drawer, MusicDrawer.tsx). Every value here can also be dragged on
 * the timeline; the sliders are the precise (and the phone's) way.
 */
export default function AudioPanel({ onClose, embedded = false }: { onClose?: () => void; /** Inside a titled sheet with its own close button: no header here. */ embedded?: boolean }) {
  const selection = useEditorStore((s) => s.audioSelection);
  const project = useEditorStore((s) => s.project);
  const buffers = useEditorStore((s) => s.assets.audio);
  const selectAudio = useEditorStore((s) => s.selectAudio);
  const updateAudioClip = useEditorStore((s) => s.updateAudioClip);
  const removeAudioClip = useEditorStore((s) => s.removeAudioClip);
  const setDucking = useEditorStore((s) => s.setDucking);
  const setMusicDrawerOpen = useEditorStore((s) => s.setMusicDrawerOpen);

  const clip = selection ? findClip(project, selection) : null;
  const close = () => {
    selectAudio(null);
    onClose?.();
  };

  const header = (title: string) =>
    embedded ? null : (
      <div className="mb-4 flex items-center gap-2">
        <button type="button" onClick={close} className="rounded-[8px] px-2 py-1 text-[12.5px] font-semibold text-[#9aa1af] hover:bg-white/[.06] hover:text-white" aria-label="Close the audio settings">
          ← Back
        </button>
        <h2 className="text-[14px] font-semibold text-[#f4f5f8]">{title}</h2>
      </div>
    );

  if (!clip) return null;

  const total = getTimeline(project).total;
  const buffer = buffers[clip.assetId];
  const fileLen = buffer?.duration;
  const w = clipWindow(clip, total, fileLen);
  const len = w.end - w.start;
  const set = updateAudioClip.bind(null, clip.id);

  return (
    <div className="grid grid-cols-1 gap-5">
      <div>
        {header('Music')}
        <div className="flex items-center gap-2 rounded-[10px] border border-white/[.08] bg-white/[.03] px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-semibold text-[#f4f5f8]">♪ {clip.name}</div>
            <div className="text-[11.5px] text-[#767e8d]">
              {fileLen !== undefined ? `${mmss(fileLen)} long` : 'Loading…'}
              {clip.bpm ? ` · ${clip.bpm} BPM` : ''}
            </div>
          </div>
          <button type="button" onClick={() => setMusicDrawerOpen(true)} className="shrink-0 text-[12.5px] font-semibold text-[#8b7dff] hover:text-[#a89bff]">
            Replace
          </button>
          <button type="button" onClick={() => removeAudioClip(clip.id)} className="shrink-0 text-[12.5px] font-semibold text-[#ff8f76] hover:text-[#ffb3a3]">
            Remove
          </button>
        </div>
      </div>

      <RangeInput min={0} max={1} step={0.05} value={clip.volume} onChange={(volume) => set({ volume })} label="Volume" valueLabel={`${Math.round(clip.volume * 100)}%`} />

      <div>
        <SectionLabel>Timing</SectionLabel>
        <div className="grid grid-cols-1 gap-4">
          <RangeInput
            min={0}
            max={Math.max(0, w.end - 0.5)}
            step={0.1}
            value={w.start}
            onChange={(start) =>
              set({
                start,
                sourceOffset: Math.max(0, clip.sourceOffset + (start - w.start)),
                ...(clip.duration === null ? {} : { duration: Math.max(0.5, w.end - start) }),
              })
            }
            label="Starts at"
            valueLabel={mmss(w.start)}
          />
          <RangeInput
            min={Math.min(total, w.start + 0.5)}
            max={total}
            step={0.1}
            value={w.end}
            onChange={(end) =>
              set({
                duration: end >= total - 0.05 ? null : Math.round((end - clip.start) * 100) / 100,
              })
            }
            label="Ends at"
            valueLabel={clip.duration === null && (clip.loop || fileLen === undefined || w.end >= total - 0.05) ? 'End of video' : mmss(w.end)}
          />
          {fileLen !== undefined && fileLen > 1 && (
            <RangeInput
              min={0}
              max={Math.max(0, Math.floor((fileLen - 0.5) * 10) / 10)}
              step={0.1}
              value={Math.min(clip.sourceOffset, fileLen)}
              onChange={(sourceOffset) => set({ sourceOffset })}
              label="Song starts from"
              valueLabel={mmss(clip.sourceOffset)}
            />
          )}
        </div>
        <p className="mt-2 text-[12px] leading-snug text-[#767e8d]">On the timeline: drag the music to pick which part of the song plays, drag its edges to trim, and drag the dots on top for fades.</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <RangeInput min={0} max={Math.min(10, Math.max(0, len - clip.fadeOut))} step={0.1} value={Math.min(clip.fadeIn, len)} onChange={(fadeIn) => set({ fadeIn })} label="Fade in" valueLabel={`${clip.fadeIn.toFixed(1)}s`} />
        <RangeInput min={0} max={Math.min(10, Math.max(0, len - clip.fadeIn))} step={0.1} value={Math.min(clip.fadeOut, len)} onChange={(fadeOut) => set({ fadeOut })} label="Fade out" valueLabel={`${clip.fadeOut.toFixed(1)}s`} />
      </div>

      <div className="grid grid-cols-1 gap-2.5">
        <ToggleRow title="Loop" sub="Repeat the song if it ends before the music does" checked={clip.loop} onChange={(loop) => set({ loop })} />
        <ToggleRow title="Duck under story sound effects" sub="Briefly lowers the music whenever a story action's SFX plays" checked={project.ducking} onChange={setDucking} />
      </div>
    </div>
  );
}
