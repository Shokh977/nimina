'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import Waveform from '@/components/audio/Waveform';
import { prepareTrack, type PreparedTrack } from '@/lib/audio/prepareTrack';

export interface AdminTrack {
  id: string;
  name: string;
  artist: string;
  mood: string;
  genre: string;
  bpm: number;
  duration_seconds: number;
  storage_path: string;
  license: string;
  licence_source: string;
  licence_notes: string;
  active: boolean;
  pro_only: boolean;
  sort_order: number;
  peaks: number[] | null;
  bytes: number | null;
  bitrate_kbps: number | null;
}

const INPUT = 'w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-[13.5px] dark:border-white/10 dark:bg-neutral-900';
const BTN = 'rounded-lg border border-black/10 px-2.5 py-1 text-[12.5px] font-semibold disabled:opacity-40 dark:border-white/10';
const MOODS = ['Energetic', 'Chill', 'Uplifting', 'Dramatic', 'Playful', 'Corporate', 'Emotional', 'Dark'];
const GENRES = ['Electronic', 'Pop', 'Hip-hop', 'Lo-fi', 'Rock', 'Acoustic', 'Cinematic', 'Ambient', 'Funk'];

/**
 * /admin/music. Upload: the file is decoded and re-encoded to a 128 kbps
 * MP3 right here (prepareTrack), waveform peaks computed, then PUT to the
 * public bucket and saved with its metadata — the licence source and notes
 * are required (we redistribute this audio to every user who picks it).
 */
export default function MusicManager({ tracks, publicBase }: { tracks: AdminTrack[]; publicBase: string }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const patch = async (id: string, body: Record<string, unknown>) => {
    setBusyId(id);
    setError('');
    const res = await fetch('/api/admin/music', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, ...body }) });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? 'Update failed.');
    setBusyId(null);
    router.refresh();
  };
  const remove = async (t: AdminTrack) => {
    if (!window.confirm(`Delete "${t.name}"? Its file is deleted too — projects using it lose their music. To hide it from users but keep it working, deactivate it instead.`)) return;
    setBusyId(t.id);
    const res = await fetch(`/api/admin/music?id=${encodeURIComponent(t.id)}`, { method: 'DELETE' });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? 'Delete failed.');
    setBusyId(null);
    router.refresh();
  };

  return (
    <div className="mt-5 grid gap-6">
      <UploadForm onSaved={() => router.refresh()} />
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:bg-red-500/10 dark:text-red-400">{error}</p>}
      <div className="grid gap-2">
        <h2 className="text-[15px] font-bold">
          Library ({tracks.length} track{tracks.length === 1 ? '' : 's'}, {tracks.filter((t) => t.active).length} active)
        </h2>
        {tracks.map((t, i) => (
          <div key={t.id} data-track={t.id} className={`grid gap-2 rounded-xl border border-black/10 p-3 dark:border-white/10 ${t.active ? '' : 'opacity-60'}`}>
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-bold">
                  {t.name} <span className="font-normal text-neutral-500">— {t.artist}</span>
                </div>
                <div className="text-[12px] text-neutral-500">
                  {t.mood} · {t.genre} · {t.bpm} BPM · {Math.floor(t.duration_seconds / 60)}:{String(Math.round(t.duration_seconds % 60)).padStart(2, '0')}
                  {t.bitrate_kbps ? ` · ${t.bitrate_kbps} kbps` : ' · legacy file'}
                  {t.bytes ? ` · ${(t.bytes / 1048576).toFixed(1)} MB` : ''}
                </div>
              </div>
              <button className={BTN} disabled={busyId === t.id || i === 0} onClick={() => patch(t.id, { move: -1 })} aria-label={`Move ${t.name} up`}>
                ↑
              </button>
              <button className={BTN} disabled={busyId === t.id || i === tracks.length - 1} onClick={() => patch(t.id, { move: 1 })} aria-label={`Move ${t.name} down`}>
                ↓
              </button>
              <label className="flex items-center gap-1.5 text-[12.5px]">
                <input type="checkbox" checked={t.active} disabled={busyId === t.id} onChange={(e) => patch(t.id, { active: e.target.checked })} /> Active
              </label>
              <label className="flex items-center gap-1.5 text-[12.5px]">
                <input type="checkbox" checked={t.pro_only} disabled={busyId === t.id} onChange={(e) => patch(t.id, { proOnly: e.target.checked })} /> Pro only
              </label>
              <button className={`${BTN} text-red-600`} disabled={busyId === t.id} onClick={() => remove(t)}>
                Delete
              </button>
            </div>
            {t.peaks && <Waveform peaks={t.peaks} className="w-full" played="#4f46e5" rest="rgba(120,120,140,.45)" />}
            <audio controls preload="none" src={`${publicBase}/music-library/${t.storage_path}`} className="h-8 w-full" />
            <p className="text-[12px] text-neutral-500">
              <b>Licence ({t.license}):</b> {t.licence_source} — {t.licence_notes}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function UploadForm({ onSaved }: { onSaved: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [prepared, setPrepared] = useState<(PreparedTrack & { name: string; originalBytes: number }) | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [form, setForm] = useState({ title: '', artist: '', mood: '', genre: '', bpm: '', licenceType: 'licensed', licenceSource: '', licenceNotes: '', proOnly: true });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const pick = async (file: File | undefined) => {
    setError('');
    setPrepared(null);
    if (!file) return;
    if (!/\.(mp3|m4a|wav)$/i.test(file.name)) return setError('Upload an MP3, M4A or WAV file.');
    try {
      setProgress(0);
      const p = await prepareTrack(file, setProgress);
      setPrepared({ ...p, name: file.name, originalBytes: file.size });
      if (!form.title) set('title', file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProgress(null);
    }
  };

  const missing = [
    !prepared && 'audio file',
    !form.title.trim() && 'title',
    !form.artist.trim() && 'artist',
    !form.mood && 'mood',
    !form.genre && 'genre',
    !(Number(form.bpm) >= 20 && Number(form.bpm) <= 300) && 'BPM (20–300)',
    form.licenceSource.trim().length < 3 && 'licence source',
    form.licenceNotes.trim().length < 10 && 'licence notes (10+ characters)',
  ].filter(Boolean) as string[];

  const save = async () => {
    if (missing.length || !prepared) return;
    setSaving(true);
    setError('');
    try {
      const up = await fetch('/api/storage/upload', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'music-library', projectId: 'library', contentType: 'audio/mpeg', size: prepared.mp3.size }) });
      const signed = await up.json();
      if (!up.ok) throw new Error(signed.error ?? 'Upload failed.');
      const put = await fetch(signed.url, { method: 'PUT', headers: signed.headers, body: prepared.mp3 });
      if (!put.ok) throw new Error(`Upload failed (${put.status}).`);
      const res = await fetch('/api/admin/music', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, bpm: Number(form.bpm), path: signed.path, duration: prepared.duration, peaks: prepared.peaks }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error ?? 'Save failed.');
      setPrepared(null);
      setForm((f) => ({ ...f, title: '', artist: '', bpm: '', licenceSource: '', licenceNotes: '' }));
      if (fileRef.current) fileRef.current.value = '';
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid max-w-[720px] gap-3 rounded-xl border border-black/10 p-4 dark:border-white/10">
      <h2 className="text-[15px] font-bold">Add a track</h2>
      <input ref={fileRef} type="file" accept=".mp3,.m4a,.wav,audio/mpeg,audio/mp4,audio/wav" onChange={(e) => pick(e.target.files?.[0])} aria-label="Audio file" />
      {progress !== null && <p className="text-[13px] text-neutral-500">Converting to a 128 kbps MP3… {Math.round(progress * 100)}%</p>}
      {prepared && (
        <div className="grid gap-1">
          <Waveform peaks={prepared.peaks} className="w-full" played="#4f46e5" rest="rgba(120,120,140,.45)" />
          <p className="text-[12.5px] text-neutral-500">
            {prepared.name}: {(prepared.originalBytes / 1048576).toFixed(1)} MB → {(prepared.mp3.size / 1048576).toFixed(1)} MB MP3, {Math.floor(prepared.duration / 60)}:{String(Math.round(prepared.duration % 60)).padStart(2, '0')}
          </p>
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-[12.5px] font-semibold">
          Title <input className={INPUT} value={form.title} onChange={(e) => set('title', e.target.value)} />
        </label>
        <label className="text-[12.5px] font-semibold">
          Artist <input className={INPUT} value={form.artist} onChange={(e) => set('artist', e.target.value)} />
        </label>
        <label className="text-[12.5px] font-semibold">
          Mood
          <select className={INPUT} value={form.mood} onChange={(e) => set('mood', e.target.value)}>
            <option value="">Choose…</option>
            {MOODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="text-[12.5px] font-semibold">
          Genre
          <select className={INPUT} value={form.genre} onChange={(e) => set('genre', e.target.value)}>
            <option value="">Choose…</option>
            {GENRES.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </label>
        <label className="text-[12.5px] font-semibold">
          BPM <input className={INPUT} inputMode="numeric" value={form.bpm} onChange={(e) => set('bpm', e.target.value.replace(/\D/g, ''))} />
        </label>
        <label className="text-[12.5px] font-semibold">
          Duration <input className={INPUT} disabled value={prepared ? `${prepared.duration.toFixed(1)} s (read from the file)` : '—'} />
        </label>
        <label className="text-[12.5px] font-semibold">
          Licence type
          <select className={INPUT} value={form.licenceType} onChange={(e) => set('licenceType', e.target.value)}>
            <option value="licensed">Licensed (we hold a licence)</option>
            <option value="cc0">CC0 / public domain</option>
            <option value="original">Original (we made it)</option>
          </select>
        </label>
        <label className="flex items-end gap-2 pb-1.5 text-[12.5px] font-semibold">
          <input type="checkbox" checked={form.proOnly} onChange={(e) => set('proOnly', e.target.checked)} /> Pro only
        </label>
      </div>
      <label className="text-[12.5px] font-semibold">
        Licence source <span className="font-normal text-neutral-500">— where the licence comes from (vendor + licence/order ID, or the CC0 page URL)</span>
        <input className={INPUT} value={form.licenceSource} onChange={(e) => set('licenceSource', e.target.value)} />
      </label>
      <label className="text-[12.5px] font-semibold">
        Licence notes <span className="font-normal text-neutral-500">— what it allows: redistribution to users, commercial videos, attribution, limits</span>
        <textarea className={INPUT} rows={3} value={form.licenceNotes} onChange={(e) => set('licenceNotes', e.target.value)} />
      </label>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:bg-red-500/10 dark:text-red-400">{error}</p>}
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={!!missing.length || saving} className="rounded-lg bg-indigo-600 px-3.5 py-2 text-[13px] font-bold text-white disabled:opacity-50">
          {saving ? 'Saving…' : 'Save track'}
        </button>
        {missing.length > 0 && <span className="text-[12.5px] text-neutral-500">Still needed: {missing.join(', ')}</span>}
      </div>
    </div>
  );
}
