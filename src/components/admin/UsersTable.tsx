'use client';

import { useState } from 'react';

import { createClient } from '@/lib/supabase/client';

interface AdminUserRow {
  id: string;
  email: string;
  plan: string;
  role: string;
  created_at: string;
  projectCount: number;
}

/** Plan/role edits go straight through Supabase from the browser — allowed
 * only because the caller is an admin (see is_admin()'s RLS policies in
 * 0010_admin.sql); a non-admin's identical call would be rejected by RLS
 * regardless of what this UI lets them click. */
export default function UsersTable({ initialUsers }: { initialUsers: AdminUserRow[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const setField = async (id: string, field: 'plan' | 'role', value: string) => {
    setBusyId(id);
    const prev = users;
    setUsers((u) => u.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
    const { error } = await createClient().from('profiles').update({ [field]: value }).eq('id', id);
    if (error) {
      console.error('[admin] update failed', error);
      setUsers(prev);
    }
    setBusyId(null);
  };

  const filtered = query.trim() ? users.filter((u) => u.email.toLowerCase().includes(query.trim().toLowerCase())) : users;

  return (
    <div className="mt-4">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by email…"
        className="mb-3 block w-full max-w-[320px] rounded-lg border border-black/10 bg-white px-2.5 py-2 text-[13.5px] dark:border-white/10 dark:bg-neutral-800"
      />
      <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead>
            <tr className="border-b border-black/10 bg-neutral-50 text-left dark:border-white/10 dark:bg-neutral-800/60">
              <th className="px-3 py-2 font-bold">Email</th>
              <th className="px-3 py-2 font-bold">Plan</th>
              <th className="px-3 py-2 font-bold">Role</th>
              <th className="px-3 py-2 font-bold">Projects</th>
              <th className="px-3 py-2 font-bold">Joined</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-b border-black/5 last:border-0 dark:border-white/5">
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2">
                  <select
                    value={u.plan}
                    disabled={busyId === u.id}
                    onChange={(e) => setField(u.id, 'plan', e.target.value)}
                    className="rounded-lg border border-black/10 bg-white px-2 py-1 text-[12.5px] dark:border-white/10 dark:bg-neutral-800"
                  >
                    <option value="free">free</option>
                    <option value="pro">pro</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select
                    value={u.role}
                    disabled={busyId === u.id}
                    onChange={(e) => setField(u.id, 'role', e.target.value)}
                    className="rounded-lg border border-black/10 bg-white px-2 py-1 text-[12.5px] dark:border-white/10 dark:bg-neutral-800"
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td className="px-3 py-2">{u.projectCount}</td>
                <td className="px-3 py-2 text-neutral-500 dark:text-neutral-400">{new Date(u.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
