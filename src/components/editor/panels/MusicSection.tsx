'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import Waveform from '@/components/audio/Waveform';
import { newAssetId } from '@/lib/assetSrc';
import { isPro } from '@/lib/plan';
import { rejectUpload, uploadAsset } from '@/lib/storage/assets';
import { createClient } from '@/lib/supabase/client';
import { getMusicLibraryUrl, listMusicLibrary, type MusicLibraryTrack } from '@/lib/supabase/musicLibrary';
import { useEditorStore } from '@/store/editorStore';
import SectionLabel from '../ui/SectionLabel';
import SegmentedControl from '../ui/SegmentedControl';

/**
 * Music in the Motion panel: a Library tab (admin-curated tracks — filter by
 * mood and genre, preview with a waveform, click to use; Pro unless a track
 * is marked free) and an Upload-your-own tab. Either way the track becomes
 * project.music with its decoded buffer in the store, so preview and export
 * treat it identically (loop, fade-out, ducking).
 */
export default function MusicSection({ getAudioContext }: { getAudioContext: () => AudioContext }) {
  const project = useEditorStore((s) => s.project);
  const projectId = useEditorStore((s) => s.projectId);
  const plan = useEditorStore((s) => s.plan);
  const setMusic = useEditorStore((s) => s.setMusic);
  const clearMusic = useEditorStore((s) => s.clearMusic);
  const pro = isPro(plan);
  const usingLibrary = project.music?.assetId.startsWith('library:') ?? false;
  const [tab, setTab] = useState<'library' | 'upload'>(project.music && !usingLibrary ? 'upload' : 'library');
  const [status, setStatus] = useState('');

  return (
    <div>
      <SectionLabel>Music</SectionLabel>
      <div className="mb-2.5 flex items-center gap-2 rounded-[10px] border border-white/[.08] bg-white/[.03] px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-[13px] text-[#c9cdd8]">{status || (project.music ? `♪ ${project.music.name}` : 'No music yet')}</span>
        {project.music && (
          <button onClick={clearMusic} className="shrink-0 text-[12.5px] font-semibold text-[#8b7dff] hover:text-[#a89bff]">
            Remove
          </button>
        )}
      </div>
      <SegmentedControl
        options={[
          ['library', 'Library'],
          ['upload', 'Upload your own'],
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="mt-3">{tab === 'library' ? <Library pro={pro} onPick={async (track) => {
        setStatus(`Loading “${track.name}”…`);
        try {
          const res = await fetch(getMusicLibraryUrl(track.storagePath));
          if (!res.ok) throw new Error(String(res.status));
          const buffer = await getAudioContext().decodeAudioData(await res.arrayBuffer());
          setMusic(`library:${track.storagePath}`, track.name, buffer, track.bpm);
          setStatus('');
        } catch {
          setStatus(`Couldn't load “${track.name}”.`);
        }
      }} /> : <UploadOwn projectId={projectId} onLoaded={(id, name, buffer) => setMusic(id, name, buffer)} getAudioContext={getAudioContext} setStatus={setStatus} />}</div>
    </div>
  );
}

function Library({ pro, onPick }: { pro: boolean; onPick: (t: MusicLibraryTrack) => Promise<void> }) {
  const inUse = useEditorStore((s) => s.project.music?.assetId);
  const [tracks, setTracks] = useState<MusicLibraryTrack[] | null>(null);
  const [error, setError] = useState('');
  const [mood, setMood] = useState('');
  const [genre, setGenre] = useState('');
  const [playing, setPlaying] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [picking, setPicking] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    listMusicLibrary(createClient())
      .then((t) => !cancelled && setTracks(t))
      .catch(() => !cancelled && setError("Couldn't load the music library."));
    return () => {
      cancelled = true;
      audioRef.current?.pause();
    };
  }, []);

  const moods = useMemo(() => [...new Set((tracks ?? []).map((t) => t.mood))].sort(), [tracks]);
  const genres = useMemo(() => [...new Set((tracks ?? []).map((t) => t.genre))].sort(), [tracks]);
  const shown = (tracks ?? []).filter((t) => (!mood || t.mood === mood) && (!genre || t.genre === genre));
  const locked = (t: MusicLibraryTrack) => t.proOnly && !pro;

  const toggle = (t: MusicLibraryTrack) => {
    let a = audioRef.current;
    if (!a) {
      a = audioRef.current = new Audio();
      a.ontimeupdate = () => setProgress(a!.duration ? a!.currentTime / a!.duration : 0);
      a.onended = () => setPlaying(null);
    }
    if (playing === t.id) {
      a.pause();
      setPlaying(null);
      return;
    }
    a.src = getMusicLibraryUrl(t.storagePath);
    setProgress(0);
    void a.play().catch(() => setPlaying(null));
    setPlaying(t.id);
  };

  if (error) return <p className="text-[12.5px] text-[#ff8f76]">{error}</p>;
  if (!tracks) return <p className="text-[12.5px] text-[#767e8d]">Loading…</p>;
  if (!tracks.length) return <p className="text-[12.5px] text-[#767e8d]">No library tracks yet.</p>;

  return (
    <div className="grid gap-2.5">
      {!pro && tracks.some((t) => t.proOnly) && (
        <p className="rounded-[10px] border border-[#8b7dff]/30 bg-[#5b4bff]/[.1] px-3 py-2 text-[12.5px] leading-snug text-[#cfc8ff]">
          Library tracks are part of Pro — preview them here, then{' '}
          <Link href="/pricing" className="font-semibold text-white underline">
            upgrade
          </Link>{' '}
          to use one. You can always upload your own.
        </p>
      )}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Mood">
        {['', ...moods].map((m) => (
          <button key={m || 'all'} type="button" aria-pressed={mood === m} onClick={() => setMood(m)} className="rounded-full border border-white/[.12] px-2.5 py-1 text-[12px] font-semibold text-[#9aa1af] aria-pressed:border-[#8b7dff]/60 aria-pressed:bg-[#5b4bff]/[.18] aria-pressed:text-[#cfc8ff]">
            {m || 'All moods'}
          </button>
        ))}
      </div>
      <select aria-label="Genre" value={genre} onChange={(e) => setGenre(e.target.value)} className="rounded-lg border border-white/[.12] bg-white/[.03] px-2.5 py-1.5 text-[13px] text-[#f4f5f8]">
        <option value="">All genres</option>
        {genres.map((g) => (
          <option key={g}>{g}</option>
        ))}
      </select>
      {shown.length === 0 && <p className="text-[12.5px] text-[#767e8d]">No tracks match those filters.</p>}
      <div className="grid gap-1.5">
        {shown.map((t) => {
          const current = inUse === `library:${t.storagePath}`;
          return (
            <div key={t.id} data-library-track={t.id} className={`grid gap-1.5 rounded-[10px] border px-3 py-2 ${current ? 'border-[#8b7dff]/55 bg-[#5b4bff]/[.12]' : 'border-white/[.08] bg-white/[.03]'} ${locked(t) ? 'opacity-55' : ''}`}>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => toggle(t)} aria-label={playing === t.id ? `Stop preview of ${t.name}` : `Preview ${t.name}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[.08] text-[12px] text-white hover:bg-white/[.14]">
                  {playing === t.id ? '❚❚' : '▶'}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-[#f4f5f8]">
                    {t.name} <span className="font-normal text-[#767e8d]">· {t.artist}</span>
                  </div>
                  <div className="truncate text-[11.5px] text-[#767e8d]">
                    {t.mood} · {t.genre} · {t.bpm} BPM · {Math.floor(t.durationSeconds / 60)}:{String(Math.round(t.durationSeconds % 60)).padStart(2, '0')}
                  </div>
                </div>
                {locked(t) ? (
                  <Link href="/pricing" className="shrink-0 rounded-[10px] border border-[#8b7dff]/40 px-2.5 py-1.5 text-[12px] font-semibold text-[#cfc8ff]" title="Library tracks are a Pro feature">
                    🔒 Pro
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled={picking === t.id || current}
                    onClick={async () => {
                      setPicking(t.id);
                      await onPick(t);
                      setPicking(null);
                    }}
                    className="shrink-0 rounded-[10px] border border-white/[.12] bg-white/[.03] px-3 py-1.5 text-[12.5px] font-semibold text-[#c9cdd8] hover:bg-white/[.08] disabled:opacity-60"
                  >
                    {picking === t.id ? 'Loading…' : current ? 'In use' : 'Use'}
                  </button>
                )}
              </div>
              {t.peaks && (
                <button type="button" onClick={() => toggle(t)} aria-hidden tabIndex={-1} className="block w-full">
                  <Waveform peaks={t.peaks} progress={playing === t.id ? progress : 0} height={22} className="w-full" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function UploadOwn({ projectId, onLoaded, getAudioContext, setStatus }: { projectId: string | null; onLoaded: (id: string, name: string, buffer: AudioBuffer) => void; getAudioContext: () => AudioContext; setStatus: (s: string) => void }) {
  const project = useEditorStore((s) => s.project);
  const inputRef = useRef<HTMLInputElement>(null);
  const own = project.music && !project.music.assetId.startsWith('library:');
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || rejectUpload(file, projectId, 'audio')) return;
    setStatus('Loading…');
    try {
      const buffer = await getAudioContext().decodeAudioData(await file.arrayBuffer());
      const assetId = newAssetId('music');
      onLoaded(assetId, file.name, buffer);
      if (projectId) uploadAsset(projectId, assetId, file, 'audio').catch((err) => console.error('[assets] upload failed', err));
      setStatus('');
    } catch {
      setStatus("That file couldn't be read. Try an MP3, M4A or WAV.");
    }
  };
  return (
    <div className="grid gap-2">
      <button onClick={() => inputRef.current?.click()} className="rounded-[10px] border border-dashed border-white/[.18] bg-white/[.02] px-3 py-2.5 text-[12.5px] font-semibold text-[#c9cdd8] hover:border-[#8b7dff]/50 hover:bg-[#5b4bff]/[.08]">
        {own ? 'Replace with another file' : '＋ Add an audio file (MP3, M4A or WAV)'}
      </button>
      <input ref={inputRef} type="file" accept="audio/*" className="hidden" onChange={onFile} />
      <p className="text-[12px] leading-snug text-[#767e8d]">Use music you have the rights to. It stays private to your project.</p>
    </div>
  );
}
