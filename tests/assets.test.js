import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const catalog = JSON.parse(fs.readFileSync("game-assets/asset-catalog.json"));
test("every catalog entry has a separate Blender source and GLB export", () => {
  assert.ok(Object.keys(catalog).length >= 50);
  for (const [name, a] of Object.entries(catalog)) {
    assert.ok(fs.existsSync(a.source), name + " source");
    assert.ok(fs.existsSync("game-assets/" + a.model), name + " export");
  }
  assert.equal(catalog.region, undefined);
  assert.equal(catalog.bedroom, undefined);
});
test("animals contain all five authored animation clips", () => {
  for (const name of [
    "cat",
    "dog",
    "hamster",
    "rat",
    "rabbit",
    "fox",
    "raccoon",
    "goat",
  ]) {
    const b = fs.readFileSync("game-assets/" + catalog[name].model);
    const data = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)));
    const names = data.animations.map((a) => a.name);
    assert.ok(data.skins?.length > 0, `${name}: real skeletal skin`);
    for (const expected of ["Idle", "Walk", "Attack", "Hit", "Faint"])
      assert.ok(names.includes(expected), `${name}: ${expected}`);
  }
});

test("the environment panorama has its own Blender authoring source", () => {
  const lighting = JSON.parse(
    fs.readFileSync("game-assets/world-lighting.json"),
  );
  assert.ok(fs.existsSync(lighting.source));
  assert.ok(fs.existsSync("game-assets/" + lighting.environment));
});
test("the runtime assembles asset instances without generating world mesh primitives", () => {
  const src =
    fs.readFileSync("src/world.js", "utf8") +
    fs.readFileSync("src/main.js", "utf8");
  assert.ok(
    !/new THREE\.(Box|Plane|Sphere|Cylinder|Cone|Torus|Circle|Shape|Extrude)Geometry/.test(
      src,
    ),
  );
});
