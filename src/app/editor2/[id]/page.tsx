import { notFound, redirect } from 'next/navigation';

import EditorV2Shell from '@/components/editorV2/EditorV2Shell';
import type { Plan } from '@/lib/plan';
import { getProjectV2 } from '@/lib/supabase/projectsV2';
import { createClient } from '@/lib/supabase/server';

export default async function Editor2ProjectPage(props: PageProps<'/editor2/[id]'>) {
  const { id } = await props.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/editor2/${id}`);

  // RLS scopes this to the signed-in user's own rows; getProjectV2 also
  // filters engine='v2' server-side, so a classic-engine project's id
  // opened here comes back as no row too (its own /editor/[id] route is
  // where it opens — see ProjectGallery.tsx's "Legacy" section).
  const project = await getProjectV2(supabase, id);
  if (!project) notFound();

  const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle();
  const plan: Plan = profile?.plan === 'pro' ? 'pro' : 'free';

  return <EditorV2Shell userEmail={user.email ?? ''} projectId={project.id} initialProject={project.data} plan={plan} />;
}
