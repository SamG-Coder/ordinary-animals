// Explicit post-second-badge save fixture, not a fresh-save campaign run.
// Starts with the verified third-district result: LV11 cat, two badges,
// 2 medkits,14 carriers and £460. There is no RNG override or free refill.
// Movement and battle commands use ordinary UI inputs; debug is read-only.
import { chromium, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { initialSave, makeAnimal, SAVE_KEY } from "../src/rules.js";
import { battleMenu } from "./battle-controls.mjs";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
const observations = [];
const fixture = {
  ...initialSave(),
  note: true,
  starter: "cat",
  party: [makeAnimal("cat", 11)],
  badges: [0, 1],
  wins: ["rival", "gym0", "gym1"],
  carriers: 14,
  medkits: 2,
  money: 460,
  position: { x: -233, y: 1.35, z: -26.6 },
  yaw: Math.PI,
  pitch: 0,
};
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  if (r.status() >= 400 && !r.url().endsWith("favicon.ico"))
    errors.push(`${r.status()} ${r.url()}`);
});
await page.addInitScript(
  ({ save, key }) => {
    localStorage.setItem(key, JSON.stringify(save));
  },
  { save: fixture, key: SAVE_KEY },
);

async function position() {
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
      let dy = Math.atan2(p.x - x, p.z - z) - p.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      const pitch = Math.atan2(y - p.y, Math.hypot(x - p.x, z - p.z));
      window.dispatchEvent(
        new PointerEvent("pointermove", {
          movementX: -dy / 0.0025,
          movementY: -(pitch - p.pitch) / 0.0025,
        }),
      );
    },
    [x, z, y],
  );
}
async function walk(x, z) {
  let previous,
    stalled = 0;
  for (let i = 0; i < 400; i++) {
    const p = await position();
    if (Math.hypot(p.x - x, p.z - z) < 0.2) {
      const obs = { event: "waypoint", intended: [x, z], position: p };
      observations.push(obs);
      console.log(JSON.stringify(obs));
      return;
    }
    stalled =
      previous && Math.hypot(p.x - previous.x, p.z - previous.z) < 0.01
        ? stalled + 1
        : 0;
    if (stalled > 20)
      throw new Error(
        `Movement blocked heading to ${x},${z} at ${JSON.stringify(p)}`,
      );
    previous = p;
    await look(x, z, p.y);
    await page.keyboard.down("w");
    await page.waitForTimeout(130);
    await page.keyboard.up("w");
  }
  throw new Error(
    `Movement timed out heading to ${x},${z} at ${JSON.stringify(await position())}`,
  );
}
async function ready() {
  await page.waitForFunction(
    () =>
      !document.getElementById("battle-continue").hidden ||
      Boolean(document.querySelector("#move-buttons button:not([disabled])")),
  );
}
async function state() {
  return JSON.parse(
    await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY),
  );
}

try {
  await page.goto("http://127.0.0.1:5174");
  await page.locator("#begin:not([disabled])").waitFor({ timeout: 120000 });
  await page.click("#begin");
  observations.push({ event: "fixture", save: await state() });
  const waypoints = [
    [-233, -20],
    [-250, -20],
    [-242, -56],
    [-234, -92],
    [-226, -128],
    [-218, -164],
    [-210, -200],
    [-193, -200],
    [-193, -206.6],
  ];
  for (const [x, z] of waypoints) {
    await walk(x, z);
    if (x === -226) {
      await look(-210, -200, 2);
      await page.screenshot({ path: "artifacts/third-district-approach.png" });
      observations.push({
        event: "route-stats",
        stats: await page.evaluate(() => window.__debug.stats()),
      });
    }
  }
  await look(-193, -217, 3);
  await page.screenshot({ path: "artifacts/third-district-front.png" });
  await look(-193, -209, 1.5);
  await page.waitForFunction(
    () => window.__debug.target() === "gym2",
    undefined,
    { timeout: 5000 },
  );
  await page.keyboard.press("e");
  observations.push({
    event: "leader-dialogue",
    text: await page.locator("#dialogue").textContent(),
  });
  while (await page.locator("#dialogue").isVisible()) await page.click("#next");
  await ready();
  await page.screenshot({ path: "artifacts/third-district-battle.png" });
  for (let turn = 1; turn <= 45; turn++) {
    await ready();
    if (await page.locator("#battle-continue").isVisible()) break;
    const hp = (await page.locator("#ally-status").textContent()).match(
      /(\d+)\/(\d+)/,
    );
    const enemy = await page.locator("#enemy-name").textContent();
    const before = {
      ally: await page.locator("#ally-status").textContent(),
      enemy: await page.locator("#enemy-status").textContent(),
    };
    const heal =
      Number(hp[1]) < Number(hp[2]) * 0.5 &&
      (await page.locator("#heal-btn").isEnabled());
    if (heal) {
      await battleMenu(page, "bag");
      await page.click("#heal-btn");
    } else {
      await battleMenu(page, "fight");
      await page
        .locator("#move-buttons button")
        .nth(enemy === "Rabbit" ? 0 : 1)
        .click();
    }
    await ready();
    const obs = {
      event: "turn",
      turn,
      enemy,
      command: heal ? "medkit" : enemy === "Rabbit" ? "Scratch" : "Bite",
      before,
      after: await page.locator("#ally-status").textContent(),
      log: await page.locator("#battle-log").textContent(),
    };
    observations.push(obs);
    console.log(JSON.stringify(obs));
  }
  await expect(page.locator("#battle-continue")).toBeVisible();
  await page.screenshot({ path: "artifacts/third-district-result.png" });
  const final = await state();
  observations.push({ event: "battle-result", save: final });
  console.log(
    JSON.stringify({
      event: "result",
      badges: final.badges,
      party: final.party,
      medkits: final.medkits,
      carriers: final.carriers,
      money: final.money,
      errors,
    }),
  );
  await page.click("#battle-continue");
  expect(final.badges).toContain(2);
  expect(errors).toEqual([]);
} catch (error) {
  observations.push({
    event: "failure",
    message: error.message,
    position: await position(),
    target: await page.evaluate(() => window.__debug?.target()),
  });
  await page.screenshot({ path: "artifacts/third-district-failure.png" });
  throw error;
} finally {
  await writeFile(
    "artifacts/third-district-observations.json",
    JSON.stringify({ fixture, observations, errors }, null, 2),
  );
  await browser.close();
}
