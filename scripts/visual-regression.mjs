#!/usr/bin/env node
/**
 * Standing visual-regression runner (CLAUDE.md rule 7) — headlessly drives
 * /dev/visual-regression, which does the actual rendering/sampling/
 * comparison (real code, real WebGL pipeline; this script is just the
 * automation shell around it). Requires `npm run dev` already running —
 * this doesn't start or manage the dev server itself, matching every
 * other Playwright-driven check used during this project's development.
 *
 * Usage: npm run visual-regression
 *        npm run visual-regression -- --url=http://localhost:3000
 */
import { chromium } from 'playwright';

const urlArg = process.argv.find((a) => a.startsWith('--url='));
const baseUrl = urlArg ? urlArg.slice('--url='.length) : 'http://localhost:3000';

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 600, height: 950 } });
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  console.log(`Loading ${baseUrl}/dev/visual-regression ...`);
  await page.goto(`${baseUrl}/dev/visual-regression`, { waitUntil: 'networkidle' });
  // networkidle only waits for network requests to settle, not for React
  // to hydrate and run its effects — wait for the hook itself to exist
  // before calling it (hit intermittently without this: the page loaded
  // fast enough that evaluate() ran before the mount effect had).
  await page.waitForFunction(() => typeof window.__runVisualRegression === 'function', null, { timeout: 15000 });

  console.log('Running fixtures (preview + export for each — this takes roughly a minute)...');
  await page.evaluate(() => window.__runVisualRegression());
  await page.waitForFunction(() => window.__visualRegressionResults !== undefined, null, { timeout: 300000 });

  const results = await page.evaluate(() => window.__visualRegressionResults);
  await browser.close();

  console.log('');
  for (const fixture of results.fixtures) {
    console.log(`${fixture.label}`);
    if (fixture.error) {
      console.log(`  FAILED TO RUN: ${fixture.error}`);
      continue;
    }
    for (const [phase, samples] of [['preview', fixture.preview], ['export', fixture.export]]) {
      for (const s of samples) {
        const mark = s.pass ? 'PASS' : 'FAIL';
        console.log(`  [${mark}] ${phase} — ${s.label}: expected [${s.expected.join(',')}] ±${s.tolerance}, got [${s.actual.join(',')}]`);
      }
    }
  }
  console.log('');

  if (consoleErrors.length > 0) {
    console.log('Console/page errors during the run:');
    consoleErrors.forEach((e) => console.log(`  ${e}`));
    console.log('');
  }

  if (results.allPass) {
    console.log('ALL PASS');
    process.exit(0);
  } else {
    console.log('FAILURES — see above. Re-check the render pipeline (camera.ts, sceneBuilder.ts, grain.ts, watermark.ts) against CLAUDE.md rule 7.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Visual regression runner crashed:', err);
  process.exit(1);
});
