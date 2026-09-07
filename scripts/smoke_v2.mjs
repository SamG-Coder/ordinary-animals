import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.goto("http://127.0.0.1:5174");
await page.locator("#begin:not([disabled])").waitFor({ timeout: 120000 });
await page.waitForTimeout(1800);
await page.screenshot({ path: "artifacts/modular-title.png" });
await page.click("#begin");
await page.waitForTimeout(800);
await page.screenshot({ path: "artifacts/modular-bedroom.png" });
console.log(
  JSON.stringify({
    errors,
    stats: await page.evaluate(() => window.__debug.stats()),
    position: await page.evaluate(() => window.__debug.position()),
    animations: await page.evaluate(() => window.__debug.assets().cat),
  }),
);
await browser.close();
