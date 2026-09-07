import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildBriarfield, insertBriarfieldRoadDetour } from "../src/briarfield.js";

test("Briarfield gate, six-metre battle space and diverted carriageway stay clear", () => {
  const catalog = JSON.parse(readFileSync(new URL("../game-assets/asset-catalog.json", import.meta.url)));
  const obstacles = [];
  buildBriarfield({
    lamp() {},
    place(name, x, z, y = 0, angle = 0, scale = 1) {
      assert.ok(catalog[name], `Missing Blender source/export ${name}`);
      const cos = Math.cos(angle), sin = Math.sin(angle);
      for (const c of catalog[name].colliders ?? []) obstacles.push({
        name,
        x: x + (c.x * cos + c.z * sin) * scale,
        z: z + (-c.x * sin + c.z * cos) * scale,
        w: (Math.abs(c.w * cos) + Math.abs(c.d * sin)) * scale,
        d: (Math.abs(c.w * sin) + Math.abs(c.d * cos)) * scale,
      });
    },
  });
  const clear = (x, z) => {
    for (const c of obstacles)
      assert.ok(Math.abs(x - c.x) > c.w / 2 + .22 || Math.abs(z - c.z) > c.d / 2 + .22, `${c.name} blocks ${x}, ${z}`);
  };
  for (let x = -210; x <= -193; x += .1) clear(x, -200);
  for (let z = -200; z >= -212; z -= .1) clear(-193, z);
  for (let x = -196; x <= -190; x += .25)
    for (let z = -212; z <= -206; z += .25) clear(x, z);
  const route = insertBriarfieldRoadDetour([[-250, -20], [-210, -200], [-45, -295]]);
  assert.deepEqual(route, [[-250, -20], [-210, -200], [-210, -228], [-175, -242], [-45, -295]]);
  for (let leg = 0; leg < route.length - 1; leg++) {
    const [ax, az] = route[leg], [bx, bz] = route[leg + 1];
    const dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz);
    for (let i = 0; i <= Math.ceil(length * 4); i++) {
      const t = i / Math.ceil(length * 4);
      for (const lane of [-3.8, 0, 3.8]) clear(ax + dx * t - dz / length * lane, az + dz * t + dx / length * lane);
    }
  }
});
