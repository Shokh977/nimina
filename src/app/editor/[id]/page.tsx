import { notFound, redirect } from 'next/navigation';

import EditorShell from '@/components/editor/EditorShell';
import type { Plan } from '@/lib/plan';
import { getProject } from '@/lib/supabase/projects';
import { createClient } from '@/lib/supabase/server';

export default async function EditorPage(props: PageProps<'/editor/[id]'>) {
  const { id } = await props.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/editor/${id}`);

  // RLS scopes this to the signed-in user's own rows, so a project owned by
  // someone else (or one that doesn't exist) both come back as no row.
  const project = await getProject(supabase, id);
  if (!project) notFound();

  const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle();
  const plan: Plan = profile?.plan === 'pro' ? 'pro' : 'free';

  return <EditorShell userEmail={user.email ?? ''} projectId={project.id} initialProject={project.data} plan={plan} />;
}
