#!/usr/bin/env node
/**
 * After NEXT_PUBLIC_R2_PUBLIC_URL changes (e.g. r2.dev -> a custom domain):
 * rewrites the template preview URLs stored in the `templates` table to the
 * new base. Music-library URLs are built from the env var at runtime and
 * need nothing. Dry run by default.
 *
 *   node --env-file=.env.local scripts/repoint-public-url.mjs           # show changes
 *   node --env-file=.env.local scripts/repoint-public-url.mjs --apply   # write them
 */
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const base = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? '').replace(/\/+$/, '');
if (!base || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Needs NEXT_PUBLIC_R2_PUBLIC_URL, NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.');
  process.exit(1);
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data, error } = await supabase.from('templates').select('id, preview_video_9x16_url, preview_video_16x9_url');
if (error) throw error;

let changed = 0;
for (const row of data) {
  const update = {};
  for (const col of ['preview_video_9x16_url', 'preview_video_16x9_url']) {
    const url = row[col];
    const i = url?.indexOf('/template-previews/') ?? -1;
    if (!url || i < 0 || url.startsWith(`${base}/`)) continue;
    update[col] = base + url.slice(i);
  }
  if (!Object.keys(update).length) continue;
  changed++;
  for (const [col, url] of Object.entries(update)) console.log(`${row.id}.${col}\n  ${row[col]}\n  -> ${url}`);
  if (APPLY) {
    const { error: upErr } = await supabase.from('templates').update(update).eq('id', row.id);
    if (upErr) throw upErr;
    const res = await fetch(Object.values(update)[0], { method: 'HEAD' });
    console.log(`  saved; new URL answers HTTP ${res.status}`);
  }
}
console.log(`${changed} template(s) ${APPLY ? 'repointed' : 'to repoint (dry run — add --apply)'} to ${base}.`);
