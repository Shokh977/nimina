#!/usr/bin/env node
/**
 * Copies every file from Supabase Storage to Cloudflare R2 and repoints the
 * stored template preview URLs. Safe to re-run: files already in R2 with
 * the same size are skipped, and nothing in Supabase is ever deleted.
 *
 *   assets/<user>/<project>/<file>   -> private bucket  <user>/<project>/<file>
 *   music-library/<file>             -> public bucket   music-library/<file>
 *   template-previews/<id>/<file>    -> public bucket   template-previews/<id>/<file>
 *
 * Usage (needs the Supabase service-role key and the R2_* vars in .env.local):
 *   node --env-file=.env.local scripts/migrate-storage-to-r2.mjs           # dry run: counts only
 *   node --env-file=.env.local scripts/migrate-storage-to-r2.mjs --apply   # copy + rewrite URLs
 *   node --env-file=.env.local scripts/migrate-storage-to-r2.mjs --verify  # check every file + URL
 */
import { createClient } from '@supabase/supabase-js';

import { r2FromEnv } from './lib/r2.mjs';

const APPLY = process.argv.includes('--apply');
const VERIFY = process.argv.includes('--verify');

const SOURCES = [
  { bucket: 'assets', target: 'private', prefix: '' },
  { bucket: 'music-library', target: 'public', prefix: 'music-library/' },
  { bucket: 'template-previews', target: 'public', prefix: 'template-previews/' },
];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local.');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const r2 = r2FromEnv();

/** Every file (not folder) in a Supabase bucket, recursively. */
async function listAll(bucket, folder = '') {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(bucket).list(folder, { limit: 1000, offset });
    if (error) {
      if (/not found/i.test(error.message)) return out;
      throw new Error(`listing ${bucket}/${folder}: ${error.message}`);
    }
    for (const item of data) {
      const path = folder ? `${folder}/${item.name}` : item.name;
      if (item.id === null) out.push(...(await listAll(bucket, path)));
      else out.push({ path, size: item.metadata?.size ?? 0, type: item.metadata?.mimetype ?? 'application/octet-stream' });
    }
    if (data.length < 1000) return out;
  }
}

function oldPublicPrefix(bucket) {
  return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${bucket}/`;
}

async function migrateFiles() {
  let copied = 0, skipped = 0, failed = 0, bytes = 0, missing = 0;
  for (const src of SOURCES) {
    const files = await listAll(src.bucket);
    const total = files.reduce((n, f) => n + f.size, 0);
    console.log(`\n${src.bucket}: ${files.length} files, ${(total / 1048576).toFixed(1)} MB -> R2 ${src.target} bucket${src.prefix ? ` under ${src.prefix}` : ''}`);
    const targetBucket = r2.bucketName(src.target);
    for (const f of files) {
      const key = src.prefix + f.path;
      try {
        const existing = await r2.head(targetBucket, key);
        if (existing && existing.size === f.size) {
          skipped++;
          continue;
        }
        if (VERIFY) {
          missing++;
          console.error(`  MISSING/DIFFERENT in R2: ${key} (supabase ${f.size} B, r2 ${existing ? existing.size + ' B' : 'none'})`);
          continue;
        }
        if (!APPLY) {
          copied++;
          bytes += f.size;
          continue;
        }
        const { data, error } = await supabase.storage.from(src.bucket).download(f.path);
        if (error) throw new Error(error.message);
        const buf = new Uint8Array(await data.arrayBuffer());
        await r2.put(targetBucket, key, buf, f.type, src.target === 'public' ? 'public, max-age=31536000' : undefined);
        copied++;
        bytes += f.size;
        console.log(`  copied ${key} (${(f.size / 1024).toFixed(0)} KB)`);
      } catch (err) {
        failed++;
        console.error(`  FAILED ${key}: ${err.message}`);
      }
    }
  }
  const verb = APPLY ? 'copied' : 'to copy';
  console.log(`\nFiles: ${copied} ${verb} (${(bytes / 1048576).toFixed(1)} MB), ${skipped} already in R2, ${failed} failed${VERIFY ? `, ${missing} missing` : ''}.`);
  return failed + missing;
}

async function migrateTemplateUrls() {
  const { data, error } = await supabase.from('templates').select('id, preview_video_9x16_url, preview_video_16x9_url');
  if (error) throw new Error(`reading templates: ${error.message}`);
  const oldPrefix = oldPublicPrefix('template-previews');
  let changed = 0, problems = 0;
  for (const row of data) {
    const update = {};
    for (const col of ['preview_video_9x16_url', 'preview_video_16x9_url']) {
      const url = row[col];
      if (!url) continue;
      if (url.startsWith(oldPrefix)) {
        update[col] = r2.publicObjectUrl(`template-previews/${decodeURIComponent(url.slice(oldPrefix.length).split('?')[0])}`);
      } else if (VERIFY) {
        const res = await fetch(url, { method: 'HEAD' });
        if (!res.ok) {
          problems++;
          console.error(`  ${row.id}.${col}: ${url} -> HTTP ${res.status}`);
        }
      }
    }
    if (!Object.keys(update).length) continue;
    if (VERIFY) {
      problems++;
      console.error(`  ${row.id} still points at Supabase Storage`);
      continue;
    }
    changed++;
    if (APPLY) {
      const { error: upErr } = await supabase.from('templates').update(update).eq('id', row.id);
      if (upErr) {
        problems++;
        console.error(`  FAILED updating ${row.id}: ${upErr.message}`);
      } else console.log(`  repointed ${row.id}`);
    }
  }
  console.log(`Template preview URLs: ${changed} ${APPLY ? 'repointed' : 'to repoint'}${VERIFY ? `, ${problems} problems` : ''}.`);
  return problems;
}

console.log(VERIFY ? 'VERIFY: checking R2 against Supabase Storage' : APPLY ? 'APPLY: copying to R2' : 'DRY RUN (add --apply to copy)');
const problems = (await migrateFiles()) + (await migrateTemplateUrls());
if (VERIFY) console.log(problems ? `\n${problems} problem(s) found.` : '\nAll files and URLs verified.');
process.exitCode = problems ? 1 : 0;
