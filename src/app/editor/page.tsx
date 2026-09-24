import { redirect } from 'next/navigation';

import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createProject } from '@/lib/supabase/projects';
import { createClient } from '@/lib/supabase/server';

/**
 * Bare /editor has nothing to render on its own — it creates a fresh
 * project row and redirects to /editor/[id], which is the actual editor.
 * Skipped (redirects straight to /projects, itself a no-op until Supabase
 * is configured — see isSupabaseConfigured docs) while Supabase isn't set up.
 */
export default async function NewEditorPage() {
  if (!isSupabaseConfigured()) redirect('/login');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/editor');

  const project = await createProject(supabase);
  redirect(`/editor/${project.id}`);
}
