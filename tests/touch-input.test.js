import test from "node:test";
import assert from "node:assert/strict";
import { createTouchInput } from "../src/touch-input.js";

test("joystick deadzone, analogue travel and diagonal cap", () => {
  const input = createTouchInput();
  input.beginMove(1, 100, 100, 100, 100, 40);
  assert.deepEqual(input.axes, { x: 0, z: 0 });
  input.move(1, 102, 100);
  assert.equal(input.axes.x, 0);
  input.move(1, 120, 100);
  assert.ok(input.axes.x > 0.4 && input.axes.x < 0.5);
  input.move(1, 200, 0);
  assert.ok(Math.abs(Math.hypot(input.axes.x, input.axes.z) - 1) < 1e-9);
  assert.ok(input.axes.x > 0 && input.axes.z < 0, "Up on stick must move forward");
  assert.ok(Math.abs(Math.hypot(input.knob.x, input.knob.y) - 40) < 1e-9);
});

test("movement and look fingers work simultaneously without cross-contamination", () => {
  const input = createTouchInput();
  input.beginMove(7, 100, 60, 100, 100, 40);
  input.beginLook(9, 300, 100);
  assert.deepEqual(input.rotate(9, 310, 95), { x: 10, y: -5 });
  assert.equal(input.rotate(7, 200, 200), null);
  assert.equal(input.move(9, 400, 400), false);
  assert.equal(input.axes.z, -1);
  input.end(7);
  assert.deepEqual(input.axes, { x: 0, z: 0 });
  assert.deepEqual(input.rotate(9, 315, 105), { x: 5, y: 10 });
});

test("releasing a look or unrelated finger does not interrupt movement", () => {
  const input = createTouchInput();
  input.beginMove(0, 0, -40, 0, 0, 40);
  input.beginLook(2, 200, 100);
  input.end(2); input.end(15);
  assert.equal(input.axes.z, -1);
  assert.equal(input.rotate(2, 300, 100), null);
  assert.equal(input.beginLook(3, 300, 200), true);
  assert.deepEqual(input.rotate(3, 302, 199), { x: 2, y: -1 });
});

test("a pointer cannot own multiple controls and a second thumb cannot steal one", () => {
  const input = createTouchInput();
  assert.equal(input.beginMove(1, 0, 0, 0, 0, 40), true);
  assert.equal(input.beginMove(2, 40, 40, 0, 0, 40), false);
  assert.equal(input.beginLook(1, 200, 0), false);
  assert.equal(input.beginSprint(1), false);
  assert.equal(input.beginSprint(3), true);
  assert.equal(input.beginSprint(4), false);
  input.end(4);
  assert.equal(input.sprinting, true);
  input.end(3);
  assert.equal(input.sprinting, false);
});

test("menu, focus and resize resets release all movement, look and sprint state", () => {
  const input = createTouchInput();
  input.beginMove(1, 40, 40, 0, 0, 40);
  input.beginLook(2, 200, 0);
  input.beginSprint(3);
  input.reset();
  assert.deepEqual(input.axes, { x: 0, z: 0 });
  assert.deepEqual(input.knob, { x: 0, y: 0 });
  assert.equal(input.sprinting, false);
  assert.equal(input.rotate(2, 300, 100), null);
  assert.equal(input.beginMove(4, 0, -40, 0, 0, 40), true);
});
