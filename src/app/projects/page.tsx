import { redirect } from 'next/navigation';

import type { DashboardProject } from '@/components/projects/dashboardData';
import ProjectsShell from '@/components/projects/ProjectsShell';
import type { Plan } from '@/lib/plan';
import { getSignedThumbnailUrl } from '@/lib/supabase/storage';
import { listProjects } from '@/lib/supabase/projects';
import { createClient } from '@/lib/supabase/server';
import { listEnabledTemplates, toMarketingCard } from '@/lib/supabase/templates';

function formatRelativeTime(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'Updated just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Updated yesterday';
  if (days < 7) return `Updated ${days}d ago`;
  return `Updated ${new Date(iso).toLocaleDateString()}`;
}

export default async function ProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/projects');

  const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle();
  const plan: Plan = profile?.plan === 'pro' ? 'pro' : 'free';

  const [rows, templateRows] = await Promise.all([listProjects(supabase), listEnabledTemplates(supabase)]);
  const projects: DashboardProject[] = await Promise.all(
    rows.map(async (row) => {
      const thumbnailUrl = await getSignedThumbnailUrl(supabase, row.thumbnail_path);
      return { id: row.id, name: row.name, status: thumbnailUrl ? 'rendered' : 'draft', meta: formatRelativeTime(row.updated_at), thumbnailUrl };
    }),
  );
  const templates = templateRows.map(toMarketingCard);

  return <ProjectsShell userEmail={user.email ?? ''} plan={plan} templates={templates} initialProjects={projects} />;
}
