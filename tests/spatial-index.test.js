import test from "node:test";
import assert from "node:assert/strict";
import { createCollisionIndex, nearestLights } from "../src/spatial-index.js";

test("spatial collision queries preserve brute force results across cell boundaries", () => {
  const colliders = Array.from({ length: 800 }, (_, i) => ({
    x: ((i * 71) % 1100) - 550,
    z: ((i * 137) % 1100) - 550,
    w: 0.1 + (i % 25),
    d: 0.1 + (i % 31),
  }));
  const index = createCollisionIndex(colliders);
  let candidates = 0;
  for (let i = 0; i < 10000; i++) {
    const x = ((i * 7.131) % 1200) - 600,
      z = ((i * 3.887) % 1200) - 600;
    assert.equal(
      index.blocked(x, z),
      colliders.some(
        (c) =>
          Math.abs(x - c.x) < c.w / 2 + 0.22 &&
          Math.abs(z - c.z) < c.d / 2 + 0.22,
      ),
    );
    candidates += index.candidates(x, z);
  }
  assert.ok(
    candidates / 10000 < 4,
    `Mean candidate count: ${candidates / 10000}`,
  );
  for (const c of colliders)
    for (const sign of [-1, 1]) {
      const x = c.x + sign * (c.w / 2 + 0.22);
      assert.equal(
        index.blocked(x, c.z),
        colliders.some(
          (a) =>
            Math.abs(x - a.x) < a.w / 2 + 0.22 &&
            Math.abs(c.z - a.z) < a.d / 2 + 0.22,
        ),
      );
    }
});

test("nearest lights return stable sorted visible sources without mutating world data", () => {
  const lights = [
    { x: 100, z: 0 },
    { x: 4, z: 0 },
    { x: 3, z: 0 },
    { x: 1, z: 0 },
    { x: 2, z: 0 },
    { x: 5, z: 0 },
  ];
  const before = [...lights];
  assert.deepEqual(
    nearestLights(lights, 0, 0).map((l) => l.x),
    [1, 2, 3, 4],
  );
  assert.deepEqual(lights, before);
  assert.deepEqual(nearestLights(lights, 1000, 1000), []);
});
