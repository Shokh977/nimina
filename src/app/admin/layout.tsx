import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import UserMenu from '@/components/auth/UserMenu';
import EngineFonts from '@/components/EngineFonts';
import { createClient } from '@/lib/supabase/server';

const NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/templates', label: 'Templates' },
  { href: '/admin/homepage', label: 'Homepage' },
  { href: '/admin/pricing', label: 'Pricing' },
  { href: '/admin/content', label: 'Content' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/admin');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  // 404, not a redirect-to-login or an "access denied" page — a non-admin
  // shouldn't be able to tell /admin exists at all versus any other
  // nonexistent route.
  if (profile?.role !== 'admin') notFound();

  // Engine fonts for every admin page, so a template previewed or
  // regenerated here renders exactly what users see in the editor.
  return (
    <div className="min-h-full">
      <EngineFonts />
      <div className="border-b border-black/10 dark:border-white/10">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-3 py-4 sm:px-6">
          <div className="flex items-baseline gap-6">
            <Link href="/projects" className="text-lg font-bold hover:underline">
              Nimina
            </Link>
            <nav className="flex gap-4">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="text-[13.5px] font-semibold text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <UserMenu email={user.email ?? ''} />
        </div>
      </div>
      <div className="mx-auto max-w-[1200px] px-3 py-6 sm:px-6">{children}</div>
    </div>
  );
}
