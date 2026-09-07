import test from "node:test";
import assert from "node:assert/strict";
import {
  createWander,
  updateWander,
  followTrail,
  clearSegment,
} from "../src/animal-motion.js";

test("wild movement stays continuous, avoids obstacles and pauses for interaction", () => {
  const animal = createWander("cat", 0, 0, 41);
  const blocked = (x, z) => x > 0.8 && x < 2 && Math.abs(z) < 2;
  let walked = false;
  for (let frame = 0; frame < 3000; frame++) {
    const previous = { ...animal };
    const moving = updateWander(animal, 0.02, { x: 20, z: 20 }, blocked);
    walked = walked || moving;
    assert.ok(
      Math.hypot(animal.x - previous.x, animal.z - previous.z) <=
        0.55 * 0.02 + 1e-8,
    );
    assert.ok(!blocked(animal.x, animal.z));
  }
  assert.ok(walked);
  const before = { x: animal.x, z: animal.z };
  assert.equal(
    updateWander(animal, 1, { x: animal.x + 2, z: animal.z }, blocked),
    false,
  );
  assert.deepEqual({ x: animal.x, z: animal.z }, before);
  assert.equal(
    updateWander(animal, 10, { x: 20, z: 20 }, blocked, true),
    false,
  );
  assert.deepEqual({ x: animal.x, z: animal.z }, before);
});
test("a companion follows the walked corner without cutting through a wall", () => {
  const current = { x: 0, z: 0 },
    trail = [];
  const blocked = (x, z) => x > 1 && x < 2 && z > 0.5 && z < 2.5;
  const route = [];
  for (let x = 0; x <= 3; x += 0.1) route.push({ x, z: 0 });
  for (let z = 0; z <= 3; z += 0.1) route.push({ x: 3, z });
  for (let i = 0; i < 100; i++) route.push({ x: 3, z: 3 });
  for (const player of route) {
    const previous = { ...current };
    followTrail(current, trail, player, 0.04, blocked);
    assert.ok(clearSegment(previous, current, blocked));
    assert.ok(
      Math.hypot(current.x - previous.x, current.z - previous.z) <=
        3.8 * 0.04 + 1e-8,
    );
  }
  assert.ok(Math.hypot(current.x - 3, current.z - 3) < 1.5);
});
test("a shut door stops the companion until the passage opens", () => {
  const current = { x: 0, z: 0 },
    trail = [{ x: 0, z: 3 }];
  assert.equal(
    followTrail(
      current,
      trail,
      { x: 0, z: 3 },
      1,
      (x, z) => z > 0.9 && z < 1.1,
    ),
    false,
  );
  assert.deepEqual(current, { x: 0, z: 0 });
  assert.equal(
    followTrail(current, trail, { x: 0, z: 3 }, 0.1, () => false),
    true,
  );
});
