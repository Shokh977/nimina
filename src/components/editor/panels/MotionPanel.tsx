'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { TEXT_ANIMS, TRANSITIONS } from '@/engine/constants';
import type { TextAnim, Transition } from '@/engine/types';
import { newAssetId } from '@/lib/assetSrc';
import { createClient } from '@/lib/supabase/client';
import { getMusicLibraryUrl, listMusicLibrary, type MusicLibraryTrack } from '@/lib/supabase/musicLibrary';
import { uploadAsset } from '@/lib/storage/assets';
import { useEditorStore } from '@/store/editorStore';
import Details from '../ui/Details';
import RangeInput from '../ui/RangeInput';
import SectionLabel from '../ui/SectionLabel';
import SegButtons from '../ui/SegButtons';
import SelectableRow from '../ui/SelectableRow';
import ToggleRow from '../ui/ToggleRow';

let sharedAudioCtx: AudioContext | null = null;
function getAudioContext(): AudioContext {
  if (!sharedAudioCtx) sharedAudioCtx = new AudioContext();
  return sharedAudioCtx;
}

// A curated shortcut that sets textAnim + transition together — not a
// replacement for them (both stay independently adjustable in Advanced
// below), since not every existing combination maps to a single named
// preset.
const MOTION_PRESETS: Array<{ id: string; title: string; description: string; textAnim: TextAnim; transition: Transition }> = [
  { id: 'smooth', title: 'Smooth', description: 'Gentle rise-ins with a soft color wipe between slides.', textAnim: 'rise', transition: 'wipe' },
  { id: 'punchy', title: 'Punchy', description: 'Bouncy pop-ins with a bright flash cut.', textAnim: 'pop', transition: 'flash' },
  { id: 'cinematic', title: 'Cinematic', description: 'Letter-by-letter reveals with a blinds transition.', textAnim: 'letters', transition: 'bars' },
  { id: 'snappy', title: 'Snappy', description: 'Quick slide-ins with a circular reveal.', textAnim: 'slide', transition: 'iris' },
];

export default function MotionPanel() {
  const project = useEditorStore((s) => s.project);
  const projectId = useEditorStore((s) => s.projectId);
  const setTextAnim = useEditorStore((s) => s.setTextAnim);
  const setTransition = useEditorStore((s) => s.setTransition);
  const setMotionSpeed = useEditorStore((s) => s.setMotionSpeed);
  const setMusic = useEditorStore((s) => s.setMusic);
  const clearMusic = useEditorStore((s) => s.clearMusic);
  const setVolume = useEditorStore((s) => s.setVolume);
  const setDucking = useEditorStore((s) => s.setDucking);
  const musicInputRef = useRef<HTMLInputElement>(null);
  const [musicStatus, setMusicStatus] = useState('');
  const [library, setLibrary] = useState<MusicLibraryTrack[] | null>(null);
  const [libraryError, setLibraryError] = useState('');
  const [libraryLoadingId, setLibraryLoadingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listMusicLibrary(createClient())
      .then((tracks) => {
        if (!cancelled) setLibrary(tracks);
      })
      .catch(() => {
        if (!cancelled) setLibraryError("Couldn't load the music library.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onMusicFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMusicStatus('Loading…');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const ctx = getAudioContext();
      const buffer = await ctx.decodeAudioData(arrayBuffer);
      const assetId = newAssetId('music');
      setMusic(assetId, file.name, buffer);
      if (projectId) uploadAsset(projectId, assetId, file, 'audio').catch((err) => console.error('[assets] upload failed', err));
      setMusicStatus('');
    } catch {
      setMusicStatus("That file couldn't be read. Try an MP3, M4A or WAV.");
    }
  };

  const onPickLibraryTrack = useCallback(
    async (track: MusicLibraryTrack) => {
      setLibraryLoadingId(track.id);
      try {
        const url = getMusicLibraryUrl(track.storagePath);
        const res = await fetch(url);
        const arrayBuffer = await res.arrayBuffer();
        const ctx = getAudioContext();
        const buffer = await ctx.decodeAudioData(arrayBuffer);
        setMusic(`library:${track.storagePath}`, track.name, buffer, track.bpm);
      } catch {
        setLibraryError(`Couldn't load "${track.name}".`);
      } finally {
        setLibraryLoadingId(null);
      }
    },
    [setMusic],
  );

  const activePresetId = MOTION_PRESETS.find((p) => p.textAnim === project.textAnim && p.transition === project.transition)?.id ?? null;

  return (
    <div className="grid grid-cols-1 gap-5">
      <p className="rounded-xl border border-[#8b7dff]/[.28] bg-[#5b4bff]/[.1] px-3.5 py-3 text-[12.5px] text-[#cfc8ff]">Defaults for every slide. Override text animation and transition per slide in its Style section.</p>

      <div>
        <SectionLabel>Preset</SectionLabel>
        <div className="grid gap-1.5">
          {MOTION_PRESETS.map((p) => (
            <SelectableRow
              key={p.id}
              radio
              selected={activePresetId === p.id}
              onClick={() => {
                setTextAnim(p.textAnim);
                setTransition(p.transition);
              }}
              title={p.title}
              description={p.description}
            />
          ))}
        </div>
        <Details summary="Advanced: text animation & transition">
          <div className="grid gap-3">
            <div>
              <SectionLabel>Text animation</SectionLabel>
              <SegButtons options={TEXT_ANIMS} value={project.textAnim} onChange={setTextAnim} />
            </div>
            <div>
              <SectionLabel>Transition into each slide</SectionLabel>
              <SegButtons options={TRANSITIONS} value={project.transition} onChange={setTransition} />
            </div>
          </div>
        </Details>
      </div>

      <RangeInput min={60} max={160} step={10} value={project.motionSpeed} onChange={setMotionSpeed} label="Speed" valueLabel={`${(project.motionSpeed / 100).toFixed(1)}×`} />

      <div>
        <SectionLabel>Music bed</SectionLabel>
        <ToggleRow
          title="Music bed"
          sub={musicStatus || (project.music ? project.music.name : 'No track added')}
          checked={!!project.music}
          onChange={(v) => (v ? musicInputRef.current?.click() : clearMusic())}
        />
        <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
          <button onClick={() => musicInputRef.current?.click()} className="rounded-[10px] border border-white/[.16] bg-white/[.03] px-3.5 py-2 text-[13px] font-semibold text-[#f4f5f8] hover:bg-white/[.08]">
            {project.music ? 'Change' : 'Add audio file'}
          </button>
          {project.music && (
            <button onClick={clearMusic} className="text-[13px] font-semibold text-[#8b7dff] hover:text-[#a89bff]">
              Remove
            </button>
          )}
          <input ref={musicInputRef} type="file" accept="audio/*" className="hidden" onChange={onMusicFile} />
        </div>
        <div className="mt-3">
          <RangeInput min={0} max={1} step={0.05} value={project.volume} onChange={setVolume} label="Volume" />
        </div>
        <p className="mt-1.5 text-[12px] text-[#767e8d]">The track loops if it&apos;s shorter than the video and fades out at the end.</p>
        <div className="mt-2.5">
          <ToggleRow title="Duck under story sound effects" sub="Briefly lowers the music whenever a story action's SFX plays" checked={project.ducking} onChange={setDucking} />
        </div>
      </div>

      <div>
        <SectionLabel>Music library</SectionLabel>
        {libraryError && <p className="text-[12.5px] text-[#ff8f76]">{libraryError}</p>}
        {library === null && !libraryError && <p className="text-[12.5px] text-[#767e8d]">Loading…</p>}
        {library?.length === 0 && <p className="text-[12.5px] text-[#767e8d]">No library tracks yet.</p>}
        <div className="grid gap-1.5">
          {library?.map((track) => (
            <div key={track.id} className="flex items-center justify-between gap-2 rounded-[10px] border border-white/[.08] bg-white/[.03] px-3 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold text-[#f4f5f8]">{track.name}</div>
                <div className="text-[11.5px] text-[#767e8d]">
                  {track.category} · {track.bpm} BPM · {track.durationSeconds.toFixed(0)}s loop
                </div>
              </div>
              <button
                onClick={() => onPickLibraryTrack(track)}
                disabled={libraryLoadingId === track.id}
                className="shrink-0 rounded-[10px] border border-white/[.12] bg-white/[.03] px-3 py-1.5 text-[12.5px] font-semibold text-[#c9cdd8] transition-colors duration-[.16s] hover:bg-white/[.08] disabled:opacity-50"
              >
                {libraryLoadingId === track.id ? 'Loading…' : project.music?.assetId === `library:${track.storagePath}` ? 'In use' : 'Use'}
              </button>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-[#767e8d]">Placeholder procedurally-generated tracks — swap in licensed music the same way once you have it (see scripts/seed-music-library.ts).</p>
      </div>
    </div>
  );
}
