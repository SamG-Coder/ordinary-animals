import { chromium } from '@playwright/test';
const browser = await chromium.launch({
  channel: process.platform === 'win32' ? 'msedge' : undefined,
  headless: true,
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
await page.goto('http://127.0.0.1:5173');
await page.locator('#begin:not([disabled])').waitFor({ timeout: 60000 });
await page.waitForTimeout(2000);
await page.screenshot({ path: 'artifacts/title-desktop.png' });
await page.screenshot({ path: 'docs/title.jpg', quality: 88 });
await page.click('#begin');
for (let i = 0; i < 3; i++) await page.click('#dialogue-next');
await page
  .locator('#starter img')
  .evaluateAll((images) => Promise.all(images.map((img) => img.decode())));
await page.screenshot({ path: 'artifacts/starters-desktop.png' });
await page.screenshot({ path: 'docs/starters.jpg', quality: 90 });
await page.click('[data-starter="cat"]');
for (let i = 0; i < 2; i++) await page.click('#dialogue-next');
await page.waitForTimeout(1500);
await page.screenshot({ path: 'artifacts/game-desktop.png' });
console.log(
  JSON.stringify({
    errors,
    title: await page.title(),
    quest: await page.locator('#quest-title').textContent(),
  }),
);
await browser.close();
