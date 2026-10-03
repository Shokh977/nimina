import { PLAN_LIMITS, type Plan } from '@/lib/plan';
import { r2 } from '@/lib/r2/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { StorageUsage } from './rules';

export type { StorageUsage };

/**
 * SERVER-ONLY. Per-user storage accounting (supabase/migrations/0019).
 * Every private file is recorded in public.storage_objects when its upload
 * is approved; reserve() is the server-side limit check.
 */

/** Files newer than this are never cleaned up — the editor uploads a file a
 * moment before the autosave that references it lands in the project. */
const CLEANUP_GRACE_MS = 60 * 60 * 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function planOf(userId: string): Promise<Plan> {
  const { data } = await createAdminClient().from('profiles').select('plan').eq('id', userId).maybeSingle();
  return data?.plan === 'pro' ? 'pro' : 'free';
}

export async function getUsage(userId: string): Promise<StorageUsage> {
  const admin = createAdminClient();
  const [plan, { data, error }] = await Promise.all([planOf(userId), admin.rpc('storage_used', { p_user_id: userId })]);
  if (error) throw new Error(`storage_used: ${error.message}`);
  return { used: Number(data ?? 0), limit: PLAN_LIMITS[plan].maxStorageBytes, plan };
}

/** Records `files` for the user if that stays within their plan's limit
 * (atomic, see reserve_storage). Overwritten keys don't count twice. */
export async function reserve(userId: string, files: { key: string; bytes: number }[]): Promise<{ ok: boolean; usage: StorageUsage; needed: number }> {
  const plan = await planOf(userId);
  const limit = PLAN_LIMITS[plan].maxStorageBytes;
  const { data, error } = await createAdminClient().rpc('reserve_storage', {
    p_user_id: userId,
    p_keys: files.map((f) => f.key),
    p_bytes: files.map((f) => f.bytes),
    p_limit: limit,
  });
  if (error) throw new Error(`reserve_storage: ${error.message}`);
  const row = (data as { ok: boolean; used: number; needed: number }[])[0];
  const used = Number(row.used);
  return { ok: row.ok, usage: { used: row.ok ? used + Number(row.needed) : used, limit, plan }, needed: Number(row.needed) };
}

/** Forgets every file under a key prefix (after deleting them from R2). */
export async function forgetPrefix(userId: string, prefix: string): Promise<void> {
  const { error } = await createAdminClient().from('storage_objects').delete().eq('user_id', userId).like('key', `${prefix.replace(/[\\%_]/g, '\\$&')}%`);
  if (error) throw new Error(`forgetting ${prefix}: ${error.message}`);
}

/**
 * Re-syncs the user's records with what is really in R2, first deleting
 * files nothing uses any more (older than an hour):
 *  - files in one of the user's projects whose id appears nowhere in that
 *    project's saved data (a replaced screenshot, a deleted slide) — the
 *    thumbnail is always kept;
 *  - whole folders for projects that no longer exist (uuid-named folders
 *    only — template folders, named by slug, are never touched).
 * Matching on "the id appears anywhere in the project JSON" rather than a
 * list of known fields means a new kind of asset reference can never get a
 * live file deleted.
 */
export async function recount(userId: string): Promise<StorageUsage> {
  const store = r2();
  const bucket = store.bucketName('private');
  const admin = createAdminClient();
  const [objects, { data: projects, error }] = await Promise.all([store.list(bucket, `${userId}/`), admin.from('projects').select('id, data').eq('user_id', userId)]);
  if (error) throw new Error(`loading projects: ${error.message}`);
  const projectJson = new Map((projects ?? []).map((p) => [p.id as string, JSON.stringify(p.data ?? {})]));

  const now = Date.now();
  const keep: typeof objects = [];
  const remove: string[] = [];
  for (const o of objects) {
    const [, folder, ...rest] = o.key.split('/');
    const name = rest.join('/');
    const old = now - o.lastModified.getTime() > CLEANUP_GRACE_MS;
    const json = projectJson.get(folder);
    const unused = json !== undefined ? name !== 'thumbnail.jpg' && !json.includes(name) : UUID.test(folder);
    if (old && unused) remove.push(o.key);
    else keep.push(o);
  }
  for (let i = 0; i < remove.length; i += 10) await Promise.all(remove.slice(i, i + 10).map((k) => store.delete(bucket, k)));

  // Drop records for files that aren't in R2 — except fresh ones, which may
  // be uploads the browser is still sending.
  const present = new Set(keep.map((o) => o.key));
  const { data: rows, error: rowsErr } = await admin.from('storage_objects').select('key, created_at').eq('user_id', userId);
  if (rowsErr) throw new Error(`recount: ${rowsErr.message}`);
  const stale = (rows ?? []).filter((r) => !present.has(r.key) && now - new Date(r.created_at).getTime() > CLEANUP_GRACE_MS).map((r) => r.key as string);
  for (let i = 0; i < stale.length; i += 200) {
    const { error: delErr } = await admin.from('storage_objects').delete().in('key', stale.slice(i, i + 200));
    if (delErr) throw new Error(`recount: ${delErr.message}`);
  }
  if (keep.length) {
    const { error: insErr } = await admin.from('storage_objects').upsert(keep.map((o) => ({ key: o.key, user_id: userId, bytes: o.size })));
    if (insErr) throw new Error(`recount: ${insErr.message}`);
  }
  if (remove.length) console.log(`[storage] cleaned up ${remove.length} unused file(s) for ${userId}`);
  return getUsage(userId);
}
