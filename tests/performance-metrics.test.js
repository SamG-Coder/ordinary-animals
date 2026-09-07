import test from "node:test";
import assert from "node:assert/strict";
import {
  summarisePerformance,
  summariseCpuProfile,
} from "../src/performance-metrics.js";

test("hitch summary preserves stalls and uses strict timing thresholds", () => {
  const summary = summarisePerformance(
    [10, 20, 50, 100, 150],
    [40, 50, 75, 120],
  );
  assert.equal(summary.frames, 5);
  assert.equal(summary.p50FrameMs, 50);
  assert.equal(summary.p95FrameMs, 150);
  assert.equal(summary.longestFrameMs, 150);
  assert.equal(summary.framesOver50ms, 2);
  assert.equal(summary.framesOver100ms, 1);
  assert.equal(summary.taskTimeBeyond50ms, 95);
});

test("missing and invalid timing samples remain unavailable", () => {
  const summary = summarisePerformance([NaN, Infinity, 0, -1]);
  assert.equal(summary.frames, 0);
  assert.equal(summary.p95FrameMs, null);
  assert.equal(summary.meanFrameMs, null);
  assert.equal(summary.longestTaskMs, null);
});

test("CPU sample attribution uses measured deltas and source locations", () => {
  const rows = summariseCpuProfile({
    nodes: [
      {
        id: 1,
        callFrame: { functionName: "frame", url: "/main.js", lineNumber: 20 },
      },
      {
        id: 2,
        callFrame: {
          functionName: "sampleSurface",
          url: "/terrain.js",
          lineNumber: 9,
        },
      },
    ],
    samples: [1, 2, 2],
    timeDeltas: [1000, 2000, 3000],
  });
  assert.equal(rows[0].function, "sampleSurface");
  assert.equal(rows[0].sampledMs, 5);
  assert.equal(rows[0].line, 10);
  assert.equal(rows[1].sampledMs, 1);
});
