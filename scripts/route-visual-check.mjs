import { chromium, expect } from "@playwright/test";
import { initialSave, makeAnimal, SAVE_KEY } from "../src/rules.js";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
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
      position: { x: -60, z: 55 },
      yaw: Math.atan2(30, -15),
    },
  },
);
await page.goto(process.env.GAME_URL || "http://127.0.0.1:5174");
await page.locator("#begin:not([disabled])").waitFor({ timeout: 120000 });
await page.click("#begin");
await page.waitForTimeout(1500);
await page.screenshot({ path: "artifacts/route-surface.png" });
await page.locator("#viewport canvas").click({ position: { x: 720, y: 480 } });
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
expect(errors).toEqual([]);
console.log("Route visual fixture: no browser errors");
await browser.close();
