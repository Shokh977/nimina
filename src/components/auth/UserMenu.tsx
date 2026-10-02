'use client';

import { useRouter } from 'next/navigation';

import { createClient } from '@/lib/supabase/client';

export default function UserMenu({ email }: { email: string }) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3 text-[13px]">
      <span className="max-w-[180px] truncate text-neutral-500 dark:text-neutral-400">{email}</span>
      <a href="/account" className="rounded-lg border border-black/10 px-2.5 py-1.5 font-semibold dark:border-white/10">
        Account
      </a>
      <a href="/api/paddle/portal" className="rounded-lg border border-black/10 px-2.5 py-1.5 font-semibold dark:border-white/10">
        Manage subscription
      </a>
      <button onClick={signOut} className="rounded-lg border border-black/10 px-2.5 py-1.5 font-semibold dark:border-white/10">
        Sign out
      </button>
    </div>
  );
}
