'use client';

import { useState } from 'react';

import { createClient } from '@/lib/supabase/client';

interface TemplateRow {
  id: string;
  name: string;
  category: string;
  enabled: boolean;
}
interface TrackRow {
  id: string;
  name: string;
  category: string;
  bpm: number;
  duration_seconds: number;
}

export default function ContentManager({ initialTemplates, initialTracks }: { initialTemplates: TemplateRow[]; initialTracks: TrackRow[] }) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [tracks, setTracks] = useState(initialTracks);

  const toggleTemplate = async (id: string, enabled: boolean) => {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, enabled } : t)));
    // Rows are created lazily via upsert — most templates have no row at
    // all until an admin first disables them (see listEnabledTemplates()).
    const { error } = await createClient().from('templates').upsert({ id, enabled });
    if (error) {
      console.error('[admin] template toggle failed', error);
      setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, enabled: !enabled } : t)));
    }
  };

  const deleteTrack = async (id: string) => {
    const prev = tracks;
    setTracks((t) => t.filter((row) => row.id !== id));
    const { error } = await createClient().from('music_tracks').delete().eq('id', id);
    if (error) {
      console.error('[admin] track delete failed', error);
      setTracks(prev);
    }
  };

  return (
    <div className="mt-5 grid gap-6">
      <section>
        <h2 className="text-[15px] font-bold">Templates</h2>
        <div className="mt-2 grid gap-1.5">
          {templates.map((t) => (
            <label key={t.id} className="flex items-center justify-between gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 dark:border-white/10 dark:bg-neutral-900">
              <span className="text-[13.5px] font-semibold">
                {t.name} <span className="text-neutral-400">· {t.category}</span>
              </span>
              <span className="flex items-center gap-1.5 text-[12.5px] font-semibold">
                {t.enabled ? 'Enabled' : 'Hidden'}
                <input type="checkbox" checked={t.enabled} onChange={(e) => toggleTemplate(t.id, e.target.checked)} className="h-[16px] w-[16px] accent-indigo-600" />
              </span>
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-[15px] font-bold">Music library</h2>
        <div className="mt-2 grid gap-1.5">
          {tracks.map((track) => (
            <div key={track.id} className="flex items-center justify-between gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 dark:border-white/10 dark:bg-neutral-900">
              <span className="text-[13.5px] font-semibold">
                {track.name} <span className="text-neutral-400">· {track.category} · {track.bpm} BPM · {track.duration_seconds.toFixed(0)}s</span>
              </span>
              <button onClick={() => deleteTrack(track.id)} className="text-[12.5px] font-bold text-red-600">
                Delete
              </button>
            </div>
          ))}
          {tracks.length === 0 && <p className="text-[13px] text-neutral-500 dark:text-neutral-400">No tracks yet — run scripts/seed-music-library.ts.</p>}
        </div>
      </section>
    </div>
  );
}
