import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 2 });
  await page.goto('http://localhost:3000/dev/pose3d-check', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  for (const label of ['tablet / silver / front', 'tablet / silver / hero', 'tablet / silver / flat', 'notch / titanium / floating', 'notch / graphite / front']) {
    const target = page.locator('div', { has: page.locator('p', { hasText: label }) }).last();
    const safe = label.replace(/[^a-z0-9]+/gi, '-');
    await target.screenshot({ path: `C:/Users/uphil/AppData/Local/Temp/claude/d--My-Data-Coding-CUTED/213c4013-7b1d-4212-9325-17764148820e/scratchpad/z-${safe}.png` });
  }
  await browser.close();
  console.log('done');
}

main();
