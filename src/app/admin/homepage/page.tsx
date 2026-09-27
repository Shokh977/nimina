import HomepageContentManager from '@/components/admin/homepage/HomepageContentManager';
import { createClient } from '@/lib/supabase/server';
import { listEnabledTemplates } from '@/lib/supabase/templates';

export default async function AdminHomepagePage() {
  const supabase = await createClient();
  const [{ data: rows }, templateRows] = await Promise.all([supabase.from('site_content').select('key, data'), listEnabledTemplates(supabase)]);
  const templates = templateRows.map((t) => ({ id: t.id, name: t.name }));

  return (
    <div>
      <h1 className="text-2xl font-bold">Homepage</h1>
      <p className="mt-1 text-[13.5px] text-neutral-500 dark:text-neutral-400">Edit the marketing homepage&apos;s copy — changes go live immediately, no deploy needed.</p>
      <HomepageContentManager initialRows={rows ?? []} templates={templates} />
    </div>
  );
}
