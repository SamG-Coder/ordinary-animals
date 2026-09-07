import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildRouteOne } from "../src/route-one.js";

test("route dressing leaves the road and school entrance walkable", () => {
  const catalog = JSON.parse(
    readFileSync(new URL("../game-assets/asset-catalog.json", import.meta.url)),
  );
  const obstacles = [];
  buildRouteOne({
    lamp() {},
    place(name, x, z, y = 0, angle = 0, scale = 1) {
      const cos = Math.cos(angle),
        sin = Math.sin(angle);
      if (name === "bus-shelter") {
        const length = Math.hypot(120, 70);
        assert.ok(
          Math.abs((-120 * cos - 70 * sin) / length) > 0.999,
          "the shelter's long edge must run parallel to the road",
        );
        assert.ok(
          (-70 * sin - 120 * cos) / length > 0.999,
          "the shelter opening must face the carriageway",
        );
      }
      for (const c of catalog[name].colliders ?? []) {
        obstacles.push({
          name,
          x: x + (c.x * cos + c.z * sin) * scale,
          z: z + (-c.x * sin + c.z * cos) * scale,
          w: (Math.abs(c.w * cos) + Math.abs(c.d * sin)) * scale,
          d: (Math.abs(c.w * sin) + Math.abs(c.d * cos)) * scale,
        });
      }
    },
  });
  function clear(x, z) {
    for (const c of obstacles)
      assert.ok(
        Math.abs(x - c.x) > c.w / 2 + 0.25 ||
          Math.abs(z - c.z) > c.d / 2 + 0.25,
        `${c.name} blocks the walking route at ${x}, ${z}`,
      );
  }
  for (let i = 15; i <= 96; i++) clear((-120 * i) / 100, 20 + (70 * i) / 100);
  for (let z = 54; z <= 82; z += 0.5) clear(-93, z);
});
