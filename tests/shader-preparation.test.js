import test from "node:test";
import assert from "node:assert/strict";
import {
  finishPreparedPrograms,
  prepareWorldShaders,
} from "../src/shader-preparation.js";

test("shader preparation waits for every shared-material variant before finalization", async () => {
  let yielded = 0;
  const finished = [];
  const programs = [0, 1, 2].map((readyAfter) => ({
    isReady: () => yielded >= readyAfter,
    getUniforms() {
      assert.ok(
        yielded >= readyAfter,
        "must not synchronously finalize a pending link",
      );
      finished.push(readyAfter);
    },
  }));
  const count = await finishPreparedPrograms(
    { info: { programs } },
    {
      yieldFrame: async () => {
        yielded++;
      },
      now: () => 0,
    },
  );
  assert.equal(count, 3);
  assert.deepEqual(finished, [0, 1, 2]);
  assert.equal(yielded, 2);
});

test("ready shader finalization yields when its loading budget is spent", async () => {
  let clock = 0,
    yields = 0,
    finished = 0;
  const programs = Array.from({ length: 5 }, () => ({
    isReady: () => true,
    getUniforms() {
      finished++;
      clock += 2;
    },
  }));
  await finishPreparedPrograms(
    { info: { programs } },
    {
      now: () => clock,
      budgetMs: 3,
      yieldFrame: async () => {
        yields++;
      },
    },
  );
  assert.equal(finished, 5);
  assert.equal(yields, 2);
});

function fixture(failNormals = false) {
  const worldTarget = {},
    normalTarget = {},
    previousTarget = {};
  const normalMaterial = {},
    single = {},
    array = [{}, {}];
  const meshes = [
    { isMesh: true, material: single },
    { isMesh: true, material: array },
  ];
  const scene = {
    traverse(fn) {
      meshes.forEach(fn);
      fn({ isLight: true });
    },
  };
  const flashlight = { visible: true },
    battleLight = { visible: false };
  let target = previousTarget;
  const calls = [];
  const renderer = {
    info: { programs: [] },
    getRenderTarget: () => target,
    setRenderTarget(value) {
      target = value;
    },
    async compileAsync() {
      calls.push({
        target,
        torch: flashlight.visible,
        battle: battleLight.visible,
      });
      if (target === normalTarget) {
        assert.ok(meshes.every((mesh) => mesh.material === normalMaterial));
        if (failNormals) throw new Error("normal shader failed");
      } else {
        assert.equal(
          target,
          worldTarget,
          "world must compile for composer output",
        );
        assert.equal(meshes[0].material, single);
        assert.equal(meshes[1].material, array);
      }
    },
  };
  return {
    args: {
      renderer,
      scene,
      camera: {},
      worldTarget,
      normalTarget,
      normalMaterial,
      flashlight,
      battleLight,
    },
    calls,
    assertRestored() {
      assert.equal(target, previousTarget);
      assert.equal(meshes[0].material, single);
      assert.equal(
        meshes[1].material,
        array,
        "preserve multi-material array identity",
      );
      assert.equal(flashlight.visible, true);
      assert.equal(battleLight.visible, false);
    },
  };
}

test("world and normal passes compile actual targets and restore scene state", async () => {
  const f = fixture();
  await prepareWorldShaders(f.args);
  assert.deepEqual(
    f.calls.slice(0, 4).map((c) => [c.torch, c.battle]),
    [
      [false, false],
      [true, false],
      [false, true],
      [true, true],
    ],
  );
  assert.equal(f.calls.length, 8);
  assert.deepEqual(
    f.calls.slice(4).map((c) => [c.torch, c.battle]),
    [
      [false, false],
      [true, false],
      [false, true],
      [true, true],
    ],
  );
  assert.ok(f.calls.slice(4).every((c) => c.target === f.args.normalTarget));
  f.assertRestored();
});

test("failed normal compilation restores materials, target and lights", async () => {
  const f = fixture(true);
  await assert.rejects(prepareWorldShaders(f.args), /normal shader failed/);
  f.assertRestored();
});
