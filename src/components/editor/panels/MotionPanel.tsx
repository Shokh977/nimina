'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { TEXT_ANIMS, TRANSITIONS } from '@/engine/constants';
import { newAssetId } from '@/lib/assetSrc';
import { createClient } from '@/lib/supabase/client';
import { getMusicLibraryUrl, listMusicLibrary, type MusicLibraryTrack } from '@/lib/supabase/musicLibrary';
import { uploadAsset } from '@/lib/supabase/storage';
import { useEditorStore } from '@/store/editorStore';
import SegButtons from '../ui/SegButtons';

let sharedAudioCtx: AudioContext | null = null;
function getAudioContext(): AudioContext {
  if (!sharedAudioCtx) sharedAudioCtx = new AudioContext();
  return sharedAudioCtx;
}

export default function MotionPanel() {
  const project = useEditorStore((s) => s.project);
  const projectId = useEditorStore((s) => s.projectId);
  const setTextAnim = useEditorStore((s) => s.setTextAnim);
  const setTransition = useEditorStore((s) => s.setTransition);
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
      if (projectId) uploadAsset(createClient(), projectId, assetId, file).catch((err) => console.error('[assets] upload failed', err));
      setMusicStatus('');
    } catch {
      setMusicStatus("That file couldn't be read. Try an MP3, M4A or WAV.");
    }
  };

  const onPickLibraryTrack = useCallback(
    async (track: MusicLibraryTrack) => {
      setLibraryLoadingId(track.id);
      try {
        const url = getMusicLibraryUrl(createClient(), track.storagePath);
        const res = await fetch(url);
        const arrayBuffer = await res.arrayBuffer();
        const ctx = getAudioContext();
        const buffer = await ctx.decodeAudioData(arrayBuffer);
        // Library tracks are shared, public files — no per-project upload
        // needed, just keep the storage path as a stable "asset id" so
        // reloading a saved project can refetch the same public URL.
        setMusic(`library:${track.storagePath}`, track.name, buffer, track.bpm);
      } catch {
        setLibraryError(`Couldn't load "${track.name}".`);
      } finally {
        setLibraryLoadingId(null);
      }
    },
    [setMusic],
  );

  return (
    <div>
      <p className="mb-4 rounded-xl bg-indigo-50 px-3 py-2.5 text-[13px] dark:bg-indigo-500/10">Defaults for every slide. Override text animation and transition per slide in its Style section.</p>

      <div className="mb-2 text-[13px] font-bold">Text animation</div>
      <SegButtons options={TEXT_ANIMS} value={project.textAnim} onChange={setTextAnim} />

      <div className="mt-5 mb-2 text-[13px] font-bold">Transition into each slide</div>
      <SegButtons options={TRANSITIONS} value={project.transition} onChange={setTransition} />

      <div className="mt-5 mb-2 text-[13px] font-bold">Music</div>
      <div className="rounded-2xl bg-neutral-100 p-3.5 dark:bg-neutral-800/60">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{musicStatus || project.music?.name || 'No track added'}</span>
          <button onClick={() => musicInputRef.current?.click()} className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-[13px] font-semibold dark:border-white/10 dark:bg-neutral-800">
            {project.music ? 'Change' : 'Add audio file'}
          </button>
          {project.music && (
            <button onClick={clearMusic} className="text-[13px] font-bold text-indigo-600 dark:text-indigo-400">
              Remove
            </button>
          )}
          <input ref={musicInputRef} type="file" accept="audio/*" className="hidden" onChange={onMusicFile} />
        </div>
        <label className="mt-2.5 block text-[12.5px] font-semibold text-neutral-500 dark:text-neutral-400">
          Volume
          <input type="range" min={0} max={1} step={0.05} value={project.volume} onChange={(e) => setVolume(Number(e.target.value))} className="mt-1 block w-full accent-indigo-600" />
        </label>
        <p className="mt-1.5 text-[12.5px] text-neutral-500 dark:text-neutral-400">The track loops if it&apos;s shorter than the video and fades out at the end.</p>
        <label className="mt-2.5 flex items-center gap-2 text-[13px] font-semibold">
          <input type="checkbox" checked={project.ducking} onChange={(e) => setDucking(e.target.checked)} className="h-[18px] w-[18px] accent-indigo-600" />
          Duck music under story sound effects
        </label>
        <p className="mt-1 text-[12.5px] text-neutral-500 dark:text-neutral-400">Briefly lowers the music whenever a story slide action&apos;s sound effect plays, so it isn&apos;t buried.</p>
      </div>

      <div className="mt-3.5 text-[13px] font-bold">Music library</div>
      <div className="rounded-2xl bg-neutral-100 p-3.5 dark:bg-neutral-800/60">
        {libraryError && <p className="text-[12.5px] text-red-600">{libraryError}</p>}
        {library === null && !libraryError && <p className="text-[12.5px] text-neutral-500 dark:text-neutral-400">Loading…</p>}
        {library?.length === 0 && <p className="text-[12.5px] text-neutral-500 dark:text-neutral-400">No library tracks yet.</p>}
        <div className="grid gap-1.5">
          {library?.map((track) => (
            <div key={track.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 dark:bg-neutral-900">
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-semibold">{track.name}</div>
                <div className="text-[11.5px] text-neutral-500 dark:text-neutral-400">
                  {track.category} · {track.bpm} BPM · {track.durationSeconds.toFixed(0)}s loop
                </div>
              </div>
              <button
                onClick={() => onPickLibraryTrack(track)}
                disabled={libraryLoadingId === track.id}
                className="flex-none rounded-lg border border-black/10 bg-white px-3 py-1.5 text-[12.5px] font-semibold disabled:opacity-50 dark:border-white/10 dark:bg-neutral-800"
              >
                {libraryLoadingId === track.id ? 'Loading…' : project.music?.assetId === `library:${track.storagePath}` ? 'In use' : 'Use'}
              </button>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[12.5px] text-neutral-500 dark:text-neutral-400">Placeholder procedurally-generated tracks — swap in licensed music the same way once you have it (see scripts/seed-music-library.ts).</p>
      </div>
    </div>
  );
}
