'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { ProjectListItem } from '@/lib/supabase/projects';

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export default function ProjectCard({
  project,
  thumbnailUrl,
  onRename,
  onDuplicate,
  onDelete,
}: {
  project: ProjectListItem;
  thumbnailUrl: string | null;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(project.name);
  const [busy, setBusy] = useState<'duplicate' | 'delete' | null>(null);

  const submitRename = () => {
    setRenaming(false);
    const trimmed = name.trim();
    if (trimmed && trimmed !== project.name) onRename(project.id, trimmed);
    else setName(project.name);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 bg-white dark:border-white/10 dark:bg-neutral-900">
      <Link href={`/editor/${project.id}`} className="block">
        <div className="flex aspect-[9/16] items-center justify-center bg-neutral-100 dark:bg-neutral-800">
          {thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL, not a static/remote asset Next's Image optimizer can handle
            <img src={thumbnailUrl} alt={project.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-[12.5px] text-neutral-400">No preview yet</span>
          )}
        </div>
      </Link>
      <div className="p-3">
        {renaming ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={submitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitRename();
              if (e.key === 'Escape') {
                setName(project.name);
                setRenaming(false);
              }
            }}
            className="block w-full rounded-lg border border-black/10 bg-white px-2 py-1 text-[14px] font-bold dark:border-white/10 dark:bg-neutral-800"
          />
        ) : (
          <button onClick={() => setRenaming(true)} className="block w-full truncate text-left text-[14px] font-bold hover:underline">
            {project.name}
          </button>
        )}
        <p className="mt-0.5 text-[12px] text-neutral-500 dark:text-neutral-400">Updated {relativeTime(project.updated_at)}</p>
        <div className="mt-2.5 flex gap-1.5">
          <button
            disabled={busy !== null}
            onClick={async () => {
              setBusy('duplicate');
              await Promise.resolve(onDuplicate(project.id));
              setBusy(null);
            }}
            className="flex-1 rounded-lg border border-black/10 px-2 py-1.5 text-[12.5px] font-semibold disabled:opacity-50 dark:border-white/10"
          >
            {busy === 'duplicate' ? 'Duplicating…' : 'Duplicate'}
          </button>
          <button
            disabled={busy !== null}
            onClick={() => {
              if (window.confirm(`Delete "${project.name}"? This can't be undone.`)) {
                setBusy('delete');
                onDelete(project.id);
              }
            }}
            className="flex-1 rounded-lg border border-black/10 px-2 py-1.5 text-[12.5px] font-semibold text-red-600 disabled:opacity-50 dark:border-white/10"
          >
            {busy === 'delete' ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
