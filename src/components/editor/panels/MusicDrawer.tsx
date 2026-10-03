'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Waveform from '@/components/audio/Waveform';
import { musicClip } from '@/engine/audio/clips';
import { newAssetId } from '@/lib/assetSrc';
import { isPro } from '@/lib/plan';
import { rejectUpload, uploadAsset } from '@/lib/storage/assets';
import { createClient } from '@/lib/supabase/client';
import { getMusicLibraryUrl, getMusicTracks, LIBRARY_SORTS, musicLibraryFacets, searchMusicLibrary, type LibrarySort, type MusicLibraryTrack } from '@/lib/supabase/musicLibrary';
import { useEditorStore } from '@/store/editorStore';
import { getAudioContext } from '../audio/audioContext';
import SegmentedControl from '../ui/SegmentedControl';

const PAGE = 25;
const MOODS_SHOWN = 8;
const RECENT_KEY = 'nimina:music-recent';
const RECENT_MAX = 8;

function readRecent(): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}
function pushRecent(id: string) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...readRecent().filter((x) => x !== id)].slice(0, RECENT_MAX)));
  } catch {
    // private mode etc. — recents are a convenience
  }
}

function duration(s: number): string {
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
}

/**
 * Adding or replacing music: the music library (search, mood chips, genre,
 * sort, paged from the database so hundreds of tracks stay quick, recently
 * used first) and Upload your own. Opens from the timeline's "＋ Add music",
 * the Audio panel's Replace, or Motion — in place of the slide rail on a
 * computer, full screen on a phone. A pick goes onto the timeline's music
 * track (store.setMusic: a new clip, or the current clip's file swapped
 * keeping its placement), and the drawer stays open so you can try another.
 */
export default function MusicDrawer({ fullScreen = false }: { fullScreen?: boolean }) {
  const setMusicDrawerOpen = useEditorStore((s) => s.setMusicDrawerOpen);
  const projectId = useEditorStore((s) => s.projectId);
  const plan = useEditorStore((s) => s.plan);
  const setMusic = useEditorStore((s) => s.setMusic);
  const current = useEditorStore((s) => musicClip(s.project));
  const pro = isPro(plan);
  const [tab, setTab] = useState<'library' | 'upload'>(current && !current.assetId.startsWith('library:') ? 'upload' : 'library');
  const [status, setStatus] = useState('');
  const close = () => setMusicDrawerOpen(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMusicDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setMusicDrawerOpen]);

  const pickLibrary = async (track: MusicLibraryTrack) => {
    setStatus(`Loading “${track.name}”…`);
    try {
      const res = await fetch(getMusicLibraryUrl(track.storagePath));
      if (!res.ok) throw new Error(String(res.status));
      const buffer = await getAudioContext().decodeAudioData(await res.arrayBuffer());
      setMusic(`library:${track.storagePath}`, track.name, buffer, track.bpm);
      pushRecent(track.id);
      setStatus('');
    } catch {
      setStatus(`Couldn't load “${track.name}”.`);
    }
  };

  return (
    <div
      role="dialog"
      aria-label={current ? 'Replace music' : 'Add music'}
      data-music-drawer
      className={`flex min-h-0 flex-col bg-[#0b0c11] ${fullScreen ? 'fixed inset-0 z-50' : 'h-full'}`}
      style={fullScreen ? { paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' } : undefined}
    >
      <div className="flex shrink-0 items-center gap-2 px-4 pt-3.5 pb-3">
        <h2 className="flex-1 text-[15px] font-semibold text-[#f4f5f8]">{current ? 'Replace music' : 'Add music'}</h2>
        <button type="button" onClick={close} aria-label="Close music" className="grid h-9 w-9 place-items-center rounded-[10px] text-[18px] text-[#9aa1af] hover:bg-white/[.06] hover:text-white">
          ✕
        </button>
      </div>
      <div className="shrink-0 px-4">
        <SegmentedControl
          options={[
            ['library', 'Library'],
            ['upload', 'Upload your own'],
          ]}
          value={tab}
          onChange={setTab}
        />
        {status && <p className="mt-2.5 rounded-[10px] border border-white/[.08] bg-white/[.03] px-3 py-2 text-[13px] text-[#c9cdd8]">{status}</p>}
      </div>
      {tab === 'library' ? <Library pro={pro} onPick={pickLibrary} /> : <UploadOwn projectId={projectId} onLoaded={(id, name, buffer) => setMusic(id, name, buffer)} setStatus={setStatus} />}
    </div>
  );
}

function Library({ pro, onPick }: { pro: boolean; onPick: (t: MusicLibraryTrack) => Promise<void> }) {
  const supabase = useMemo(() => createClient(), []);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [mood, setMood] = useState('');
  const [genre, setGenre] = useState('');
  const [sort, setSort] = useState<LibrarySort>('featured');
  const [freeOnly, setFreeOnly] = useState(false);
  const [allMoods, setAllMoods] = useState(false);
  const [facets, setFacets] = useState<{ moods: string[]; genres: string[] }>({ moods: [], genres: [] });
  const [tracks, setTracks] = useState<MusicLibraryTrack[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [recent, setRecent] = useState<MusicLibraryTrack[]>([]);
  const requestRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const player = usePreviewPlayer();

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    musicLibraryFacets(supabase)
      .then(setFacets)
      .catch(() => {});
    const ids = readRecent();
    if (ids.length)
      getMusicTracks(supabase, ids)
        .then(setRecent)
        .catch(() => {});
  }, [supabase]);

  const filtered = !!(debounced || mood || genre || freeOnly);
  const queryKey = JSON.stringify([debounced, mood, genre, sort, freeOnly]);

  const fetchPage = useCallback(
    (offset: number) => searchMusicLibrary(supabase, { search: debounced, mood, genre, sort, freeOnly, offset, limit: PAGE }),
    // queryKey covers the filter values
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [supabase, queryKey],
  );
  // Which query the list currently shows — while it differs from queryKey, a new search is loading.
  const [shownKey, setShownKey] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const loading = shownKey !== queryKey || loadingMore;

  // A new search/filter/sort starts again from the top.
  useEffect(() => {
    const req = ++requestRef.current;
    fetchPage(0)
      .then((page) => {
        if (req !== requestRef.current) return;
        scrollRef.current?.scrollTo({ top: 0 });
        setTracks(page.tracks);
        setTotal(page.total);
        setError('');
      })
      .catch(() => req === requestRef.current && setError("Couldn't load the music library."))
      .finally(() => req === requestRef.current && setShownKey(queryKey));
  }, [fetchPage, queryKey]);

  const loadMore = useCallback(() => {
    const req = requestRef.current;
    setLoadingMore(true);
    fetchPage(tracks.length)
      .then((page) => {
        if (req !== requestRef.current) return;
        setTracks((prev) => [...prev, ...page.tracks]);
        setTotal(page.total);
      })
      .catch(() => req === requestRef.current && setError("Couldn't load more tracks."))
      .finally(() => setLoadingMore(false));
  }, [fetchPage, tracks.length]);

  // Next page when the end of the list scrolls into view.
  const hasMore = total !== null && tracks.length < total;
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && loadMore(), { root: scrollRef.current, rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, loadMore]);

  const clearFilters = () => {
    setSearch('');
    setDebounced('');
    setMood('');
    setGenre('');
    setFreeOnly(false);
  };
  const moods = allMoods ? facets.moods : facets.moods.slice(0, MOODS_SHOWN);
  const SELECT = 'min-w-0 flex-1 rounded-lg border border-white/[.12] bg-[#12141b] px-2.5 py-1.5 text-[13px] text-[#f4f5f8]';

  return (
    <>
      <div className="grid shrink-0 gap-2.5 px-4 pt-3 pb-2.5">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title, artist, mood or genre"
          aria-label="Search music"
          className="w-full rounded-[10px] border border-white/[.12] bg-white/[.04] px-3 py-2 text-[13.5px] text-[#f4f5f8] placeholder:text-[#767e8d] focus:border-[#8b7dff]/60 focus:outline-none"
        />
        {facets.moods.length > 0 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Mood">
            {['', ...moods].map((m) => (
              <button
                key={m || 'all'}
                type="button"
                aria-pressed={mood === m}
                onClick={() => setMood(m)}
                className="rounded-full border border-white/[.12] px-2.5 py-1 text-[12px] font-semibold text-[#9aa1af] aria-pressed:border-[#8b7dff]/60 aria-pressed:bg-[#5b4bff]/[.18] aria-pressed:text-[#cfc8ff]"
              >
                {m || 'All moods'}
              </button>
            ))}
            {facets.moods.length > MOODS_SHOWN && (
              <button type="button" onClick={() => setAllMoods((v) => !v)} className="rounded-full px-2 py-1 text-[12px] font-semibold text-[#8b7dff]">
                {allMoods ? 'Fewer' : `+${facets.moods.length - MOODS_SHOWN} more`}
              </button>
            )}
          </div>
        )}
        <div className="flex gap-2">
          <select aria-label="Genre" value={genre} onChange={(e) => setGenre(e.target.value)} className={SELECT}>
            <option value="">All genres</option>
            {facets.genres.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
          <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as LibrarySort)} className={SELECT}>
            {LIBRARY_SORTS.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-[#767e8d]">
          <span className="flex-1" aria-live="polite">
            {total === null ? 'Loading…' : `${total} ${total === 1 ? 'track' : 'tracks'}`}
          </span>
          {!pro && (
            <button type="button" aria-pressed={freeOnly} onClick={() => setFreeOnly((v) => !v)} className="rounded-full border border-white/[.12] px-2.5 py-0.5 font-semibold text-[#9aa1af] aria-pressed:border-[#8b7dff]/60 aria-pressed:bg-[#5b4bff]/[.18] aria-pressed:text-[#cfc8ff]">
              Free only
            </button>
          )}
          {filtered && (
            <button type="button" onClick={clearFilters} className="font-semibold text-[#8b7dff]">
              Clear
            </button>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
        {!pro && (
          <p className="mb-2.5 rounded-[10px] border border-[#8b7dff]/30 bg-[#5b4bff]/[.1] px-3 py-2 text-[12.5px] leading-snug text-[#cfc8ff]">
            Most library tracks are part of Pro — preview any of them, then{' '}
            <Link href="/pricing" className="font-semibold text-white underline">
              upgrade
            </Link>{' '}
            to use one. You can always upload your own.
          </p>
        )}
        {!filtered && recent.length > 0 && (
          <section aria-label="Recently used" className="mb-3">
            <h3 className="mb-1.5 text-[11.5px] font-semibold tracking-wide text-[#767e8d] uppercase">Recently used</h3>
            <div className="grid gap-1.5">
              {recent.map((t) => (
                <TrackRow key={`r-${t.id}`} track={t} pro={pro} player={player} onPick={onPick} />
              ))}
            </div>
            <h3 className="mt-3 mb-1.5 text-[11.5px] font-semibold tracking-wide text-[#767e8d] uppercase">All tracks</h3>
          </section>
        )}
        {error && <p className="text-[12.5px] text-[#ff8f76]">{error}</p>}
        {total === 0 && shownKey === queryKey && (
          <p className="py-6 text-center text-[13px] text-[#767e8d]">
            {filtered ? (
              <>
                No tracks match.{' '}
                <button type="button" onClick={clearFilters} className="font-semibold text-[#8b7dff]">
                  Clear filters
                </button>
              </>
            ) : (
              'No library tracks yet.'
            )}
          </p>
        )}
        <div className="grid gap-1.5">
          {tracks.map((t) => (
            <TrackRow key={t.id} track={t} pro={pro} player={player} onPick={onPick} />
          ))}
        </div>
        <div ref={sentinelRef} className="h-px" />
        {loadingMore && <p className="py-3 text-center text-[12px] text-[#767e8d]">Loading more…</p>}
      </div>
    </>
  );
}

interface PreviewPlayer {
  playing: string | null;
  progress: number;
  toggle: (t: MusicLibraryTrack) => void;
}

/** One shared <audio> for previews — starting one stops the other. */
function usePreviewPlayer(): PreviewPlayer {
  const [playing, setPlaying] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => audioRef.current?.pause(), []);
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
  return { playing, progress, toggle };
}

function TrackRow({ track: t, pro, player, onPick }: { track: MusicLibraryTrack; pro: boolean; player: PreviewPlayer; onPick: (t: MusicLibraryTrack) => Promise<void> }) {
  const inUse = useEditorStore((s) => musicClip(s.project)?.assetId === `library:${t.storagePath}`);
  const [picking, setPicking] = useState(false);
  const locked = t.proOnly && !pro;
  const playing = player.playing === t.id;
  return (
    <div data-library-track={t.id} className={`grid gap-1.5 rounded-[10px] border px-3 py-2 ${inUse ? 'border-[#8b7dff]/55 bg-[#5b4bff]/[.12]' : 'border-white/[.08] bg-white/[.03]'} ${locked ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => player.toggle(t)}
          aria-label={playing ? `Stop preview of ${t.name}` : `Preview ${t.name}`}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[.08] text-[12px] text-white hover:bg-white/[.14]"
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-[#f4f5f8]">
            {t.name} <span className="font-normal text-[#767e8d]">· {t.artist}</span>
          </div>
          <div className="truncate text-[11.5px] text-[#767e8d]">
            {t.mood} · {t.genre} · {t.bpm} BPM · {duration(t.durationSeconds)}
            {!t.proOnly && !pro ? ' · Free' : ''}
          </div>
        </div>
        {locked ? (
          <Link href="/pricing" className="shrink-0 rounded-[10px] border border-[#8b7dff]/40 px-2.5 py-1.5 text-[12px] font-semibold text-[#cfc8ff]" title="Library tracks are a Pro feature">
            🔒 Pro
          </Link>
        ) : (
          <button
            type="button"
            disabled={picking || inUse}
            onClick={async () => {
              setPicking(true);
              await onPick(t);
              setPicking(false);
            }}
            className="shrink-0 rounded-[10px] border border-white/[.12] bg-white/[.03] px-3 py-1.5 text-[12.5px] font-semibold text-[#c9cdd8] hover:bg-white/[.08] disabled:opacity-60"
          >
            {picking ? 'Loading…' : inUse ? 'In use' : 'Use'}
          </button>
        )}
      </div>
      {t.peaks && (
        <button type="button" onClick={() => player.toggle(t)} aria-hidden tabIndex={-1} className="block w-full">
          <Waveform peaks={t.peaks} progress={playing ? player.progress : 0} height={22} className="w-full" />
        </button>
      )}
    </div>
  );
}

function UploadOwn({ projectId, onLoaded, setStatus }: { projectId: string | null; onLoaded: (id: string, name: string, buffer: AudioBuffer) => void; setStatus: (s: string) => void }) {
  const current = useEditorStore((s) => musicClip(s.project));
  const inputRef = useRef<HTMLInputElement>(null);
  const own = current && !current.assetId.startsWith('library:');
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
    <div className="grid gap-2 px-4 pt-3">
      <button
        onClick={() => inputRef.current?.click()}
        className="rounded-[10px] border border-dashed border-white/[.18] bg-white/[.02] px-3 py-2.5 text-[12.5px] font-semibold text-[#c9cdd8] hover:border-[#8b7dff]/50 hover:bg-[#5b4bff]/[.08]"
      >
        {own ? 'Replace with another file' : '＋ Add an audio file (MP3, M4A or WAV)'}
      </button>
      <input ref={inputRef} type="file" accept="audio/*" className="hidden" onChange={onFile} />
      <p className="text-[12px] leading-snug text-[#767e8d]">Use music you have the rights to. It stays private to your project.</p>
    </div>
  );
}
