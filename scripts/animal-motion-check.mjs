import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1000, height: 720 },
  });
  await page.addInitScript(() => {
    localStorage.setItem(
      "ordinary-animals-settings",
      JSON.stringify({ quality: "performance" }),
    );
    localStorage.setItem(
      "ordinary-animals-dark-v2",
      JSON.stringify({
        starter: "cat",
        party: [{ species: "cat", level: 7 }],
        note: true,
        wins: ["rival"],
        position: { x: -20, z: 27 },
      }),
    );
  });
  await page.goto("http://127.0.0.1:5174");
  await page.locator("#begin:not([disabled])").waitFor({ timeout: 120000 });
  await page.click("#begin");
  const initial = await page.evaluate(() => window.__debug.animals());
  console.log(
    "Blocked spawn points",
    initial.filter((a) => a.blocked),
  );
  const samples = [];
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(250);
    samples.push(
      await page.evaluate(() =>
        window.__debug.animals().find((a) => a.target === "wild0"),
      ),
    );
  }
  expect(samples.every((a) => !a.blocked)).toBe(true);
  expect(samples.some((a) => a.animation === "Walk")).toBe(true);
  let maxStep = 0;
  for (let i = 1; i < samples.length; i++)
    maxStep = Math.max(
      maxStep,
      Math.hypot(
        samples[i].x - samples[i - 1].x,
        samples[i].z - samples[i - 1].z,
      ),
    );
  expect(maxStep).toBeLessThan(0.25);
  console.log(
    "PASS: live wild rat wandered continuously without entering scenery; largest sample step",
    maxStep,
  );
} finally {
  await browser.close();
}
