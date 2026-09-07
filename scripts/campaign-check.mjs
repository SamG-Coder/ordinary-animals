import { chromium, expect } from '@playwright/test';
import { ENCOUNTERS } from '../src/game.js';
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
async function dismissDialogue() {
  while (await page.locator('#dialogue').isVisible()) await page.click('#dialogue-next');
}
async function walk(x, z) {
  await page.waitForTimeout(400);
  const point = await page.evaluate(([x, z]) => window.__animalDebug.project(x, z), [x, z]);
  await page.mouse.click(point.x, point.y);
  await page.waitForFunction(
    ([x, z]) => {
      const p = window.__animalDebug.position();
      return Math.hypot(p.x - x, p.z - z) < 0.45;
    },
    [x, z],
    { timeout: 25000 },
  );
}
async function win() {
  while (!(await page.locator('#encounter-done').isVisible())) {
    const mood = await page.locator('#encounter-mood').textContent();
    const move = mood.includes('hungry') ? 'snack' : mood.includes('nervous') ? 'reassure' : 'play';
    await page.click(`#moves [data-move="${move}"]`);
    await page.waitForTimeout(450);
  }
  await expect(page.locator('#encounter-mood')).toHaveText('New friend!');
}
try {
  await page.goto('http://127.0.0.1:5173');
  await page.locator('#begin:not([disabled])').waitFor({ timeout: 60000 });
  await page.click('#begin');
  await dismissDialogue();
  await page.click('[data-starter="hamster"]');
  await dismissDialogue();
  await page.click('#sound-btn');
  await page.click('#sound-btn');
  for (let chapter = 0; chapter < 3; chapter++) {
    for (const e of ENCOUNTERS.filter((e) => e.chapter === chapter)) {
      await walk(e.x, e.z - 1);
      await expect(page.locator('#interact')).toContainText(e.name);
      await page.keyboard.press('e');
      await expect(page.locator('#encounter')).toBeVisible();
      await page.screenshot({ path: `artifacts/encounter-${e.id}.png` });
      await win();
      await page.click('#encounter-done');
      console.log(`Befriended ${e.id}`);
    }
    await page.screenshot({ path: `artifacts/chapter-${chapter + 1}.png` });
    await walk(-2, -1);
    await expect(page.locator('#interact')).toContainText('Gary');
    await page.keyboard.press('e');
    await dismissDialogue();
    if (chapter === 0) {
      await page.reload();
      await page.locator('#begin:not([disabled])').waitFor({ timeout: 60000 });
      await expect(page.locator('#begin')).toContainText('Continue');
      await page.click('#begin');
      await expect(page.locator('.location-label')).toContainText('MILDLY INCONVENIENT WOODS');
    }
  }
  await expect(page.locator('#encounter-name')).toHaveText('Gary’s Regional Champion');
  await win();
  await page.click('#encounter-done');
  await dismissDialogue();
  await expect(page.locator('#certificate')).toBeVisible();
  await page.screenshot({ path: 'artifacts/ending-desktop.png' });
  const save = JSON.parse(await page.evaluate(() => localStorage.getItem('ordinary-animals-v1')));
  expect(save.completed).toBe(true);
  expect(save.stamps).toHaveLength(10);
  await page.click('#keep-exploring');
  await page.click('#guide-btn');
  await expect(page.locator('.journal-entry.found')).toHaveCount(10);
  await page.getByRole('button', { name: 'Little Ditch', exact: false }).click();
  await expect(page.locator('.location-label')).toContainText('LITTLE DITCH');
  console.log(
    JSON.stringify({
      result: 'Full campaign completed through UI',
      save,
      errors,
      render: await page.evaluate(() => window.__animalDebug.stats()),
    }),
  );
  expect(errors).toEqual([]);
} catch (error) {
  await page.screenshot({ path: 'artifacts/campaign-failure.png' });
  console.error('POSITION', await page.evaluate(() => window.__animalDebug?.position()));
  throw error;
} finally {
  await browser.close();
}
