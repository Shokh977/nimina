#!/usr/bin/env node
/**
 * Proves a backup restores: performs the README's restore procedure into a
 * scratch database and checks every table's row count against the counts
 * captured in the same snapshot as the dump. Exits non-zero on any
 * mismatch, and writes verify.json next to the backup.
 *
 * The procedure (README "Restoring a backup"), against a stand-in for a
 * fresh Supabase project:
 *   0. stand-in only: Supabase's roles, extensions and auth/storage schemas
 *      (from supabase-schemas.sql.gz) — a real Supabase project has these;
 *   1. apply supabase/migrations/*.sql in order (our schema);
 *   2. empty the public tables (migrations seed some rows);
 *   3. load data.sql.gz with session_replication_role = replica;
 *   4. compare row counts, and diff the restored public schema against the
 *      production public schema in the backup (drift between production and
 *      the repo's migrations).
 *
 * Env: SCRATCH_DB_URL (a superuser connection to a throwaway server; the
 * script creates and drops its own database), optional PG_BIN, and the
 * R2_BACKUP_* vars unless `--dir=<local backup dir>` is given.
 * Usage: verify-backup.mjs [--date=YYYY-MM-DD | latest] [--dir=path]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import pg from 'pg';

import { backupR2, bin, CHECKSUM_SQL, COUNT_SQL, FILES, PREFIX, run, sha256 } from './common.mjs';

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const scratchUrl = process.env.SCRATCH_DB_URL;
if (!scratchUrl) throw new Error('Missing SCRATCH_DB_URL');
const MIGRATIONS = fileURLToPath(new URL('../../supabase/migrations', import.meta.url));

// ---- fetch the backup
const files = {};
let where;
let r2ctx = null;
if (arg('dir')) {
  where = arg('dir');
  for (const name of Object.values(FILES)) if (fs.existsSync(path.join(where, name))) files[name] = fs.readFileSync(path.join(where, name));
} else {
  r2ctx = backupR2();
  let date = arg('date');
  if (!date || date === 'latest') {
    const dates = [...new Set((await r2ctx.r2.list(r2ctx.bucket, PREFIX)).map((o) => o.key.slice(PREFIX.length).split('/')[0]))].sort();
    date = dates.at(-1);
    if (!date) throw new Error('No backups found');
  }
  where = `${PREFIX}${date}/`;
  for (const name of [FILES.manifest, FILES.data, FILES.publicSchema, FILES.supabaseSchemas]) {
    const res = await r2ctx.r2.get(r2ctx.bucket, where + name);
    if (!res.ok) throw new Error(`Couldn't download ${where}${name}: ${res.status}`);
    files[name] = Buffer.from(await res.arrayBuffer());
  }
}
const manifest = JSON.parse(files[FILES.manifest].toString());
console.log(`Verifying backup ${where} (taken ${manifest.createdAt}, server ${manifest.serverVersion})`);
for (const [name, meta] of Object.entries(manifest.files)) {
  if (sha256(files[name]) !== meta.sha256) throw new Error(`${name}: checksum mismatch — the file is corrupt`);
}
console.log('Checksums OK');
// pg_dump on Windows writes CRLF; everything below expects LF.
const lf = (s) => s.replace(/\r\n/g, '\n');
const sql = (name) => lf(gunzipSync(files[name]).toString());

// ---- scratch database
const DB = 'nimina_restore_check';
const admin = new pg.Client({ connectionString: scratchUrl });
await admin.connect();
await admin.query(`drop database if exists ${DB} with (force)`);
await admin.query(`create database ${DB}`);
await admin.end();
const target = new URL(scratchUrl);
target.pathname = `/${DB}`;
const targetUrl = target.toString();
const psql = (input, extraEnv) => run(bin('psql'), ['--no-psqlrc', '--quiet', '-v', 'ON_ERROR_STOP=1', '-d', targetUrl], { input, env: extraEnv });

// 0. Stand-in for what every Supabase project already has.
const roles = ['anon', 'authenticated', 'service_role', 'authenticator', 'supabase_admin', 'supabase_auth_admin', 'supabase_storage_admin', 'dashboard_user', 'pgbouncer'];
await psql(`
  ${roles.map((r) => `do $$ begin create role ${r} nologin; exception when duplicate_object then null; end $$;`).join('\n')}
  create schema if not exists extensions;
  create extension if not exists pgcrypto with schema extensions;
  create extension if not exists "uuid-ossp" with schema extensions;
`);
// Every policy on Supabase's tables (a new project has none) and every
// trigger that calls our `public` schema (the signup trigger on
// auth.users) came from our migrations — step 1 creates them, so leave
// them out here.
const supabaseSchemas = sql(FILES.supabaseSchemas)
  .split(/\n(?=\n)/)
  .filter((block) => !/^CREATE POLICY\b/m.test(block) && !/^CREATE TRIGGER\b[\s\S]*\bpublic\./m.test(block))
  .join('\n');
await psql(supabaseSchemas);
console.log('0. Supabase stand-in ready (roles, extensions, auth + storage schemas)');

// 1. Our schema from the repo's migrations.
const migrations = fs.readdirSync(MIGRATIONS).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();
for (const f of migrations) await psql(fs.readFileSync(path.join(MIGRATIONS, f), 'utf8'));
console.log(`1. Applied ${migrations.length} migrations (${migrations[0]} … ${migrations.at(-1)})`);

// 2. Empty public tables (migration seed rows would collide with the data).
await psql(`do $$ declare t text; begin
  for t in select format('%I.%I', schemaname, tablename) from pg_tables where schemaname = 'public' loop
    execute 'truncate ' || t || ' cascade';
  end loop; end $$;`);
console.log('2. Emptied public tables');

// 3. Data, with triggers and foreign-key checks off while loading.
await psql(sql(FILES.data), { PGOPTIONS: '-c session_replication_role=replica' });
console.log('3. Loaded data');

// 4a. Row counts.
const c = new pg.Client({ connectionString: targetUrl });
await c.connect();
await c.query("set timezone = 'UTC'");
const restored = (await c.query(COUNT_SQL)).rows[0].counts;
const restoredSums = (await c.query(CHECKSUM_SQL)).rows[0].checksums;
await c.end();
const excluded = new Set(manifest.excludedFromData ?? []);
const tables = Object.keys(manifest.counts).filter((t) => !excluded.has(t)).sort();
const rows = tables.map((t) => ({
  table: t,
  expected: Number(manifest.counts[t]),
  restored: restored[t] === undefined ? null : Number(restored[t]),
  contentMatches: manifest.checksums ? manifest.checksums[t] === restoredSums[t] : null,
}));
const mismatches = rows.filter((r) => r.expected !== r.restored || r.contentMatches === false);
for (const r of rows) {
  const good = r.expected === r.restored && r.contentMatches !== false;
  const content = r.contentMatches === null ? '' : r.contentMatches ? 'content identical' : 'CONTENT DIFFERS';
  console.log(`   ${good ? 'ok  ' : 'DIFF'} ${r.table.padEnd(34)} ${String(r.expected).padStart(7)} -> ${String(r.restored ?? 'missing').padEnd(7)} ${content}`);
}

// 4b. Schema drift: restored public schema vs production's.
const normalize = (s) =>
  s
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('--') && !/^(SET|SELECT pg_catalog\.set_config)/.test(l) && !/^\\(un)?restrict /.test(l))
    // Indentation inside function bodies depends on how the SQL was pasted.
    .map((l) => l.trim())
    .join('\n');
const restoredSchema = normalize((await run(bin('pg_dump'), ['--schema-only', '--schema=public', '--no-owner', '--no-privileges', targetUrl])).stdout.toString().replace(/\r\n/g, '\n'));
const prodSchema = normalize(sql(FILES.publicSchema));
const prodLines = new Set(prodSchema.split('\n'));
const restoredLines = new Set(restoredSchema.split('\n'));
const onlyProd = [...prodLines].filter((l) => !restoredLines.has(l));
const onlyRestored = [...restoredLines].filter((l) => !prodLines.has(l));
const drift = onlyProd.length + onlyRestored.length;
console.log(drift ? `4. Schema drift: ${onlyProd.length} line(s) only in production, ${onlyRestored.length} only in the migrations` : '4. Restored public schema matches production exactly');
for (const l of onlyProd.slice(0, 15)) console.log(`   prod only:       ${l}`);
for (const l of onlyRestored.slice(0, 15)) console.log(`   migrations only: ${l}`);

const report = {
  verifiedAt: new Date().toISOString(),
  backup: where,
  ok: mismatches.length === 0,
  tables: rows.length,
  rows: rows.reduce((n, r) => n + r.expected, 0),
  mismatches,
  schemaDrift: { onlyInProduction: onlyProd, onlyInMigrations: onlyRestored },
};
if (r2ctx) await r2ctx.r2.put(r2ctx.bucket, where + FILES.verify, JSON.stringify(report, null, 2), 'application/json');
else fs.writeFileSync(path.join(where, FILES.verify), JSON.stringify(report, null, 2));

const admin2 = new pg.Client({ connectionString: scratchUrl });
await admin2.connect();
await admin2.query(`drop database if exists ${DB} with (force)`);
await admin2.end();

console.log(report.ok ? `\nRESTORE VERIFIED: ${rows.length} tables, ${report.rows} rows — every row count and every table's contents match.` : `\nRESTORE FAILED: ${mismatches.length} table(s) differ.`);
process.exitCode = report.ok ? 0 : 1;
