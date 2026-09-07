import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch({
  channel: process.platform === 'win32' ? 'msedge' : undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto('http://127.0.0.1:5173');
  await page.locator('#begin:not([disabled])').waitFor({ timeout: 60000 });
  await page.click('#begin');
  while (await page.locator('#dialogue').isVisible()) await page.click('#dialogue-next');
  await page.click('[data-starter="dog"]');
  while (await page.locator('#dialogue').isVisible()) await page.click('#dialogue-next');
  await page.waitForTimeout(1500);
  const point = await page.evaluate(() => window.__animalDebug.project(7, 5));
  await page.mouse.click(point.x, point.y);
  await page.waitForFunction(
    () => {
      const p = window.__animalDebug.position();
      return Math.hypot(p.x - 7, p.z - 5) < 0.45;
    },
    null,
    { timeout: 20000 },
  );
  await page.keyboard.press('e');
  while (!(await page.locator('#encounter-done').isVisible())) {
    const mood = await page.locator('#encounter-mood').textContent();
    await page.click(`#moves [data-move="${mood.includes('hungry') ? 'play' : 'snack'}"]`);
    await page.waitForTimeout(450);
  }
  await expect(page.locator('#confidence-value')).toHaveText('0 / 100');
  await expect(page.locator('#encounter-mood')).toHaveText('Needs a moment');
  await page.click('#encounter-done');
  await page.keyboard.press('e');
  await expect(page.locator('#confidence-value')).toHaveText('100 / 100');
  while (!(await page.locator('#encounter-done').isVisible())) {
    const mood = await page.locator('#encounter-mood').textContent();
    await page.click(
      `#moves [data-move="${mood.includes('hungry') ? 'snack' : mood.includes('nervous') ? 'reassure' : 'play'}"]`,
    );
    await page.waitForTimeout(450);
  }
  await expect(page.locator('#encounter-mood')).toHaveText('New friend!');
  await page.click('#encounter-done');
  await page.keyboard.press('e');
  await expect(page.locator('#encounter')).toBeHidden();
  const save = JSON.parse(await page.evaluate(() => localStorage.getItem('ordinary-animals-v1')));
  expect(save.stamps).toEqual(['pigeon']);
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify({
      result: 'Loss, retry, victory and duplicate-stamp prevention passed',
      errors,
    }),
  );
} finally {
  await browser.close();
}
