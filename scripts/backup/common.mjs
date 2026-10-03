/**
 * Shared bits for scripts/backup/*.mjs (run by .github/workflows/db-backup.yml;
 * see README "Database backups").
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

import { R2 } from '../../src/lib/r2/core.ts';

export const KEEP_WEEKLY = 8;
export const PREFIX = 'weekly/';

/** Files in one backup. */
export const FILES = {
  /** Data of every table in `public` and `auth` (users, identities, …). Loaded into a schema built by the repo's migrations. */
  data: 'data.sql.gz',
  /** Schema of `public` exactly as it was in production — reference / drift check. */
  publicSchema: 'public-schema.sql.gz',
  /** Schema of Supabase's own `auth` and `storage` — only to stand in for a Supabase project in the scratch restore check. */
  supabaseSchemas: 'supabase-schemas.sql.gz',
  manifest: 'manifest.json',
  verify: 'verify.json',
};

/** auth tables whose rows belong to Supabase's own bookkeeping, not to users. */
export const DATA_EXCLUDE = ['auth.schema_migrations'];

export function backupR2() {
  const env = process.env;
  const missing = ['R2_ACCOUNT_ID', 'R2_BACKUP_ACCESS_KEY_ID', 'R2_BACKUP_SECRET_ACCESS_KEY', 'R2_BACKUP_BUCKET'].filter((k) => !env[k]);
  if (missing.length) throw new Error(`Missing ${missing.join(', ')}`);
  const bucket = env.R2_BACKUP_BUCKET;
  const r2 = new R2({ accountId: env.R2_ACCOUNT_ID, accessKeyId: env.R2_BACKUP_ACCESS_KEY_ID, secretAccessKey: env.R2_BACKUP_SECRET_ACCESS_KEY, privateBucket: bucket, publicBucket: bucket, publicUrl: '' });
  return { r2, bucket };
}

/** Runs a command; resolves with stdout, rejects with stderr on a non-zero exit. */
export function run(cmd, args, { env, input } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env: { ...process.env, PGCLIENTENCODING: 'UTF8', ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
    const out = [];
    const err = [];
    child.stdout.on('data', (d) => out.push(d));
    child.stderr.on('data', (d) => err.push(d));
    child.on('error', reject);
    // If the program exits early (e.g. psql stopping on an error), writing
    // the rest of its input fails — ignore that; the exit code and stderr
    // in 'close' carry the real error.
    child.stdin.on('error', () => {});
    child.on('close', (code) => {
      const stderr = Buffer.concat(err).toString();
      if (code === 0) resolve({ stdout: Buffer.concat(out), stderr });
      else reject(new Error(`${cmd} ${args.filter((a) => !a.startsWith('postgres')).join(' ')} exited ${code}:\n${stderr}`));
    });
    if (input !== undefined) child.stdin.end(input);
    else child.stdin.end();
  });
}

export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/** `pg_dump`/`psql` from PG_BIN (a directory) when set, else from PATH. */
export function bin(name) {
  const dir = process.env.PG_BIN;
  return dir ? `${dir.replace(/[\\/]+$/, '')}/${name}${process.platform === 'win32' ? '.exe' : ''}` : name;
}

/** Row count of every table in public and auth, as one JSON object. */
export const COUNT_SQL = `
  select coalesce(jsonb_object_agg(t, n), '{}'::jsonb) as counts from (
    select format('%I.%I', schemaname, tablename) as t,
           (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from %I.%I', schemaname, tablename), false, true, '')))[1]::text::bigint as n
    from pg_tables
    where schemaname in ('public', 'auth')
  ) s`;

/** md5 of every table's full contents (rows as text, sorted), as one JSON
 * object — proves the restored data is identical, not just the same size.
 * Run with `set timezone = 'UTC'` so timestamps print the same way. */
export const CHECKSUM_SQL = `
  select coalesce(jsonb_object_agg(t, h), '{}'::jsonb) as checksums from (
    select format('%I.%I', schemaname, tablename) as t,
           (xpath('/row/h/text()', query_to_xml(format('select coalesce(md5(string_agg(x::text, E''\n'' order by x::text)), '''') as h from %I.%I x', schemaname, tablename), false, true, '')))[1]::text as h
    from pg_tables
    where schemaname in ('public', 'auth')
  ) s`;

/** Deletes all but the newest `keep` backup folders (named YYYY-MM-DD)
 * under `prefix`; returns the dates kept, newest first. */
export async function applyRetention(r2, bucket, prefix, keep) {
  const folders = [...new Set((await r2.list(bucket, prefix)).map((o) => o.key.slice(prefix.length).split('/')[0]))].sort().reverse();
  for (const old of folders.slice(keep)) {
    const n = await r2.deletePrefix(bucket, `${prefix}${old}/`);
    console.log(`Deleted old backup ${old} (${n} files)`);
  }
  return folders.slice(0, keep);
}
