import { chromium, expect } from "@playwright/test";
import { initialSave, makeAnimal, SAVE_KEY } from "../src/rules.js";
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({
      viewport: { width, height: width === 390 ? 844 : 960 },
    });
    await page.addInitScript(
      ({ key, save }) => {
        localStorage.setItem(key, JSON.stringify(save));
        Math.random = () => 0.19;
      },
      {
        key: SAVE_KEY,
        save: {
          ...initialSave(),
          note: true,
          starter: "cat",
          party: [makeAnimal("cat", 7)],
          position: { x: -17, z: 20.5 },
          yaw: 0,
          pitch: -0.4,
          wins: ["rival"],
        },
      },
    );
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(process.env.GAME_URL || "http://127.0.0.1:5174");
    await page.locator("#begin:not([disabled])").waitFor({ timeout: 120000 });
    await page.click("#begin");
    await page.waitForTimeout(150);
    await page.keyboard.press("e");
    await expect(page.locator("#battle")).toBeVisible();
    await expect(page.locator("#fight-btn")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#bag-btn")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#battle-actions")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#battle-root")).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.locator("#move-buttons")).toBeVisible();
    await page.screenshot({ path: `artifacts/battle-moves-${width}.png` });
    const fits = await page.locator(".battle-console").evaluate((el) => {
      const r = el.getBoundingClientRect();
      return (
        r.left >= 0 &&
        r.right <= innerWidth &&
        r.bottom <= innerHeight &&
        r.top >= 0
      );
    });
    expect(fits).toBe(true);
    await page.keyboard.press("Enter");
    await page
      .locator("#move-buttons button:not([disabled])")
      .first()
      .waitFor();
    await expect(page.locator("#battle-round")).toHaveText("TURN 2");
    await page.click("#battle-back");
    await page.screenshot({ path: `artifacts/battle-commands-${width}.png` });
    expect(errors).toEqual([]);
    await page.close();
    console.log(
      "PASS: command menu keyboard navigation, attack and layout",
      width,
    );
  }
} finally {
  await browser.close();
}
