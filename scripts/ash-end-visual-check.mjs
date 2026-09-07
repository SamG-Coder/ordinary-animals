import { chromium, expect } from "@playwright/test";
import { initialSave, makeAnimal, SAVE_KEY } from "../src/rules.js";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const errors = [];
const url = process.env.GAME_URL || "http://127.0.0.1:5174";
for (const [name, x, z, tx, tz, pitch] of [
  ["approach", -185, 35, -250, -20, 0.005],
  ["courtyard", -236, -19, -224, -37, 0.09],
  ["outgoing-road", -249, -23, -239, -60, 0],
  ["office", -233, -26.6, -233, -37, 0.09],
  ["notices", -227.2, -19.4, -227.2, -21.5, 0.06],
]) {
  // Isolate each save fixture; multiple init scripts have no guaranteed ordering.
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
  });
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
        party: [makeAnimal("cat", 9)],
        badges: [0],
        wins: ["rival", "gym0"],
        position: { x, z },
        yaw: Math.atan2(x - tx, z - tz),
        pitch,
      },
    },
  );
  await page.goto(url);
  await page.locator("#begin:not([disabled])").waitFor({ timeout: 120000 });
  await page.click("#begin");
  await page.waitForTimeout(800);
  if (
    name === "approach" &&
    (await page.evaluate(() => Boolean(window.__debug)))
  )
    console.log(
      "Approach workload:",
      await page.evaluate(() => window.__debug.stats()),
    );
  await page.screenshot({ path: `artifacts/ash-end-${name}.png` });
  if (name === "notices") {
    await expect(page.locator("#interact-label")).toContainText(
      "tenant notices",
    );
    await page.keyboard.press("e");
    await expect(page.locator("#dialogue")).toBeVisible();
    await page.click("#next");
    await page.screenshot({ path: "artifacts/ash-end-dialogue.png" });
    await expect(page.locator("#dialogue")).toContainText("business equipment");
  }
  if (name === "office") {
    await expect(page.locator("#interact-label")).toContainText("Landlord");
    await page.keyboard.press("e");
    while (await page.locator("#dialogue").isVisible())
      await page.click("#next");
    await expect(page.locator("#battle")).toBeVisible();
    await page.waitForTimeout(800);
    await page.screenshot({ path: "artifacts/ash-end-battle.png" });
  }
  await page.close();
}
expect(errors).toEqual([]);
console.log("Ash End visual and notice fixture: no browser or asset errors");
await browser.close();
