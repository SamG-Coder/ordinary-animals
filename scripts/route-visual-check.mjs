import { chromium, expect } from "@playwright/test";
import { initialSave, makeAnimal, SAVE_KEY } from "../src/rules.js";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
const school = process.argv.includes("--school");
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  if (r.status() >= 400 && !r.url().endsWith("favicon.ico"))
    errors.push(`${r.status()} ${r.url()}`);
});
await page.addInitScript(
  ({ key, save }) => localStorage.setItem(key, JSON.stringify(save)),
  {
    key: SAVE_KEY,
    save: {
      ...initialSave(),
      note: true,
      starter: "cat",
      party: [makeAnimal("cat", 7)],
      wins: ["rival"],
      position: school ? { x: -93, z: 54.4 } : { x: -60, z: 55 },
      yaw: school ? 0 : Math.atan2(30, -15),
    },
  },
);
await page.goto(process.env.GAME_URL || "http://127.0.0.1:5174");
await page.locator("#begin:not([disabled])").waitFor({ timeout: 120000 });
await page.click("#begin");
await page.waitForTimeout(1500);
await page.screenshot({
  path: school ? "artifacts/crossing-guard.png" : "artifacts/route-surface.png",
});
if (!school && (await page.evaluate(() => Boolean(window.__debug)))) {
  await page
    .locator("#viewport canvas")
    .click({ position: { x: 720, y: 480 } });
  await page.evaluate(() => {
    const p = window.__debug.position();
    let dy = Math.atan2(p.x + 90, p.z - 70) - p.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    window.dispatchEvent(
      new PointerEvent("pointermove", {
        movementX: -dy / 0.0025,
        movementY: -(-0.3 - p.pitch) / 0.0025,
      }),
    );
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: "artifacts/road-closeup.png" });
}
if (school) {
  await expect(page.locator("#interact-label")).toContainText("Crossing Guard");
  await page.keyboard.press("e");
  while (await page.locator("#dialogue").isVisible()) await page.click("#next");
  await expect(page.locator("#battle")).toBeVisible();
  await page.waitForTimeout(900);
  await page.screenshot({ path: "artifacts/school-battle.png" });
}
expect(errors).toEqual([]);
console.log("Route visual fixture: no browser errors");
await browser.close();
