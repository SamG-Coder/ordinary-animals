// Explicit hill-side save fixture. Walk up and over an exported Blender surface.
import { chromium, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { initialSave, makeAnimal, SAVE_KEY } from "../src/rules.js";
import { createTerrain } from "../src/terrain.js";
const terrain = createTerrain(
  JSON.parse(await readFile("game-assets/asset-catalog.json", "utf8")),
);
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [],
  observations = [];
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
      party: [makeAnimal("cat", 11)],
      badges: [0, 1],
      wins: ["rival", "gym0", "gym1"],
      position: { x: -273, z: -145 },
      yaw: Math.PI,
    },
  },
);
async function state() {
  return page.evaluate(() => window.__debug.position());
}
async function look(x, z, y = 1.35) {
  if (!(await page.evaluate(() => Boolean(document.pointerLockElement))))
    await page
      .locator("#viewport canvas")
      .click({ position: { x: 720, y: 480 } });
  await page.evaluate(
    ([x, z, y]) => {
      const p = window.__debug.position();
      let d = Math.atan2(p.x - x, p.z - z) - p.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      const pitch = Math.atan2(y - p.y, Math.hypot(x - p.x, z - p.z));
      window.dispatchEvent(
        new PointerEvent("pointermove", {
          movementX: -d / 0.0025,
          movementY: -(pitch - p.pitch) / 0.0025,
        }),
      );
    },
    [x, z, y],
  );
}
async function observe() {
  const p = await state(),
    ground = terrain.height(p.x, p.z);
  expect(Math.abs(p.y - ground - 1.35)).toBeLessThan(0.23);
  const animals = await page.evaluate(() => window.__debug.animals());
  for (const a of animals.filter((a) => a.visible))
    expect(Math.abs(a.y - terrain.height(a.x, a.z))).toBeLessThan(0.001);
  observations.push({
    position: p,
    ground,
    companion: animals.find((a) => a.companion),
  });
}
async function walk(x, z) {
  let previous,
    stalled = 0;
  for (let i = 0; i < 250; i++) {
    const p = await state();
    if (Math.hypot(p.x - x, p.z - z) < 0.18) {
      await observe();
      return;
    }
    stalled =
      previous && Math.hypot(p.x - previous.x, p.z - previous.z) < 0.01
        ? stalled + 1
        : 0;
    if (stalled > 20)
      throw new Error(`Hill walk blocked at ${JSON.stringify(p)}`);
    previous = p;
    await look(x, z, p.y);
    await page.keyboard.down("w");
    await page.waitForTimeout(130);
    await page.keyboard.up("w");
  }
  throw new Error("Hill walk timed out");
}
try {
  await page.goto("http://127.0.0.1:5174");
  await page.locator("#begin:not([disabled])").waitFor({ timeout: 120000 });
  await page.click("#begin");
  await page.waitForTimeout(600);
  await observe();
  for (const z of [-139, -133, -127, -121, -115, -109, -103, -97]) {
    await walk(-273, z);
    if (z === -121) {
      await look(-229, -111, 2);
      await page.screenshot({ path: "artifacts/hill-crest.png" });
    }
  }
  await look(-273, -120, terrain.height(-273, -120) + 0.7);
  await page.screenshot({ path: "artifacts/hill-return.png" });
  expect(Math.max(...observations.map((o) => o.ground))).toBeGreaterThan(2);
  expect(observations.at(-1).ground).toBeLessThan(1.5);
  expect(errors).toEqual([]);
  console.log(
    "PASS: actual hill walk, eye height, grounded companion and descent",
    observations.map((o) => +o.ground.toFixed(3)),
  );
} catch (e) {
  await page.screenshot({ path: "artifacts/terrain-walk-failure.png" });
  throw e;
} finally {
  await writeFile(
    "artifacts/terrain-walk-observations.json",
    JSON.stringify({ observations, errors }, null, 2),
  );
  await browser.close();
}
