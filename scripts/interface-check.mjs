import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
console.log('Interface browser launched');
const errors = [];
try {
  for (const viewport of [{width:1440,height:960},{width:390,height:844}]) {
    const page = await browser.newPage({viewport});
    console.log('Created viewport',viewport.width);
    page.setDefaultTimeout(15000);
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:5174');
    await page.locator('#begin:not([disabled])').waitFor({timeout:120000});
    console.log('Assets ready');
    expect(await page.locator('h1').evaluate(el=>el.getBoundingClientRect().right<=innerWidth)).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.click('#begin');await page.keyboard.press('j');
    console.log('Journal opened');
    await page.click('[data-tab="guide"]');
    console.log('Guide selected');
    await page.selectOption('#graphics','performance');await page.locator('#motion').uncheck();
    await page.locator('#sensitivity').focus();await page.keyboard.press('End');
    await page.screenshot({path:`artifacts/settings-${viewport.width}.png`});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.reload();await page.locator('#begin:not([disabled])').waitFor();
    await page.click('#begin');await page.keyboard.press('j');await page.click('[data-tab="guide"]');
    await expect(page.locator('#graphics')).toHaveValue('performance');await expect(page.locator('#motion')).not.toBeChecked();
    await expect(page.locator('#sensitivity')).toHaveValue('0.006');
    await page.close();console.log('PASS: viewport, settings, and reload persistence',viewport.width);
  }
  expect(errors).toEqual([]);
} finally { await browser.close(); }
