'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import UserMenu from '@/components/auth/UserMenu';
import { createClient } from '@/lib/supabase/client';
import { createProject, deleteProject, duplicateProject, getProject, renameProject, type ProjectListItem } from '@/lib/supabase/projects';
import { getSignedThumbnailUrl } from '@/lib/supabase/storage';
import ProjectCard from './ProjectCard';

export default function ProjectsShell({ userEmail, initialProjects }: { userEmail: string; initialProjects: ProjectListItem[] }) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [thumbnails, setThumbnails] = useState<Record<string, string | null>>({});
  const [creating, setCreating] = useState(false);
  const [limitReached, setLimitReached] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        projects.map(async (p) => [p.id, await getSignedThumbnailUrl(supabase, p.thumbnail_path)] as const),
      );
      if (!cancelled) setThumbnails(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
    // Re-run whenever the set of thumbnail_paths changes, not on every projects re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects.map((p) => p.thumbnail_path).join('|')]);

  const handleCreate = async () => {
    setCreating(true);
    setLimitReached(false);
    try {
      const supabase = createClient();
      const project = await createProject(supabase);
      router.push(`/editor/${project.id}`);
    } catch (err) {
      // The free plan's 1-project cap is enforced by an RLS policy (see
      // supabase/migrations/0005_project_limits.sql) — a blocked insert
      // surfaces here as a row-level-security policy violation.
      const message = err instanceof Error ? err.message : String(err);
      const code = (err as { code?: string } | null)?.code;
      if (code === '42501' || /row-level security|policy/i.test(message)) {
        setLimitReached(true);
      } else {
        console.error('[projects] create failed', err);
      }
      setCreating(false);
    }
  };

  const handleRename = async (id: string, name: string) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
    try {
      await renameProject(createClient(), id, name);
    } catch (err) {
      console.error('[projects] rename failed', err);
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      const supabase = createClient();
      const source = await getProject(supabase, id);
      if (!source) return;
      const copy = await duplicateProject(supabase, source);
      setProjects((prev) => [{ id: copy.id, name: copy.name, thumbnail_path: copy.thumbnail_path, updated_at: copy.updated_at }, ...prev]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code = (err as { code?: string } | null)?.code;
      if (code === '42501' || /row-level security|policy/i.test(message)) {
        setLimitReached(true);
      } else {
        console.error('[projects] duplicate failed', err);
      }
    }
  };

  const handleDelete = async (id: string) => {
    const prev = projects;
    setProjects((p) => p.filter((x) => x.id !== id));
    try {
      await deleteProject(createClient(), id);
    } catch (err) {
      console.error('[projects] delete failed', err);
      setProjects(prev);
    }
  };

  return (
    <main className="mx-auto max-w-[1200px] px-3 py-6 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <Link href="/projects" className="text-lg font-bold hover:underline">
          Promo Studio
        </Link>
        <UserMenu email={userEmail} />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Your projects</h1>
        <div className="flex gap-2">
          <Link href="/templates" className="rounded-xl border border-black/10 px-4 py-2.5 font-bold dark:border-white/10">
            Start from a template
          </Link>
          <button onClick={handleCreate} disabled={creating} className="rounded-xl bg-indigo-600 px-4 py-2.5 font-bold text-white disabled:opacity-50">
            {creating ? 'Creating…' : 'New project'}
          </button>
        </div>
      </div>

      {limitReached && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-indigo-50 px-4 py-3 text-[13.5px] dark:bg-indigo-500/10">
          <span>The Free plan includes 1 saved project. Upgrade to Pro for unlimited projects.</span>
          <Link href="/pricing" className="font-bold text-indigo-600 hover:underline dark:text-indigo-400">
            Upgrade to Pro
          </Link>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-black/15 p-10 text-center dark:border-white/15">
          <p className="text-[15px] font-semibold">No projects yet</p>
          <p className="mt-1 text-[13.5px] text-neutral-500 dark:text-neutral-400">Create your first promo video to get started.</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} thumbnailUrl={thumbnails[p.id] ?? null} onRename={handleRename} onDuplicate={handleDuplicate} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </main>
  );
}
