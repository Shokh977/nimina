#!/usr/bin/env node
/**
 * One-off after migration 0019: records every file already in the private
 * R2 bucket in public.storage_objects, so existing users' usage is right
 * from the start. Safe to re-run (upserts by key).
 *
 *   node --env-file=.env.local scripts/backfill-storage-usage.mjs
 */
import { createClient } from '@supabase/supabase-js';

import { r2FromEnv } from './lib/r2.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const r2 = r2FromEnv();

const objects = (await r2.list(r2.bucketName('private'), '')).filter((o) => UUID.test(o.key.split('/')[0]));
const { data: users } = await supabase.auth.admin.listUsers({ perPage: 1000 });
const known = new Set(users.users.map((u) => u.id));
const rows = objects.filter((o) => known.has(o.key.split('/')[0])).map((o) => ({ key: o.key, user_id: o.key.split('/')[0], bytes: o.size }));
const orphans = objects.length - rows.length;

for (let i = 0; i < rows.length; i += 500) {
  const { error } = await supabase.from('storage_objects').upsert(rows.slice(i, i + 500));
  if (error) throw error;
}
const perUser = new Map();
for (const r of rows) perUser.set(r.user_id, (perUser.get(r.user_id) ?? 0) + r.bytes);
for (const [u, b] of perUser) console.log(`${u}: ${(b / 1048576).toFixed(2)} MB`);
console.log(`Recorded ${rows.length} files for ${perUser.size} user(s).${orphans ? ` ${orphans} file(s) belong to no existing user (left alone).` : ''}`);
