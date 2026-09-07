import { chromium, expect } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
import { initialSave, makeAnimal, SAVE_KEY } from "../src/rules.js";

const url = process.env.GAME_URL || "http://127.0.0.1:5174";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const profiles = {};
const injectHook = process.argv.includes("--inject-hook");
const singleShadow = process.argv.includes("--single-shadow");
const verifyShadows = process.argv.includes("--verify-shadows");
try {
  for (const [name, x, z, tx, tz, pitch] of [
    ["bedroom", 0, 1.8, -1.5, -3, -0.045],
    ["old-school-road", -60, 55, -90, 70, 0.005],
    ["ash-end-approach", -185, 35, -250, -20, 0.005],
    ["ash-end-courtyard", -236, -19, -224, -37, 0.09],
  ]) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 960 },
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    if (injectHook || singleShadow || verifyShadows) {
      // An explicit local experiment changes only this browser's module response.
      // Never rewrite the worktree while another agent is authoring the game.
      if (!/^http:\/\/127\.0\.0\.1:\d+/.test(url))
        throw new Error(
          "Profiling experiments require the local development server",
        );
      await page.route("**/src/main.js*", async (route) => {
        const response = await route.fetch();
        let body = await response.text();
        if (singleShadow) {
          if (!body.includes("renderer.info.reset();"))
            throw new Error("Cannot locate the frame render boundary");
          body = body.replace(
            "renderer.info.reset();",
            "renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true; renderer.info.reset();",
          );
        }
        if (injectHook)
          body +=
            '\nif (window.__debug) window.__debug.renderProfile = async (frames = 6) => (await import("/src/render-diagnostics.js")).captureRenderProfile({ renderer, scene, camera, assets }, frames);\n';
        if (verifyShadows)
          body += `
window.__shadowComparison = () => {
  const previousAutoUpdate = renderer.shadowMap.autoUpdate;
  const gl = renderer.getContext();
  const readFrame = () => {
    const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    return pixels;
  };
  // Consecutive renders within one task share every animation transform and
  // random sample. Only the redundant normal-pass shadow update changes.
  renderer.shadowMap.autoUpdate = true;
  renderer.info.reset();
  composer.render();
  const beforeStats = { ...renderer.info.render };
  const before = readFrame();
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.info.reset();
  composer.render();
  const afterStats = { ...renderer.info.render };
  const after = readFrame();
  let changedPixels = 0, maxChannelDifference = 0;
  for (let i = 0; i < before.length; i += 4) {
    let changed = false;
    for (let channel = 0; channel < 4; channel++) {
      const difference = Math.abs(before[i + channel] - after[i + channel]);
      maxChannelDifference = Math.max(maxChannelDifference, difference);
      changed ||= difference !== 0;
    }
    if (changed) changedPixels++;
  }
  renderer.shadowMap.autoUpdate = previousAutoUpdate;
  renderer.shadowMap.needsUpdate = true;
  return { beforeStats, afterStats, changedPixels, maxChannelDifference, pixels: before.length / 4 };
};
`;
        await route.fulfill({ response, body });
      });
    }
    await page.addInitScript(
      ({ key, save }) => {
        localStorage.setItem(key, JSON.stringify(save));
        localStorage.setItem(
          "ordinary-animals-settings",
          JSON.stringify({ quality: "high", motion: false }),
        );
      },
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
    await page.waitForTimeout(2000);
    expect(
      await page.evaluate(() => typeof window.__debug?.renderProfile),
    ).toBe("function");
    profiles[name] = await page.evaluate(() => window.__debug.renderProfile(6));
    if (verifyShadows) {
      profiles[name].shadowComparison = await page.evaluate(() =>
        window.__shadowComparison(),
      );
      expect(profiles[name].shadowComparison.changedPixels).toBe(0);
      await page.screenshot({
        path: `artifacts/render-shadow-check-${name}.png`,
      });
    }
    expect(errors).toEqual([]);
    console.log(
      name,
      JSON.stringify({
        calls: profiles[name].calls,
        triangles: profiles[name].triangles,
        passes: profiles[name].passes,
        shadowComparison: profiles[name].shadowComparison,
        top: profiles[name].rows.slice(0, 12),
      }),
    );
    await page.close();
  }
  await mkdir("artifacts", { recursive: true });
  const suffix =
    process.argv.find((arg) => arg.startsWith("--label="))?.slice(8) ||
    "current";
  await writeFile(
    `artifacts/render-profile-${suffix}.json`,
    JSON.stringify(profiles, null, 2),
  );
} finally {
  await browser.close();
}
