// Dormant semantic scene review. The explicit --run flag is mandatory.
// This does not walk routes, invoke battle logic, or prove gameplay FPS.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { summarisePerformance, summariseCpuProfile } from "../src/performance-metrics.js";

const args = process.argv.slice(2);
if (!args.includes("--run") || args.includes("--help")) {
  console.log(
    "Dormant: no browser launched. Run only when authorised:\n" +
    "node scripts/no-input-world-review.mjs --run [--cpu] [--url=http://127.0.0.1:5174] [--label=review] [--views=bedroom-spawn,clinic-gary]\n" +
    "Source-appended semantic fixtures; 2s arrival + 3s settled frame intervals per view. --cpu saves separate arrival and settled profiles. No walked traversal or gameplay FPS guarantee.",
  );
  process.exit(0);
}

const option = (name, fallback) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const url = new URL(option("url", process.env.GAME_URL || "http://127.0.0.1:5174"));
if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname))
  throw new Error("The semantic bridge is restricted to a local development server.");
const label = option("label", new Date().toISOString().replace(/[:.]/g, "-"));
if (!/^[a-zA-Z0-9_-]+$/.test(label)) throw new Error("Label must contain only letters, numbers, underscores or hyphens.");
const selectedNames = option("views", "").split(",").filter(Boolean);
const captureCpu = args.includes("--cpu");
const outputDirectory = resolve("artifacts", `no-input-world-${label}`);
const sha256 = (text) => createHash("sha256").update(text).digest("hex");
const mainPath = new URL("../src/main.js", import.meta.url);
const localMainHashBefore = sha256(await readFile(mainPath));

function metricsForWindow(taskObservation, start, end, frames) {
  const tasks = taskObservation.supported ? taskObservation.entries
    .filter((task) => task.start < end && task.start + task.duration > start)
    .map((task) => ({ ...task, measuredOverlapMs: Math.min(task.start + task.duration, end) - Math.max(task.start, start) })) : null;
  const performance = summarisePerformance(frames.map((frame) => frame.interval), tasks?.map((task) => task.duration));
  if (tasks === null) {
    performance.longTasks = null;
    performance.longestTaskMs = null;
    performance.taskTimeBeyond50ms = null;
  } else {
    performance.taskTimeBeyond50ms = tasks.reduce((sum, task) => sum + Math.max(0, Math.min(task.start + task.duration, end) - Math.max(task.start + 50, start)), 0);
  }
  return {
    performance,
    longTasks: { supported: taskObservation.supported, error: taskObservation.error, scope: "Actual Long Task entries intersecting this window; full duration and measured overlap are both retained. Blocking time is clipped to this window. Unsupported observation is null, not zero.", windowStart: start, windowEnd: end, tasks },
  };
}

// This function is serialized and appended to the served main module, so its
// references deliberately resolve against that original module's lexical scope.
// No application function bodies are replaced and the worktree is never written.
function installSemanticBridge() {
  const demandReady = () => {
    if (!renderReady || !worldInfo || $("begin").disabled)
      throw new Error("World review requested before the original load completed");
  };
  const snapshot = () => ({
    position: { x: position.x, y: position.y, z: position.z, yaw, pitch },
    camera: { x: camera.position.x, y: camera.position.y, z: camera.position.z, fov: camera.fov },
    ground: floor(position.x, position.z),
    eyeHeight: position.y - floor(position.x, position.z),
    collision: collision(position.x, position.z),
    room: roomAt(position.x, position.z),
    activeTarget: activeTarget ? { id: activeTarget.id, name: activeTarget.name, distance: activeTarget.distance, x: activeTarget.x, y: activeTarget.y, z: activeTarget.z } : null,
    render: { ...renderer.info.render },
    memory: { ...renderer.info.memory },
    textureSharing: texturePool?.stats,
    visiblePeople: actors.filter((a) => a.person && a.root.visible).map((a) => ({ name: a.root.name, x: a.root.position.x, y: a.root.position.y, z: a.root.position.z })),
    animatedScenery: actors.filter((a) => a.scenery && a.root.visible).length,
    starters: [...starterAnimals].map(([species, a]) => ({ species, visible: a.root.visible, x: a.root.position.x, y: a.root.position.y, z: a.root.position.z, clip: a.clip })),
    phoneVisible: !$("phone").hidden,
    titleVisible: !$("title").hidden,
    playing, modal, inBattle: Boolean(battle),
    doorOpen, frontOpen,
    heldKeys: keys.size,
    documentHidden: document.hidden,
    at: performance.now(),
  });
  function fixtures() {
    demandReady();
    const room = (id) => {
      const value = worldInfo.interiors.rooms.find((r) => r.id === id);
      if (!value) throw new Error(`Missing fixture room: ${id}`);
      return value;
    };
    const living = room("home-living"), kitchen = room("home-kitchen");
    const parent = room("home-parent-room"), bathroom = room("home-bathroom");
    const utility = room("home-utility"), clinic = room("county-research");
    const gary = targets.find((t) => t.id === "gary");
    if (!gary) throw new Error("Missing indoor Gary target");
    const shop = worldInfo.cornerShop;
    const view = (id, x, z, tx, tz, ty = 1.1, origin = "src/home-clinic.js") => ({ id, x, z, tx, tz, ty, origin });
    const result = [
      view("bedroom-spawn", 0, 1.8, -1.5, -3.8, 1.05, "initialSave / src/world.js bedroom"),
      view("home-hall", 0, 5.7, 0, 8.6, 1.1),
      view("home-living", living.minX + 2.8, living.maxZ - 1.3, living.maxX - 1.6, living.minZ + 1.4, 1.05),
      view("home-kitchen", kitchen.maxX - 1.2, kitchen.maxZ - 1, kitchen.minX + 2.3, kitchen.minZ + 1.8, .95),
      view("home-parent-room", parent.minX + 1.5, parent.minZ + 1.4, parent.maxX - 2, parent.minZ + 2.4, 1),
      view("home-bathroom", (bathroom.minX + bathroom.maxX) / 2, bathroom.minZ + .65, bathroom.minX + 1.5, bathroom.maxZ - 1.25, .7),
      view("home-utility", (utility.minX + utility.maxX) / 2, utility.minZ + .9, utility.maxX - 1.5, utility.maxZ - 1.5, 1),
      view("home-exterior", 0, 12, 0, 6, 1.7),
      view("clinic-entry", gary.x, clinic.maxZ - 1.5, gary.x, gary.z, 1.1),
      view("clinic-gary", gary.x, gary.z + 2.5, gary.x, gary.z, gary.height),
      view("corner-shop", shop.counterApproach.x, shop.counterApproach.z + 1.2, shop.counterApproach.x, shop.counterApproach.z - 1.9, 1, "src/corner-shop.js counterApproach"),
      view("corner-shop-front", shop.entrance.x, shop.entrance.z + 3.2, shop.entrance.x, shop.entrance.z - 1, 1.25, "src/corner-shop.js entrance"),
      view("ash-courtyard", worldInfo.towns[1].gymX - 2.5, worldInfo.towns[1].gymZ + 4.5, worldInfo.towns[1].gymX + 7, worldInfo.towns[1].gymZ - 8, 1.3, "src/ash-end.js courtyard / world towns[1]"),
    ];
    const names = ["wickmere-school", "ash-end-leader", "briarfield-leader", "north-drain-leader", "blackwood-leader", "morrow-quay-leader", "st-marrow-leader", "hollow-crown-leader"];
    worldInfo.towns.forEach((town, i) => result.push(view(names[i], town.gymX, town.gymZ + 4.4, town.gymX, town.gymZ, 1.45, `worldInfo.towns[${i}] / district leader approach`)));
    return result;
  }
  window.__noInputWorldReview = {
    ready: () => Boolean(renderReady && worldInfo && !$("begin").disabled),
    initialise() {
      demandReady();
      if (playing || battle) throw new Error("Review requires a fresh title page");
      state = initialSave();
      state.note = true;
      state.bagTaken = true;
      savedCampaign = null;
      position.set(state.position.x, floor(state.position.x, state.position.z) + EYE_HEIGHT, state.position.z);
      yaw = .34;
      pitch = -.045;
      enterWorld();
      close(false);
      lookControl.forget();
      doorOpen = true;
      frontOpen = true;
      return { fixture: { note: state.note, bagTaken: state.bagTaken, starter: state.starter, badges: state.badges, party: state.party, doorOpen, frontOpen }, views: fixtures(), snapshot: snapshot() };
    },
    fixtures,
    setView(fixture) {
      demandReady();
      if (!playing || modal || battle || keys.size) throw new Error("Unexpected gameplay state during semantic review");
      position.set(fixture.x, floor(fixture.x, fixture.z) + EYE_HEIGHT, fixture.z);
      yaw = Math.atan2(fixture.x - fixture.tx, fixture.z - fixture.tz);
      const targetY = fixture.ty + floor(fixture.tx, fixture.tz);
      pitch = Math.atan2(targetY - position.y, Math.hypot(fixture.tx - fixture.x, fixture.tz - fixture.z));
      return snapshot();
    },
    settle(start = performance.now()) {
      const until = start + 2000;
      return new Promise((resolve) => {
        const frames = [];
        let previous = start, hiddenFrames = 0;
        function observe(now) {
          if (now > previous) {
            frames.push({ start: previous, end: now, interval: now - previous });
            if (document.hidden) hiddenFrames++;
            previous = now;
          }
          if (now < until) requestAnimationFrame(observe);
          else resolve({ start, end: now, requiredMs: 2000, frames, hiddenFrames, snapshot: snapshot() });
        }
        requestAnimationFrame(observe);
      });
    },
    sample(settleMs = 2000) {
      const start = performance.now(), settleUntil = start + settleMs, end = settleUntil + 3000;
      return new Promise((resolve) => {
        const frames = [];
        let previous = null, hiddenFrames = 0;
        function observe(now) {
          if (previous !== null && previous >= settleUntil && now <= end) {
            frames.push({ start: previous, end: now, interval: now - previous });
            if (document.hidden) hiddenFrames++;
          }
          previous = now;
          if (now < end) requestAnimationFrame(observe);
          else resolve({ start, settleUntil, end, completedAt: now, frames, hiddenFrames, snapshot: snapshot() });
        }
        requestAnimationFrame(observe);
      });
    },
    snapshot,
  };
}

await mkdir(outputDirectory, { recursive: true });
const { chromium } = await import("@playwright/test");
const browser = await chromium.launch({ channel: "msedge", headless: true });
const report = {
  scope: "Source-appended semantic rendering fixtures. Explicit teleports, not walked traversal; no battle actions, keys, clicks, focus or pointer-lock input. Headless workstation frame intervals do not guarantee gameplay FPS or physical-device performance.",
  url: url.href, createdAt: new Date().toISOString(), viewport: { width: 1440, height: 960 },
  settleMs: 2000, measuredMs: 3000, localMainHashBefore,
  cpuSampling: captureCpu,
  cpuScope: captureCpu ? "Separate 1000µs CDP CPU profiles capture the arrival (started before setView, ending after its first 2s) and the following settled 3s observation. Both stop before screenshot capture and include minor CDP/evaluate boundary work plus profiling overhead. The first arrival interval begins at the semantic teleport, so it is a partial frame rather than a complete frame interval. This does not simulate walked traversal." : null,
  servedMain: null, sourceResponses: {}, navigations: [], hmrMessages: [], errors: [], invalidReasons: [], views: [],
};
const sourceReads = [];
try {
  const page = await browser.newPage({ viewport: report.viewport, deviceScaleFactor: 1 });
  const cpuSession = captureCpu ? await page.context().newCDPSession(page) : null;
  if (cpuSession) {
    await cpuSession.send("Profiler.enable");
    await cpuSession.send("Profiler.setSamplingInterval", { interval: 1000 });
  }
  const stopCpuCapture = async (file) => {
    const { profile } = await cpuSession.send("Profiler.stop");
    await writeFile(resolve(outputDirectory, file), JSON.stringify(profile));
    return { file, durationMs: (profile.endTime - profile.startTime) / 1000, samples: profile.samples?.length ?? 0, topFunctions: summariseCpuProfile(profile).slice(0, 40) };
  };
  page.on("pageerror", (error) => report.errors.push(error.message));
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame() && frame.url() !== "about:blank") report.navigations.push(frame.url());
  });
  page.on("websocket", (socket) => socket.on("framereceived", ({ payload }) => {
    try {
      const message = JSON.parse(String(payload));
      if (["update", "full-reload", "error", "prune"].includes(message.type)) report.hmrMessages.push(message);
    } catch { /* Other websocket messages are unrelated. */ }
  }));
  page.on("response", (response) => {
    const address = new URL(response.url());
    if (response.status() >= 400 && !address.pathname.endsWith("favicon.ico")) report.errors.push(`${response.status()} ${response.url()}`);
    if (address.origin === url.origin && address.pathname.includes("/src/") && address.pathname.endsWith(".js")) {
      sourceReads.push(response.text().then((text) => {
        const hash = sha256(text);
        const previous = report.sourceResponses[address.pathname];
        if (previous && previous.sha256 !== hash) report.invalidReasons.push(`Source changed during capture: ${address.pathname}`);
        report.sourceResponses[address.pathname] = { url: response.url(), sha256: hash, bytes: Buffer.byteLength(text) };
      }).catch((error) => report.errors.push(`Source capture failed: ${error.message}`)));
    }
  });
  await page.route("**/src/main.js*", async (route) => {
    const response = await route.fetch();
    const original = await response.text();
    const augmented = original + "\n;(" + installSemanticBridge.toString() + ")();\n";
    const record = { url: route.request().url(), originalSha256: sha256(original), servedSha256: sha256(augmented), originalBytes: Buffer.byteLength(original), servedBytes: Buffer.byteLength(augmented) };
    if (report.servedMain && report.servedMain.originalSha256 !== record.originalSha256)
      report.invalidReasons.push("A different main module was served during review");
    report.servedMain = record;
    await route.fulfill({ response, body: augmented });
  });
  await page.addInitScript(() => {
    const guards = { focusStubs: 0, pointerLockStubs: 0, rejectedClicks: 0 };
    window.__noInputGuards = guards;
    const noFocus = () => { guards.focusStubs++; };
    Object.defineProperty(HTMLElement.prototype, "focus", { configurable: true, value: noFocus });
    Object.defineProperty(HTMLElement.prototype, "blur", { configurable: true, value: noFocus });
    Object.defineProperty(window, "focus", { configurable: true, value: noFocus });
    Object.defineProperty(window, "blur", { configurable: true, value: noFocus });
    Object.defineProperty(Element.prototype, "requestPointerLock", { configurable: true, value: () => { guards.pointerLockStubs++; return Promise.resolve(); } });
    Object.defineProperty(Document.prototype, "exitPointerLock", { configurable: true, value: () => { guards.pointerLockStubs++; } });
    Object.defineProperty(HTMLElement.prototype, "click", { configurable: true, value: () => { guards.rejectedClicks++; throw new Error("HTMLElement.click is forbidden in the no-input world review"); } });
    const longTasks = { supported: false, error: null, entries: [] };
    let observer = null;
    const appendTasks = (entries) => {
      for (const entry of entries) longTasks.entries.push({
        start: entry.startTime, duration: entry.duration, name: entry.name,
        attribution: [...(entry.attribution ?? [])].map((item) => ({ name: item.name, containerType: item.containerType, containerId: item.containerId, containerName: item.containerName, containerSrc: item.containerSrc })),
      });
    };
    try {
      if (typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes.includes("longtask")) {
        observer = new PerformanceObserver((list) => appendTasks(list.getEntries()));
        observer.observe({ type: "longtask", buffered: true });
        longTasks.supported = true;
      }
    } catch (error) { longTasks.error = error.message; }
    window.__readObservedLongTasks = () => {
      if (observer) appendTasks(observer.takeRecords());
      return longTasks;
    };
    localStorage.setItem("ordinary-animals-settings", JSON.stringify({ quality: "high", motion: false, brightness: 1.35 }));
  });
  await page.goto(url.href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__noInputWorldReview?.ready(), undefined, { timeout: 180000 });
  report.environment = await page.evaluate(() => {
    const canvas = document.querySelector("#viewport canvas"), gl = canvas?.getContext("webgl2");
    const extension = gl?.getExtension("WEBGL_debug_renderer_info");
    return { userAgent: navigator.userAgent, gpu: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : null, pixelRatio: devicePixelRatio, drawingBuffer: gl ? { width: gl.drawingBufferWidth, height: gl.drawingBufferHeight } : null };
  });
  report.initialisation = await page.evaluate(() => window.__noInputWorldReview.initialise());
  const fixtures = report.initialisation.views.filter((view) => !selectedNames.length || selectedNames.includes(view.id));
  for (const name of selectedNames)
    if (!fixtures.some((view) => view.id === name)) throw new Error(`Unknown view: ${name}`);
  for (const fixture of fixtures) {
    if (report.navigations.length !== 1 || report.hmrMessages.length || report.invalidReasons.length)
      throw new Error("Navigation/HMR/source changes invalidate the current observation");
    let before, settling = null, cpuProfile = null, arrivalCpuProfile = null;
    if (cpuSession) {
      await cpuSession.send("Profiler.start");
      ({ before, settling } = await page.evaluate(async (view) => {
        const before = window.__noInputWorldReview.setView(view);
        const settling = await window.__noInputWorldReview.settle(before.at);
        return { before, settling };
      }, fixture));
      arrivalCpuProfile = await stopCpuCapture(`${fixture.id}.arrival.cpuprofile`);
      await cpuSession.send("Profiler.start");
    } else {
      before = await page.evaluate((view) => window.__noInputWorldReview.setView(view), fixture);
    }
    const observation = await page.evaluate((cpu) => window.__noInputWorldReview.sample(cpu ? 0 : 2000), captureCpu);
    if (cpuSession) {
      cpuProfile = await stopCpuCapture(`${fixture.id}.cpuprofile`);
    }
    const screenshot = `${fixture.id}.png`;
    const screenshotStartedAt = Date.now();
    await page.screenshot({ path: resolve(outputDirectory, screenshot) });
    const after = await page.evaluate(() => window.__noInputWorldReview.snapshot());
    const taskObservation = await page.evaluate(() => window.__readObservedLongTasks());
    const { performance: performanceSummary, longTasks } = metricsForWindow(taskObservation, observation.settleUntil, observation.end, observation.frames);
    const arrival = settling ? { observation: settling, ...metricsForWindow(taskObservation, settling.start, settling.end, settling.frames), cpuProfile: arrivalCpuProfile } : null;
    const result = { fixture, before, settling, arrival, observation, performance: performanceSummary, longTasks, cpuProfile, screenshot, screenshotStartedAt, screenshotCompletedAt: Date.now(), after, validity: [] };
    if (settling?.hiddenFrames || observation.hiddenFrames || after.documentHidden) result.validity.push("Document hidden during measurement");
    if (after.collision) result.validity.push("Fixture camera starts in a movement collider; do not treat this as a normal traversal view");
    if (after.heldKeys || after.inBattle || after.modal || !after.playing) result.validity.push("Unexpected gameplay state");
    if (Math.abs(after.eyeHeight - 1.25) > .001) result.validity.push("Camera height differs from the specified 1.25m child eye height");
    if (Math.hypot(after.position.x - fixture.x, after.position.z - fixture.z) > .001) result.validity.push("Fixture moved during observation");
    if (!observation.frames.length) result.validity.push("No settled frame intervals recorded");
    report.views.push(result);
    await writeFile(resolve(outputDirectory, "report.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ view: fixture.id, collision: after.collision, room: after.room?.id ?? null, target: after.activeTarget?.id ?? null, calls: after.render.calls, triangles: after.render.triangles, frameIntervals: result.performance, cpu: cpuProfile?.file ?? null, arrival: arrival ? { performance: arrival.performance, cpu: arrivalCpuProfile.file } : null, longTasksObserved: longTasks.supported, validity: result.validity }));
  }
  report.allLongTaskObservations = await page.evaluate(() => window.__readObservedLongTasks());
  report.guards = await page.evaluate(() => ({ ...window.__noInputGuards, pointerLockElement: document.pointerLockElement?.tagName ?? null }));
  if (report.guards.rejectedClicks || report.guards.pointerLockElement) report.invalidReasons.push("An input guard was violated");
} catch (error) {
  report.invalidReasons.push(error.stack || error.message);
  process.exitCode = 1;
} finally {
  await Promise.allSettled(sourceReads);
  report.localMainHashAfter = sha256(await readFile(mainPath));
  if (report.localMainHashAfter !== localMainHashBefore) report.invalidReasons.push("Local main.js changed during the capture");
  if (report.navigations.length !== 1) report.invalidReasons.push(`Expected one navigation, observed ${report.navigations.length}`);
  if (report.hmrMessages.length) report.invalidReasons.push("Vite hot updates occurred during the capture");
  if (!report.servedMain) report.invalidReasons.push("The main-module append route was not used");
  if (report.errors.length) report.invalidReasons.push("The page or source loading reported errors");
  report.completedAt = new Date().toISOString();
  report.valid = report.invalidReasons.length === 0 && report.views.length > 0 && report.views.every((view) => !view.validity.length);
  if (!report.valid) process.exitCode = 1;
  await writeFile(resolve(outputDirectory, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ outputDirectory, valid: report.valid, views: report.views.length, invalidReasons: report.invalidReasons }));
  await browser.close();
}
