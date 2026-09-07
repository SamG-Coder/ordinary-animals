// Development-only, opt-in draw accounting. This observes submitted draw calls;
// it does not alter visibility, camera, materials, animation or scene geometry.
export async function captureRenderProfile(
  { renderer, scene, camera, assets },
  requestedFrames = 6,
) {
  const frames = Math.max(1, Math.min(60, Math.floor(requestedFrames)));
  const geometryAssets = new Map();
  for (const [name, asset] of Object.entries(assets)) {
    asset.scene.traverse((object) => {
      if (object.geometry) geometryAssets.set(object.geometry.uuid, name);
    });
  }
  const buckets = new Map();
  const original = renderer.renderBufferDirect;
  let totalCalls = 0;
  let totalTriangles = 0;
  renderer.renderBufferDirect = function (
    drawCamera,
    drawScene,
    geometry,
    material,
    object,
    group,
  ) {
    const callsBefore = this.info.render.calls;
    const trianglesBefore = this.info.render.triangles;
    const result = original.call(
      this,
      drawCamera,
      drawScene,
      geometry,
      material,
      object,
      group,
    );
    const calls = this.info.render.calls - callsBefore;
    const triangles = this.info.render.triangles - trianglesBefore;
    const pass =
      drawScene === null
        ? `shadow${scene.overrideMaterial ? "-during-normal" : "-during-color"}`
        : drawCamera === camera
          ? scene.overrideMaterial
            ? "normal"
            : "color"
          : "postprocessing";
    const asset =
      geometryAssets.get(geometry.uuid) ||
      (assets[object.name] ? object.name : object.name || object.type);
    const key = `${pass}:${asset}`;
    if (!buckets.has(key))
      buckets.set(key, {
        pass,
        asset,
        calls: 0,
        triangles: 0,
        objects: new Set(),
      });
    const bucket = buckets.get(key);
    bucket.calls += calls;
    bucket.triangles += triangles;
    bucket.objects.add(object.uuid);
    totalCalls += calls;
    totalTriangles += triangles;
    return result;
  };
  try {
    for (let frame = 0; frame < frames; frame++)
      await new Promise((resolve) => requestAnimationFrame(resolve));
  } finally {
    renderer.renderBufferDirect = original;
  }
  const rows = [...buckets.values()]
    .map((row) => ({
      pass: row.pass,
      asset: row.asset,
      calls: row.calls / frames,
      triangles: row.triangles / frames,
      objects: row.objects.size,
    }))
    .sort((a, b) => b.calls - a.calls || b.triangles - a.triangles);
  const passes = {};
  for (const row of rows) {
    passes[row.pass] ||= { calls: 0, triangles: 0 };
    passes[row.pass].calls += row.calls;
    passes[row.pass].triangles += row.triangles;
  }
  return {
    frames,
    viewport: {
      width: innerWidth,
      height: innerHeight,
      pixelRatio: renderer.getPixelRatio(),
    },
    calls: totalCalls / frames,
    triangles: totalTriangles / frames,
    passes,
    rows,
  };
}
