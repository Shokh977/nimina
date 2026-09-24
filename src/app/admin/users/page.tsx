import UsersTable from '@/components/admin/UsersTable';
import { createClient } from '@/lib/supabase/server';

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const { data: profiles } = await supabase.from('profiles').select('id, email, plan, role, created_at').order('created_at', { ascending: false });
  const { data: projectCounts } = await supabase.from('projects').select('user_id');

  const counts = new Map<string, number>();
  (projectCounts ?? []).forEach((p) => counts.set(p.user_id, (counts.get(p.user_id) ?? 0) + 1));

  const users = (profiles ?? []).map((p) => ({ ...p, projectCount: counts.get(p.id) ?? 0 }));

  return (
    <div>
      <h1 className="text-2xl font-bold">Users</h1>
      <p className="mt-1 text-[13.5px] text-neutral-500 dark:text-neutral-400">{users.length} total.</p>
      <UsersTable initialUsers={users} />
    </div>
  );
}
