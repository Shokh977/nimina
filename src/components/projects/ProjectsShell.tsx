'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import type { Plan } from '@/lib/plan';
import { instrumentSans, spaceGrotesk } from '@/lib/fonts';
import { createClient } from '@/lib/supabase/client';
import { createProject, deleteProject, duplicateProject, getProject } from '@/lib/supabase/projects';
import type { MarketingTemplateCard } from '@/lib/supabase/templates';
import DashboardFooter from './DashboardFooter';
import DashboardHeader from './DashboardHeader';
import type { DashboardProject } from './dashboardData';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import EmptyState from './EmptyState';
import NewProjectTile from './NewProjectTile';
import PlanUsageBanner from './PlanUsageBanner';
import ProjectGridCard from './ProjectGridCard';
import ProjectListRow from './ProjectListRow';
import TemplateStrip from './TemplateStrip';
import Toolbar, { type StatusTab, type ViewMode } from './Toolbar';

const VIEW_STORAGE_KEY = 'promo-studio:projects-view';

export default function ProjectsShell({ userEmail, plan, templates, initialProjects }: { userEmail: string; plan: Plan; templates: MarketingTemplateCard[]; initialProjects: DashboardProject[] }) {
  const router = useRouter();
  const [projects, setProjects] = useState<DashboardProject[]>(initialProjects);
  // The server component (src/app/projects/page.tsx) re-fetches on every
  // navigation to this route — router.refresh() after a mutation re-runs
  // it and delivers fresh `initialProjects` here. Re-deriving local state
  // during render (React's documented pattern for "adjusting state when a
  // prop changes") instead of an effect, which would cost an extra render.
  const [syncedFrom, setSyncedFrom] = useState(initialProjects);
  if (initialProjects !== syncedFrom) {
    setSyncedFrom(initialProjects);
    setProjects(initialProjects);
  }
  const [activeTab, setActiveTab] = useState<StatusTab>('all');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('grid');
  const [deleteTarget, setDeleteTarget] = useState<DashboardProject | null>(null);
  const [creating, setCreating] = useState(false);
  const [limitReached, setLimitReached] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    // One-time client-only mount read (localStorage isn't available during
    // SSR) — matches /dev/engine/page.tsx's identical pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored === 'grid' || stored === 'list') setView(stored);
  }, []);

  const setViewPersisted = (v: ViewMode) => {
    setView(v);
    window.localStorage.setItem(VIEW_STORAGE_KEY, v);
  };

  const counts = useMemo(
    () => ({
      all: projects.length,
      draft: projects.filter((p) => p.status === 'draft').length,
      rendered: projects.filter((p) => p.status === 'rendered').length,
    }),
    [projects],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => (activeTab === 'all' || p.status === activeTab) && (!q || p.name.toLowerCase().includes(q)));
  }, [projects, activeTab, search]);

  const clearFilters = () => {
    setSearch('');
    setActiveTab('all');
  };

  const handleCreate = async () => {
    setCreating(true);
    setLimitReached(false);
    try {
      const supabase = createClient();
      const project = await createProject(supabase);
      router.push(`/editor/${project.id}`);
    } catch (err) {
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

  const handleDuplicate = async (id: string) => {
    try {
      const supabase = createClient();
      const source = await getProject(supabase, id);
      if (source) await duplicateProject(supabase, source);
      router.refresh();
    } catch (err) {
      console.error('[projects] duplicate failed', err);
    }
  };

  const handleDelete = async (id: string) => {
    const prev = projects;
    setProjects((p) => p.filter((proj) => proj.id !== id));
    setDeleteTarget(null);
    try {
      await deleteProject(createClient(), id);
    } catch (err) {
      console.error('[projects] delete failed', err);
      setProjects(prev);
    }
  };

  return (
    <div className={`${spaceGrotesk.variable} ${instrumentSans.variable} min-h-full bg-[#08090c] text-[#f4f5f8]`} style={{ fontFamily: 'var(--font-instrument-sans), "Instrument Sans", system-ui, sans-serif' }}>
      <DashboardHeader userEmail={userEmail} plan={plan} />

      <main className="mx-auto max-w-[1320px] px-6 pt-9 pb-24">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold tracking-[.14em] text-[#8b7dff] uppercase">Workspace</p>
            <h1 className="mt-2 font-[family-name:var(--font-space-grotesk)] text-[clamp(30px,3.6vw,42px)] leading-[1.05] font-bold tracking-[-.025em] text-[#f4f5f8]">Your projects</h1>
            <p className="mt-2 text-[15.5px] text-[#9aa1af]">
              {visible.length} of {counts.all} projects · {counts.rendered} rendered
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <a
              href="/templates"
              className="rounded-xl border border-white/[.16] bg-white/[.03] px-5 py-2.5 text-[14px] font-semibold text-[#f4f5f8] transition-colors hover:bg-white/[.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]"
            >
              Start from a template
            </a>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="rounded-xl bg-[#5b4bff] px-5 py-2.5 text-[14px] font-semibold text-white shadow-[0_12px_30px_rgba(91,75,255,.4)] transition-colors hover:bg-[#6d5eff] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]"
            >
              {creating ? 'Creating…' : 'New project'}
            </button>
          </div>
        </div>

        {limitReached && (
          <p className="mt-3 text-[13.5px] font-semibold text-[#ff8f76]">
            The Free plan includes 1 saved project.{' '}
            <a href="/pricing" className="underline">
              Upgrade to Pro
            </a>{' '}
            to create more.
          </p>
        )}

        <div className="mt-7">
          {plan === 'free' && <PlanUsageBanner />}

          <Toolbar activeTab={activeTab} onTabChange={setActiveTab} counts={counts} search={search} onSearchChange={setSearch} view={view} onViewChange={setViewPersisted} />

          {visible.length === 0 ? (
            <EmptyState filtered={activeTab !== 'all' || search.trim() !== ''} query={search} onClear={clearFilters} />
          ) : view === 'grid' ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-5">
              {visible.map((p) => (
                <ProjectGridCard key={p.id} project={p} onOpen={() => router.push(`/editor/${p.id}`)} onDuplicate={() => handleDuplicate(p.id)} onDelete={() => setDeleteTarget(p)} />
              ))}
              <NewProjectTile onClick={handleCreate} creating={creating} />
            </div>
          ) : (
            <div className="divide-y divide-white/[.06] overflow-hidden rounded-2xl border border-white/[.08] bg-[#11131a]">
              {visible.map((p) => (
                <ProjectListRow key={p.id} project={p} onOpen={() => router.push(`/editor/${p.id}`)} onDuplicate={() => handleDuplicate(p.id)} onDelete={() => setDeleteTarget(p)} />
              ))}
            </div>
          )}
        </div>

        <TemplateStrip templates={templates} />
      </main>

      <DashboardFooter />

      {deleteTarget && <DeleteConfirmDialog name={deleteTarget.name} onConfirm={() => handleDelete(deleteTarget.id)} onCancel={() => setDeleteTarget(null)} />}
    </div>
  );
}
