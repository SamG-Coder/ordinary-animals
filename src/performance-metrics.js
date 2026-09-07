// Shared by the no-input diagnostic script. Frame interval statistics describe
// the observed page; they are not a substitute for a gameplay/device benchmark.
export function summarisePerformance(frameIntervals, longTasks = []) {
  const frames = frameIntervals.filter((v) => Number.isFinite(v) && v > 0);
  const sorted = [...frames].sort((a, b) => a - b);
  const tasks = longTasks.filter((v) => Number.isFinite(v) && v >= 0);
  const quantile = (fraction) =>
    sorted.length
      ? sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)]
      : null;
  const observedMs = frames.reduce((sum, value) => sum + value, 0);
  return {
    frames: frames.length,
    observedMs,
    meanFrameMs: frames.length ? observedMs / frames.length : null,
    p50FrameMs: quantile(0.5),
    p95FrameMs: quantile(0.95),
    p99FrameMs: quantile(0.99),
    longestFrameMs: sorted.at(-1) ?? null,
    framesOver33ms: frames.filter((value) => value > 1000 / 30).length,
    framesOver50ms: frames.filter((value) => value > 50).length,
    framesOver100ms: frames.filter((value) => value > 100).length,
    longTasks: tasks.length,
    longestTaskMs: tasks.length ? Math.max(...tasks) : null,
    // Sum of each main-thread task's portion beyond the 50 ms threshold.
    taskTimeBeyond50ms: tasks.reduce(
      (sum, value) => sum + Math.max(0, value - 50),
      0,
    ),
  };
}

export function summariseCpuProfile(profile) {
  const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
  const samples = new Map();
  for (let i = 0; i < (profile.samples?.length || 0); i++) {
    const node = nodes.get(profile.samples[i]);
    if (!node) continue;
    const fn = node.callFrame;
    const key = `${fn.functionName}:${fn.url}:${fn.lineNumber}`;
    if (!samples.has(key))
      samples.set(key, {
        function: fn.functionName || "(anonymous)",
        url: fn.url,
        line: fn.lineNumber + 1,
        sampledMs: 0,
        samples: 0,
      });
    const row = samples.get(key);
    row.sampledMs += (profile.timeDeltas?.[i] || 0) / 1000;
    row.samples++;
  }
  return [...samples.values()].sort((a, b) => b.sampledMs - a.sampledMs);
}
