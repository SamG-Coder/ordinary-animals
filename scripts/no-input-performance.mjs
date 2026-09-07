// Loads the title screen and observes rendering. No clicks, keys, pointer events,
// pointer lock, focus calls, game state writes or gameplay actions are performed.
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import {
  summarisePerformance,
  summariseCpuProfile,
} from "../src/performance-metrics.js";

const url = process.env.GAME_URL || "http://127.0.0.1:5174";
const cpu = process.argv.includes("--cpu");
const phone = process.argv.includes("--phone");
const suffix =
  process.argv.find((arg) => arg.startsWith("--label="))?.slice(8) ||
  (phone ? "phone" : "desktop");
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({
    viewport: phone
      ? { width: 390, height: 844 }
      : { width: 1440, height: 960 },
    deviceScaleFactor: 1,
    isMobile: phone,
    hasTouch: phone,
  });
  const errors = [];
  let mainFrameNavigations = 0;
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame() && frame.url() !== "about:blank")
      mainFrameNavigations++;
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400 && !response.url().endsWith("favicon.ico"))
      errors.push(`${response.status()} ${response.url()}`);
  });
  await page.addInitScript(() => {
    const capture = {
      frames: [],
      tasks: [],
      readyAt: null,
      stages: [],
      lastStage: null,
    };
    window.__pagePerformanceObservation = capture;
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          capture.tasks.push({
            start: entry.startTime,
            duration: entry.duration,
          });
      }).observe({ type: "longtask", buffered: true });
    } catch {
      /* A missing API remains visible through an empty task list. */
    }
    let last = null;
    function observe(now) {
      if (last !== null)
        capture.frames.push({
          end: now,
          interval: now - last,
          hidden: document.hidden,
        });
      last = now;
      const button = document.getElementById("begin");
      const stage = document.getElementById("loading-status")?.textContent;
      if (stage && stage !== capture.lastStage) {
        capture.stages.push({ at: performance.now(), label: stage });
        capture.lastStage = stage;
      }
      if (capture.readyAt === null && button && !button.disabled)
        capture.readyAt = performance.now();
      requestAnimationFrame(observe);
    }
    requestAnimationFrame(observe);
  });
  const session = cpu ? await page.context().newCDPSession(page) : null;
  if (session) {
    await session.send("Profiler.enable");
    await session.send("Profiler.setSamplingInterval", { interval: 1000 });
    await session.send("Profiler.start");
  }
  await page.goto(url);
  let readinessError = null;
  try {
    await page
      .locator("#begin:not([disabled])")
      .waitFor({ state: "attached", timeout: 45000 });
    await page.waitForTimeout(10000);
  } catch (error) {
    readinessError = error.message;
  }
  const observation = await page.evaluate(() => {
    const capture = window.__pagePerformanceObservation;
    const canvas = document.querySelector("#viewport canvas");
    const gl = canvas?.getContext("webgl2");
    const gpu = gl?.getExtension("WEBGL_debug_renderer_info");
    return {
      ...capture,
      browser: navigator.userAgent,
      gpu: gpu ? gl.getParameter(gpu.UNMASKED_RENDERER_WEBGL) : null,
      viewport: {
        width: innerWidth,
        height: innerHeight,
        canvasWidth: canvas?.width,
        canvasHeight: canvas?.height,
      },
      resources: performance.getEntriesByType("resource").map((entry) => ({
        name: entry.name,
        duration: entry.duration,
        transferSize: entry.transferSize,
        decodedBodySize: entry.decodedBodySize,
      })),
      navigation: performance.getEntriesByType("navigation")[0]?.toJSON(),
      sceneStats: window.__debug?.stats(),
      titleVisible: !document.getElementById("title")?.hidden,
      errorPanel: document.getElementById("error")?.textContent,
      loadingStatus: document.getElementById("loading-status")?.textContent,
      buttonDisabled: document.getElementById("begin")?.disabled,
      capturedAt: performance.now(),
    };
  });
  if (mainFrameNavigations > 1)
    readinessError ||=
      "The page navigated or reloaded during observation; timing scope is invalid.";
  if (observation.readyAt === null || observation.buttonDisabled)
    readinessError ||=
      "The final page is not ready; no settled title benchmark was observed.";
  const loadingEnd = observation.readyAt ?? observation.capturedAt;
  const titleStart =
    observation.readyAt === null ? Infinity : observation.readyAt + 1000;
  const report = {
    scope:
      "Fresh title screen only; no input or gameplay. Headless Edge on this workstation, not a physical phone benchmark.",
    cpuSampling: cpu,
    errors,
    readinessError,
    mainFrameNavigations,
    errorPanel: observation.errorPanel,
    loadingStatus: observation.loadingStatus,
    buttonDisabled: observation.buttonDisabled,
    browser: observation.browser,
    gpu: observation.gpu,
    viewport: observation.viewport,
    titleVisible: observation.titleVisible,
    readyAtMs: observation.readyAt,
    loadingStages: observation.stages,
    sceneStats: observation.sceneStats,
    loading: summarisePerformance(
      observation.frames
        .filter((f) => f.end <= loadingEnd && !f.hidden)
        .map((f) => f.interval),
      observation.tasks
        .filter((t) => t.start < loadingEnd)
        .map((t) => t.duration),
    ),
    settledTitle: summarisePerformance(
      observation.frames
        .filter((f) => f.end > titleStart && !f.hidden)
        .map((f) => f.interval),
      observation.tasks
        .filter((t) => t.start >= titleStart)
        .map((t) => t.duration),
    ),
    resources: observation.resources.sort((a, b) => b.duration - a.duration),
    navigation: observation.navigation,
  };
  await mkdir("artifacts", { recursive: true });
  if (session) {
    const { profile } = await session.send("Profiler.stop");
    report.cpuSamples = summariseCpuProfile(profile).slice(0, 40);
    await writeFile(
      `artifacts/no-input-${suffix}.cpuprofile`,
      JSON.stringify(profile),
    );
  }
  await page.screenshot({ path: `artifacts/no-input-${suffix}.png` });
  await writeFile(
    `artifacts/no-input-${suffix}.json`,
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        ...report,
        resources: report.resources.slice(0, 5),
        navigation: undefined,
      },
      null,
      2,
    ),
  );
  if (errors.length || readinessError) process.exitCode = 1;
} finally {
  await browser.close();
}
