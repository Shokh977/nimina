import { redirect } from 'next/navigation';

import ProjectGallery from '@/components/editorV2/ProjectGallery';
import { createClient } from '@/lib/supabase/server';

export default async function Editor2Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/editor2');

  return <ProjectGallery userEmail={user.email ?? ''} />;
}
