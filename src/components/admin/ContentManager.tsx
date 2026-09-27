'use client';

import Link from 'next/link';
import { useState } from 'react';

import { createClient } from '@/lib/supabase/client';

interface TrackRow {
  id: string;
  name: string;
  category: string;
  bpm: number;
  duration_seconds: number;
}

export default function ContentManager({ initialTracks }: { initialTracks: TrackRow[] }) {
  const [tracks, setTracks] = useState(initialTracks);

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
        <p className="mt-2 text-[13px] text-neutral-500 dark:text-neutral-400">
          Templates moved to their own editor —{' '}
          <Link href="/admin/templates" className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
            manage them at /admin/templates
          </Link>
          .
        </p>
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
