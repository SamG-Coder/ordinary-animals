import { battleMenu } from "./battle-controls.mjs";
import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  if (r.status() >= 400 && !r.url().endsWith("favicon.ico"))
    errors.push(`${r.status()} ${r.url()}`);
});
async function look(x, z, y = 1.3) {
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
  let iterations = 0;
  let lastPosition,
    stalled = 0;
  while (iterations++ < 300) {
    const p = await page.evaluate(() => window.__debug.position());
    if (Math.hypot(p.x - x, p.z - z) < 0.2) return;
    stalled =
      lastPosition &&
      Math.hypot(p.x - lastPosition.x, p.z - lastPosition.z) < 0.01
        ? stalled + 1
        : 0;
    if (stalled > 20) break;
    lastPosition = p;
    await look(x, z, p.y);
    await page.keyboard.down("w");
    await page.waitForTimeout(130);
    await page.keyboard.up("w");
  }
  throw new Error(
    `Could not walk to ${x},${z}: ${JSON.stringify(await page.evaluate(() => window.__debug.position()))}`,
  );
}
async function interact(x, z, y, id) {
  await look(x, z, y);
  await page.waitForTimeout(90);
  expect(await page.evaluate(() => window.__debug.target())).toBe(id);
  await page.keyboard.press("e");
}
async function dialogue() {
  while (await page.locator("#dialogue").isVisible()) await page.click("#next");
}
try {
  await page.goto("http://127.0.0.1:5174");
  await page.locator("#begin:not([disabled])").waitFor({ timeout: 120000 });
  await page.click("#begin");
  await walk(-2.8, -1.65);
  await interact(-2.78, -2.82, 1.05, "radio");
  await expect(page.locator("#speaker")).toContainText("WICKMERE RADIO");
  await dialogue();
  await walk(-1.2, -1.55);
  await interact(-1.35, -2.6, 1, "letter");
  await dialogue();
  await walk(0, 2.5);
  await interact(0, 3.9, 1.2, "door");
  await walk(-0.65, 6);
  await interact(-1.74, 6, 0.82, "hall-bills");
  await expect(page.locator("#speaker")).toContainText("FINAL REMINDER");
  await dialogue();
  await walk(0, 6.4);
  await interact(0, 7.9, 1.2, "front-door");
  await page.screenshot({ path: "artifacts/hallway.png" });
  await walk(0, 10.2);
  await look(24, -15);
  await page.screenshot({ path: "artifacts/street.png" });
  await walk(10, 10);
  await walk(12, -12);
  await walk(24, -12.5);
  await interact(24, -15, 1.5, "gary");
  await dialogue();
  await page.screenshot({ path: "artifacts/starter-choice.png" });
  await page.click('[data-starter="cat"]');
  await dialogue();
  await walk(15, -8);
  await interact(13, -9, 1.3, "rival");
  await dialogue();
  await expect(page.locator("#battle")).toBeVisible();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "artifacts/first-battle.png" });
  let turns = 0;
  while (turns++ < 20) {
    await page.waitForFunction(
      () =>
        !document.getElementById("battle-continue").hidden ||
        Boolean(document.querySelector("#move-buttons button:not([disabled])")),
    );
    if (await page.locator("#battle-continue").isVisible()) break;
    await battleMenu(page, "fight");
    await page.locator("#move-buttons button").first().click();
    await page.waitForTimeout(100);
  }
  await expect(page.locator("#battle-continue")).toBeVisible();
  await page.click("#battle-continue");
  const saved = JSON.parse(
    await page.evaluate(() => localStorage.getItem("ordinary-animals-dark-v2")),
  );
  expect(saved.wins).toContain("rival");
  if (process.argv.includes("--route-one")) {
    await walk(24, -12.5);
    await interact(24, -15, 1.5, "gary");
    await dialogue();
    await walk(12, 10);
    await walk(0, 20);
    for (const [x, z] of [
      [-24, 34],
      [-60, 55],
      [-96, 76],
      [-120, 90],
      [-93, 80],
      [-93, 54.4],
    ]) {
      await walk(x, z);
      console.log(`Walked to ${x}, ${z}`);
      if (x === -60) {
        await look(-90, 70);
        await page.screenshot({ path: "artifacts/old-school-road.png" });
      }
    }
    await look(-93, 44, 3);
    await page.screenshot({ path: "artifacts/county-school.png" });
    await interact(-93, 52, 1.5, "gym0");
    await dialogue();
    for (let turn = 0; turn < 45; turn++) {
      await page.waitForFunction(
        () =>
          !document.getElementById("battle-continue").hidden ||
          Boolean(
            document.querySelector("#move-buttons button:not([disabled])"),
          ),
      );
      if (await page.locator("#battle-continue").isVisible()) break;
      const hp = (await page.locator("#ally-status").textContent()).match(
        /(\d+)\/(\d+)/,
      );
      if (
        Number(hp[1]) < Number(hp[2]) * 0.5 &&
        (await page.locator("#heal-btn").isEnabled())
      ) {
        await battleMenu(page, "bag");
        await page.click("#heal-btn");
      } else {
        const enemy = await page.locator("#enemy-name").textContent();
        await battleMenu(page, "fight");
        await page
          .locator("#move-buttons button")
          .nth(enemy === "Rat" ? 0 : 1)
          .click();
      }
      await page.waitForTimeout(100);
    }
    await page.click("#battle-continue");
    const progress = JSON.parse(
      await page.evaluate(() =>
        localStorage.getItem("ordinary-animals-dark-v2"),
      ),
    );
    expect(progress.badges).toContain(0);
    console.log(
      "PASS: real walk along Old School Road, school entrance, first badge with finite supplies",
    );
  }
  console.log(
    JSON.stringify({
      result: "Bedroom → letter → two doors → clinic → starter → rival victory",
      errors,
      stats: await page.evaluate(() => window.__debug.stats()),
    }),
  );
  expect(errors).toEqual([]);
} catch (e) {
  await page.screenshot({ path: "artifacts/opening-failure.png" });
  console.log(
    "Failure context",
    await page.evaluate(() => ({
      position: window.__debug?.position(),
      target: window.__debug?.target(),
    })),
  );
  throw e;
} finally {
  await browser.close();
}
