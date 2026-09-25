import { redirect } from 'next/navigation';

import TemplatesShell from '@/components/templates/TemplatesShell';
import { listEnabledTemplates } from '@/lib/supabase/templates';
import { createClient } from '@/lib/supabase/server';

export default async function TemplatesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/templates');

  const templates = await listEnabledTemplates(supabase);

  return (
    <TemplatesShell
      userEmail={user.email ?? ''}
      templates={templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        category: t.category,
        swatch: t.swatch,
        durationSeconds: t.durationSeconds,
        slotCount: t.build().slots.length,
        previewVideo9x16: t.previewVideo9x16,
      }))}
    />
  );
}
