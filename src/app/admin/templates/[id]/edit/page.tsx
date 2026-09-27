import { notFound } from 'next/navigation';

import { TemplateEditorShell } from '@/components/editor/EditorShell';
import { createClient } from '@/lib/supabase/server';
import type { TemplateData } from '@/lib/supabase/templates';

export default async function AdminTemplateEditPage(props: PageProps<'/admin/templates/[id]/edit'>) {
  const { id } = await props.params;

  // Auth + admin-role check already happened in src/app/admin/layout.tsx —
  // every /admin/** route inherits it.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: row } = await supabase.from('templates').select('id, name, data, sample_assets_source_id').eq('id', id).is('deleted_at', null).maybeSingle();
  if (!row) notFound();

  const data = row.data as TemplateData;

  return (
    <TemplateEditorShell
      userEmail={user?.email ?? ''}
      templateId={row.id}
      templateName={row.name ?? row.id}
      initialProject={data.project}
      initialSlots={data.slots}
      initialShortVariant={data.shortVariant}
      sampleAssetsSourceId={row.sample_assets_source_id}
    />
  );
}
