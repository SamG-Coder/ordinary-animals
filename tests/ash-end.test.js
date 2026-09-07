import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildAshEnd } from "../src/ash-end.js";

test("Ash End road, courtyard entrance and leader approach remain walkable", () => {
  const catalog = JSON.parse(
    readFileSync(new URL("../game-assets/asset-catalog.json", import.meta.url)),
  );
  const obstacles = [];
  buildAshEnd({
    lamp() {},
    place(name, x, z, y = 0, angle = 0, scale = 1) {
      assert.ok(catalog[name], `Missing exported Blender module ${name}`);
      const cos = Math.cos(angle),
        sin = Math.sin(angle);
      for (const c of catalog[name].colliders ?? [])
        obstacles.push({
          name,
          x: x + (c.x * cos + c.z * sin) * scale,
          z: z + (-c.x * sin + c.z * cos) * scale,
          w: (Math.abs(c.w * cos) + Math.abs(c.d * sin)) * scale,
          d: (Math.abs(c.w * sin) + Math.abs(c.d * cos)) * scale,
        });
    },
  });
  function clear(x, z) {
    for (const c of obstacles)
      assert.ok(
        Math.abs(x - c.x) > c.w / 2 + 0.25 ||
          Math.abs(z - c.z) > c.d / 2 + 0.25,
        `${c.name} blocks ${x}, ${z}`,
      );
  }
  for (let i = 0; i <= 100; i++)
    clear(-120 - (130 * i) / 100, 90 - (110 * i) / 100);
  // Keep both lanes clear along the outgoing road, not only its centre line.
  const roadLength = Math.hypot(40, 180);
  for (let i = 0; i <= 100; i++)
    for (const side of [-1, 0, 1])
      clear(
        -250 + (40 * i) / 100 + (180 / roadLength) * side * 3.8,
        -20 - (180 * i) / 100 + (40 / roadLength) * side * 3.8,
      );
  for (let x = -250; x <= -233; x += 0.25) clear(x, -20);
  for (let z = -20; z >= -28; z -= 0.25) clear(-233, z);
  // Standing space for the notice, and the five-metre lateral battle corridor.
  clear(-227.2, -19.4);
  for (let x = -239; x <= -227; x += 0.5)
    for (let z = -27.6; z <= -25.6; z += 0.5) clear(x, z);
});
