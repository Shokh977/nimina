import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import AccountShell, { type AccountData } from '@/components/account/AccountShell';
import { instrumentSans, spaceGrotesk } from '@/lib/fonts';
import { subscriptionGrantsAccess } from '@/lib/paddle/access';
import { isR2Configured } from '@/lib/r2/server';
import { recount } from '@/lib/storage/usage';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Account settings', robots: { index: false } };

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/account');

  const [{ data: profile }, { data: subs }, { data: purchase }] = await Promise.all([
    supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle(),
    supabase.from('subscriptions').select('status, current_period_end, scheduled_change_action, scheduled_change_at').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(1),
    supabase.from('purchases').select('purchased_at').eq('user_id', user.id).limit(1).maybeSingle(),
  ]);
  const sub = subs?.[0] ?? null;
  // Recount on view, so the figure is exact (and unused files are cleaned up).
  const storage = isR2Configured() ? await recount(user.id).catch((err) => (console.error('[account] storage recount failed', err), null)) : null;

  const data: AccountData = {
    email: user.email ?? '',
    newEmailPending: user.new_email ?? null,
    displayName: (user.user_metadata?.display_name as string | undefined) ?? '',
    avatarUrl: (user.user_metadata?.avatar_url as string | undefined) ?? (user.user_metadata?.picture as string | undefined) ?? null,
    hasPassword: !!user.app_metadata?.has_password,
    identities: (user.identities ?? []).map((i) => ({ id: i.identity_id, provider: i.provider, email: (i.identity_data?.email as string | undefined) ?? null, createdAt: i.created_at ?? null })),
    plan: profile?.plan === 'pro' ? 'pro' : 'free',
    lifetime: purchase ? { since: purchase.purchased_at } : null,
    subscription: sub
      ? {
          status: sub.status,
          active: subscriptionGrantsAccess(sub.status),
          periodEnd: sub.current_period_end,
          endsAt: sub.scheduled_change_action === 'cancel' ? sub.scheduled_change_at : null,
        }
      : null,
    storage,
  };

  return (
    <div className={`${spaceGrotesk.variable} ${instrumentSans.variable} min-h-full bg-[#08090c] text-[#f4f5f8]`} style={{ fontFamily: 'var(--font-instrument-sans), "Instrument Sans", system-ui, sans-serif' }}>
      <AccountShell data={data} />
    </div>
  );
}
