#!/usr/bin/env node
/**
 * After a manual restore: compares every table's row count and contents in
 * a database with the backup's manifest.json.
 *   node scripts/backup/check-restore.mjs --manifest=./restore-2026-10-04/manifest.json --db="postgres://..."
 */
import fs from 'node:fs';
import pg from 'pg';

import { CHECKSUM_SQL, COUNT_SQL } from './common.mjs';

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const manifest = JSON.parse(fs.readFileSync(arg('manifest'), 'utf8'));
const db = arg('db');
const client = new pg.Client({ connectionString: db, ssl: /localhost|127\.0\.0\.1/.test(db) ? false : { rejectUnauthorized: false } });
await client.connect();
await client.query("set timezone = 'UTC'");
const counts = (await client.query(COUNT_SQL)).rows[0].counts;
const sums = (await client.query(CHECKSUM_SQL)).rows[0].checksums;
await client.end();
const excluded = new Set(manifest.excludedFromData ?? []);
let bad = 0;
for (const t of Object.keys(manifest.counts).filter((t) => !excluded.has(t)).sort()) {
  const ok = Number(manifest.counts[t]) === Number(counts[t]) && (!manifest.checksums || manifest.checksums[t] === sums[t]);
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'DIFF'} ${t.padEnd(34)} ${manifest.counts[t]} -> ${counts[t] ?? 'missing'}${ok ? '' : manifest.checksums?.[t] !== sums[t] ? ' (contents differ)' : ''}`);
}
console.log(bad ? `${bad} table(s) differ.` : 'All tables match the backup.');
process.exitCode = bad ? 1 : 0;
