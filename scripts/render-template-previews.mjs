#!/usr/bin/env node
/**
 * Renders every template's preview video (via /dev/render-previews, a real
 * browser page — canvas/WebCodecs export can't run in plain Node) and
 * uploads the results to the public R2 bucket (under template-previews/),
 * then records each URL on the matching `templates` row (see
 * supabase/migrations/0012_template_previews.sql). Same service-role-key,
 * upsert-and-done shape as scripts/seed-music-library.ts.
 *
 * Requires `npm run dev` already running (this doesn't start it) and
 * NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + the R2_* variables
 * in .env.local.
 *
 * Usage: node --env-file=.env.local scripts/render-template-previews.mjs
 *        node --env-file=.env.local scripts/render-template-previews.mjs --url=http://localhost:3000
 */
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

import { r2FromEnv } from './lib/r2.mjs';

const urlArg = process.argv.find((a) => a.startsWith('--url='));
const baseUrl = urlArg ? urlArg.slice('--url='.length) : 'http://localhost:3000';

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Run with: node --env-file=.env.local scripts/render-template-previews.mjs');
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const r2 = r2FromEnv();

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  page.on('pageerror', (err) => console.error('[render-previews] page error:', err.message));

  console.log(`Loading ${baseUrl}/dev/render-previews ...`);
  await page.goto(`${baseUrl}/dev/render-previews`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Render all previews' }).click();
  console.log('Rendering (this takes a while — one real export per template per format)...');
  await page.waitForFunction(() => window.__renderPreviewsDone === true, null, { timeout: 20 * 60 * 1000 });

  const results = await page.evaluate(() => window.__renderedPreviews);
  await browser.close();

  const byTemplate = new Map();
  for (const [key, b64] of Object.entries(results)) {
    const match = key.match(/^(.+)-(9x16|16x9)$/);
    if (!match) continue;
    const [, templateId, tag] = match;
    if (!byTemplate.has(templateId)) byTemplate.set(templateId, {});
    byTemplate.get(templateId)[tag] = Buffer.from(b64, 'base64');
  }

  if (byTemplate.size === 0) {
    console.log('Nothing rendered (every template may lack buildSampleAssets). Nothing to upload.');
    return;
  }

  let dbFailed = false;
  for (const [templateId, videos] of byTemplate) {
    const update = {};
    for (const [tag, buf] of Object.entries(videos)) {
      const path = `template-previews/${templateId}/preview-${tag}.mp4`;
      console.log(`Uploading ${path} (${(buf.length / 1048576).toFixed(2)}MB)...`);
      await r2.put(r2.bucketName('public'), path, buf, 'video/mp4');
      update[tag === '9x16' ? 'preview_video_9x16_url' : 'preview_video_16x9_url'] = `${r2.publicObjectUrl(path)}?v=${Date.now()}`;
    }
    // Upload always proceeds for every template even if the DB step below
    // fails for one (e.g. supabase/migrations/0012_template_previews.sql
    // hasn't been applied to this project yet — the videos are still
    // real, usable, uploaded files at their expected paths regardless;
    // only the gallery's ability to *find* them via the templates table
    // is blocked until that migration runs).
    const { error: dbError } = await supabase.from('templates').upsert({ id: templateId, ...update });
    if (dbError) {
      console.error(`  uploaded, but couldn't record the URL for ${templateId}: ${dbError.message}`);
      dbFailed = true;
      continue;
    }
    console.log(`  done: ${templateId}`);
  }

  console.log(`Uploaded previews for ${byTemplate.size} template(s).`);
  if (dbFailed) {
    console.error('\nSome templates uploaded but could not be recorded — run supabase/migrations/0012_template_previews.sql against this project (Supabase CLI `supabase db push`, or paste it into the SQL Editor), then re-run this script to record the URLs (uploads are idempotent, so it will just re-upload the same files).');
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
