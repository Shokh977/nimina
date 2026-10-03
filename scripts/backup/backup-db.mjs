#!/usr/bin/env node
/**
 * Weekly database backup: pg_dump of production to the private R2 backup
 * bucket, keeping the newest 8. Every dump and the row counts it is checked
 * against come from ONE database snapshot (pg_export_snapshot), so the
 * restore check can demand exact equality.
 *
 *   weekly/<YYYY-MM-DD>/data.sql.gz              public + auth table data
 *   weekly/<YYYY-MM-DD>/public-schema.sql.gz     public schema as in production
 *   weekly/<YYYY-MM-DD>/supabase-schemas.sql.gz  auth + storage schema (restore check only)
 *   weekly/<YYYY-MM-DD>/manifest.json            row counts, versions, sizes, sha256
 *
 * Env: SUPABASE_DB_URL (session pooler URI), R2_ACCOUNT_ID,
 * R2_BACKUP_ACCESS_KEY_ID, R2_BACKUP_SECRET_ACCESS_KEY, R2_BACKUP_BUCKET;
 * optional PG_BIN. `--out=<dir>` writes the files locally instead of to R2.
 */
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import pg from 'pg';

import { applyRetention, backupR2, bin, CHECKSUM_SQL, COUNT_SQL, DATA_EXCLUDE, FILES, KEEP_WEEKLY, PREFIX, run, sha256 } from './common.mjs';

const outArg = process.argv.find((a) => a.startsWith('--out='))?.slice(6);
const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) throw new Error('Missing SUPABASE_DB_URL');

const client = new pg.Client({ connectionString: dbUrl, ssl: /localhost|127\.0\.0\.1/.test(dbUrl) ? false : { rejectUnauthorized: false } });
await client.connect();
const serverVersion = (await client.query('show server_version')).rows[0].server_version;

// Hold one snapshot open for the counts and all three dumps.
await client.query('begin isolation level repeatable read read only');
const snapshot = (await client.query('select pg_export_snapshot() as s')).rows[0].s;
await client.query("set timezone = 'UTC'");
const counts = (await client.query(COUNT_SQL)).rows[0].counts;
const checksums = (await client.query(CHECKSUM_SQL)).rows[0].checksums;

const dump = async (args) => gzipSync((await run(bin('pg_dump'), ['--snapshot', snapshot, '--no-owner', '--no-privileges', ...args, dbUrl])).stdout, { level: 9 });
const files = {
  [FILES.data]: await dump(['--data-only', '--schema=public', '--schema=auth', ...DATA_EXCLUDE.map((t) => `--exclude-table=${t}`)]),
  [FILES.publicSchema]: await dump(['--schema-only', '--schema=public']),
  [FILES.supabaseSchemas]: await dump(['--schema-only', '--schema=auth', '--schema=storage']),
};
await client.query('commit');
await client.end();

const pgDumpVersion = (await run(bin('pg_dump'), ['--version'])).stdout.toString().trim();
const date = new Date().toISOString().slice(0, 10);
const manifest = {
  createdAt: new Date().toISOString(),
  serverVersion,
  pgDumpVersion,
  excludedFromData: DATA_EXCLUDE,
  counts,
  checksums,
  files: Object.fromEntries(Object.entries(files).map(([name, buf]) => [name, { bytes: buf.length, sha256: sha256(buf) }])),
};
const total = Object.values(files).reduce((n, b) => n + b.length, 0);
console.log(`Dumped ${Object.keys(counts).length} tables (${Object.values(counts).reduce((a, b) => a + Number(b), 0)} rows), ${(total / 1024).toFixed(0)} KB compressed; server ${serverVersion}, ${pgDumpVersion}`);

if (outArg) {
  fs.mkdirSync(outArg, { recursive: true });
  for (const [name, buf] of Object.entries(files)) fs.writeFileSync(path.join(outArg, name), buf);
  fs.writeFileSync(path.join(outArg, FILES.manifest), JSON.stringify(manifest, null, 2));
  console.log(`Wrote backup to ${outArg}`);
  process.exit(0);
}

const { r2, bucket } = backupR2();
const folder = `${PREFIX}${date}/`;
for (const [name, buf] of Object.entries(files)) await r2.put(bucket, folder + name, buf, 'application/gzip');
await r2.put(bucket, folder + FILES.manifest, JSON.stringify(manifest, null, 2), 'application/json');
console.log(`Uploaded to r2://${bucket}/${folder}`);

// Retention: keep the newest KEEP_WEEKLY backups, delete older ones.
const kept = await applyRetention(r2, bucket, PREFIX, KEEP_WEEKLY);
console.log(`Keeping ${kept.length} backup(s): ${kept.join(', ')}`);
// Hand the date to the verify step in CI.
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `date=${date}\n`);
