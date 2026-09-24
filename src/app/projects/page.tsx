import { redirect } from 'next/navigation';

import ProjectsShell from '@/components/projects/ProjectsShell';
import { listProjects } from '@/lib/supabase/projects';
import { createClient } from '@/lib/supabase/server';

export default async function ProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/projects');

  const projects = await listProjects(supabase);

  return <ProjectsShell userEmail={user.email ?? ''} initialProjects={projects} />;
}
