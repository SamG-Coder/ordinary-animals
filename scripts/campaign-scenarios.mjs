import { battleMenu } from "./battle-controls.mjs";
// Browser regression scenarios use explicit save fixtures. These are not a fresh-save playthrough.
import { chromium, expect } from "@playwright/test";
import { initialSave, makeAnimal, SAVE_KEY } from "../src/rules.js";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const errors = [];
async function scenario(overrides) {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  const save = {
    ...initialSave(),
    note: true,
    starter: "cat",
    party: [makeAnimal("cat", 7)],
    wins: ["rival"],
    ...overrides,
  };
  await page.addInitScript(
    ({ save, key }) => {
      if (!sessionStorage.getItem("fixture-loaded")) {
        localStorage.setItem(key, JSON.stringify(save));
        sessionStorage.setItem("fixture-loaded", "yes");
      }
      Math.random = () => 0.19;
    },
    { save, key: SAVE_KEY },
  );
  await page.goto("http://127.0.0.1:5174");
  await page.locator("#begin:not([disabled])").waitFor({ timeout: 120000 });
  await page.click("#begin");
  return page;
}
async function read(page) {
  return JSON.parse(
    await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY),
  );
}
async function interact(page, x, z, y, id) {
  await page
    .locator("#viewport canvas")
    .click({ position: { x: 640, y: 400 } });
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
  await page.waitForFunction((id) => window.__debug.target() === id, id, {
    timeout: 5000,
  });
  await page.keyboard.press("e");
  while (await page.locator("#dialogue").isVisible()) await page.click("#next");
}
async function finishBattle(page, button = 0) {
  for (let i = 0; i < 60; i++) {
    await page.waitForFunction(
      () =>
        !document.getElementById("battle-continue").hidden ||
        Boolean(document.querySelector("#move-buttons button:not([disabled])")),
    );
    if (await page.locator("#battle-continue").isVisible()) return;
    await battleMenu(page, "fight");
    await page.locator("#move-buttons button").nth(button).click();
    await page.waitForTimeout(100);
  }
  throw new Error("Battle did not resolve");
}
try {
  let page = await scenario({
    position: { x: -17, z: 20.5 },
    yaw: 0,
    pitch: -0.4,
  });
  await interact(page, -17, 19, 0.5, "wild0");
  await page.waitForFunction(
    () =>
      window.__debug.animals().find((a) => a.target === "wild0")?.visible ===
      false,
  );
  await battleMenu(page, "fight");
  await page.locator("#move-buttons button").first().click();
  await battleMenu(page, "bag");
  await page.locator("#capture-btn:not([disabled])").waitFor();
  await page.click("#capture-btn");
  await page.locator("#battle-continue").waitFor();
  await page.click("#battle-continue");
  await page.waitForFunction(
    () =>
      window.__debug.animals().find((a) => a.target === "wild0")?.visible ===
        false && window.__debug.target() !== "wild0",
  );
  let save = await read(page);
  expect(save.party.map((a) => a.species)).toEqual(["cat", "rat"]);
  expect(save.carriers).toBe(7);
  await page.screenshot({ path: "artifacts/capture-confirmed.png" });
  await page.reload();
  await page.locator("#begin:not([disabled])").waitFor();
  await page.click("#begin");
  save = await read(page);
  expect(save.party.map((a) => a.species)).toEqual(["cat", "rat"]);
  expect(save.carriers).toBe(7);
  await page.close();
  console.log(
    "PASS: weakened wild capture, carrier consumption, party persistence",
  );

  page = await scenario({
    position: { x: -17, z: 20.5 },
    yaw: 0,
    pitch: -0.4,
    party: ["cat", "dog", "hamster", "rabbit", "fox", "goat"].map((id) =>
      makeAnimal(id, 7),
    ),
  });
  await interact(page, -17, 19, 0.5, "wild0");
  await expect(page.locator("#capture-help")).toContainText("clinic storage");
  await battleMenu(page, "fight");
  await page.locator("#move-buttons button").first().click();
  await battleMenu(page, "bag");
  await page.locator("#capture-btn:not([disabled])").waitFor();
  await page.click("#capture-btn");
  await page.locator("#battle-continue").waitFor();
  await expect(page.locator("#battle-log")).toContainText("league courier");
  await page.click("#battle-continue");
  save = await read(page);
  expect(save.party.length).toBe(6);
  expect(save.reserve.map((a) => a.species)).toEqual(["rat"]);
  expect(save.caught).toContain("rat");
  expect(save.carriers).toBe(7);
  await page.keyboard.press("j");
  await page.click('[data-tab="party"]');
  await expect(page.getByRole("button", { name: "TAKE ALONG" })).toBeDisabled();
  await page.close();
  // Explicit location fixture: verify clinic transfers separately from the road playthrough.
  page = await scenario({ ...save, position: { x: 24, z: -12.5 } });
  await page.keyboard.press("j");
  await page.click('[data-tab="party"]');
  await page.getByRole("button", { name: "LEAVE AT CLINIC" }).nth(1).click();
  await page.getByRole("button", { name: "TAKE ALONG" }).first().click();
  save = await read(page);
  expect(save.party.length).toBe(6);
  expect(save.party.map((a) => a.species)).toContain("rat");
  expect(save.reserve.map((a) => a.species)).toEqual(["dog"]);
  await page.click('[data-tab="register"]');
  await expect(page.locator('[data-species="rat"]')).toContainText(
    "REGISTERED",
  );
  await expect(page.locator('[data-species="dog"]')).toContainText(
    "REGISTERED",
  );
  await expect(page.locator('[data-species="raccoon"]')).toContainText(
    "UNFILED",
  );
  await page.screenshot({ path: "artifacts/species-register.png" });
  await page.reload();
  await page.locator("#begin:not([disabled])").waitFor();
  await page.click("#begin");
  save = await read(page);
  expect(save.reserve.map((a) => a.species)).toEqual(["dog"]);
  expect(save.caught).toContain("rat");
  await page.close();
  console.log(
    "PASS: full-party capture, clinic-only storage transfers, species register and reload",
  );

  page = await scenario({
    position: { x: 15, z: -8 },
    wins: [],
    party: [{ ...makeAnimal("cat", 1), hp: 1 }],
    money: 100,
  });
  await interact(page, 13, -9, 1.3, "rival");
  await finishBattle(page, 2);
  await page.click("#battle-continue");
  save = await read(page);
  expect(save.position.x).toBe(0);
  expect(save.position.z).toBe(1.8);
  expect(save.party[0].hp).toBe(save.party[0].maxHp);
  expect(save.money).toBe(70);
  await page.close();
  console.log("PASS: defeat, return to bedroom, recovery, money penalty");

  page = await scenario({
    position: { x: 24, z: -12.5 },
    badges: [0, 1, 2, 3, 4, 5, 6, 7],
    league: 3,
    party: [makeAnimal("cat", 50), makeAnimal("dog", 50)],
    medkits: 10,
  });
  await interact(page, 24, -15, 1.5, "gary");
  await finishBattle(page, 3);
  await page.click("#battle-continue");
  await expect(page.locator("#ending")).toBeVisible();
  save = await read(page);
  expect(save.completed).toBe(true);
  expect(save.league).toBe(4);
  await page.screenshot({ path: "artifacts/championship-ending.png" });
  await page.click("#ending-close");
  save = await read(page);
  expect(save.position.z).toBe(1.8);
  expect(save.completed).toBe(true);
  await page.close();
  console.log(
    "PASS: final multi-animal championship round, ending, return home",
  );
  expect(errors).toEqual([]);
} finally {
  await browser.close();
}
