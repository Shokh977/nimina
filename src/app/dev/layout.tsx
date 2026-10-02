import { notFound } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

/**
 * Every /dev/* page is a development harness — several mount real editor
 * panels (export, localization) with the plan switchable to Pro and no
 * saved project behind them, which on a public deployment would hand out
 * the product for free. In production builds they 404 for everyone except
 * admins (same role check and same "doesn't exist" answer as /admin, so a
 * visitor can't tell the routes are there). `npm run dev` — what the
 * visual-regression and template-preview scripts drive — is unaffected.
 */
export default async function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) notFound();
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role !== 'admin') notFound();
  }
  return children;
}
