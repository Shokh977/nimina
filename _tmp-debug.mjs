import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  page.on('console', (msg) => {
    if (msg.text().includes('[DEBUG]')) console.log(msg.text());
  });
  await page.goto('http://localhost:3000/dev/pose3d-check', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await browser.close();
}

main();
