import { NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * "Export my data": a JSON file of the account record, plan and billing
 * records, every project (full editor data) and a list of the stored
 * files — the basis for answering a data-access request. Files are listed,
 * not embedded (they can be large).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const [profile, projects, subscriptions, purchases] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('projects').select('*').eq('user_id', user.id).order('created_at'),
    supabase.from('subscriptions').select('*').eq('user_id', user.id),
    supabase.from('purchases').select('*').eq('user_id', user.id),
  ]);

  const bucket = createAdminClient().storage.from('assets');
  const files: string[] = [];
  const { data: folders } = await bucket.list(user.id, { limit: 1000 });
  for (const folder of folders ?? []) {
    const { data: items } = await bucket.list(`${user.id}/${folder.name}`, { limit: 1000 });
    for (const item of items ?? []) files.push(`${user.id}/${folder.name}/${item.name}`);
  }

  const body = {
    exportedAt: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email,
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at,
      emailVerifiedAt: user.email_confirmed_at,
      displayName: user.user_metadata?.display_name ?? null,
      signInMethods: (user.identities ?? []).map((i) => ({ provider: i.provider, connectedAt: i.created_at })),
      hasPassword: !!user.app_metadata?.has_password,
    },
    profile: profile.data,
    subscriptions: subscriptions.data ?? [],
    purchases: purchases.data ?? [],
    projects: projects.data ?? [],
    storedFiles: files,
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="nimina-data-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
