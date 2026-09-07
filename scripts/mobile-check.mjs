import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch({
  channel: process.platform === 'win32' ? 'msedge' : undefined,
  headless: true,
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:5173');
await page.locator('#begin:not([disabled])').waitFor({ timeout: 60000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: 'artifacts/title-mobile.png' });
await page.click('#begin');
while (await page.locator('#dialogue').isVisible()) await page.click('#dialogue-next');
await page
  .locator('#starter img')
  .evaluateAll((images) => Promise.all(images.map((img) => img.decode())));
await page.screenshot({ path: 'artifacts/starters-mobile.png' });
await page.click('[data-starter="dog"]');
while (await page.locator('#dialogue').isVisible()) await page.click('#dialogue-next');
await page.waitForTimeout(1200);
await page.screenshot({ path: 'artifacts/game-mobile.png' });
const before = await page.evaluate(() => window.__animalDebug.position());
await page
  .locator('#touch-controls [data-move="right"]')
  .dispatchEvent('pointerdown', { pointerId: 1 });
await page.waitForTimeout(600);
await page
  .locator('#touch-controls [data-move="right"]')
  .dispatchEvent('pointerup', { pointerId: 1 });
const after = await page.evaluate(() => window.__animalDebug.position());
expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(0.5);
await page.click('#guide-btn');
await expect(page.locator('#guide')).toBeVisible();
await page.screenshot({ path: 'artifacts/guide-mobile.png' });
await page.click('#close-guide');
expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
console.log(JSON.stringify({ result: 'Mobile layout and controls passed', errors }));
expect(errors).toEqual([]);
await browser.close();
