#!/usr/bin/env node
/**
 * Downloads one backup from R2 (default: the newest) and checks its sha256s.
 *   node --env-file=.env.local scripts/backup/fetch-backup.mjs [--date=YYYY-MM-DD] [--out=./restore]
 * Lists available backups with --list.
 */
import fs from 'node:fs';
import path from 'node:path';

import { backupR2, FILES, PREFIX, sha256 } from './common.mjs';

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const { r2, bucket } = backupR2();
const dates = [...new Set((await r2.list(bucket, PREFIX)).map((o) => o.key.slice(PREFIX.length).split('/')[0]))].sort();
if (process.argv.includes('--list')) {
  for (const d of dates) {
    const v = await r2.get(bucket, `${PREFIX}${d}/${FILES.verify}`);
    console.log(`${d}  ${v.ok ? ((await v.json()).ok ? 'restore verified' : 'RESTORE CHECK FAILED') : 'not verified'}`);
  }
  process.exit(0);
}
const date = arg('date') ?? dates.at(-1);
if (!date || !dates.includes(date)) throw new Error(`No backup for ${date ?? '(none)'}; available: ${dates.join(', ') || 'none'}`);
const out = arg('out') ?? `./restore-${date}`;
fs.mkdirSync(out, { recursive: true });
const files = {};
for (const name of Object.values(FILES)) {
  const res = await r2.get(bucket, `${PREFIX}${date}/${name}`);
  if (!res.ok) continue;
  files[name] = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(path.join(out, name), files[name]);
}
const manifest = JSON.parse(files[FILES.manifest].toString());
for (const [name, meta] of Object.entries(manifest.files)) if (sha256(files[name]) !== meta.sha256) throw new Error(`${name}: checksum mismatch`);
console.log(`Backup ${date} (taken ${manifest.createdAt}) saved to ${out}; checksums OK.`);
