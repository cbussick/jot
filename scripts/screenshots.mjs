import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true });
await mkdir('screenshots', { recursive: true });
for (const [name, width, height] of [['desktop',1440,1000], ['ipad',834,1194], ['phone',390,844]]) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:4273/');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every(image => image.complete));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `screenshots/${name}.png` });
  await page.getByRole('button', { name: 'Open note: A tiny idea', exact: true }).click();
  await page.screenshot({ path: `screenshots/${name}-editor.png` });
  await page.close();
}
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:4273/designs.html');
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/design-review.png', fullPage: true });
await browser.close();
