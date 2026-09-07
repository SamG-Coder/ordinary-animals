import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCatalog, exportedBounds } from "./lib/scene-geometry.js";

const catalog = loadCatalog();
const names = [
  "asphalt-repair-2m",
  "shallow-road-scar-1m",
  "cast-iron-manhole",
];

test("Blender road wear remains within 18 mm of the road datum without movement colliders", () => {
  for (const name of names) {
    const entry = catalog[name];
    assert.ok(entry, `Missing exported road-wear asset ${name}`);
    assert.equal(
      entry.colliders?.length ?? 0,
      0,
      `${name} must not block the flat walking surface`,
    );
    const bounds = exportedBounds(catalog, name);
    assert.ok(
      bounds.min.y >= -0.00001,
      `${name} sinks below its road datum: ${bounds.min.y} m`,
    );
    assert.ok(
      bounds.max.y <= 0.018,
      `${name} rises above the agreed 18 mm detail height: ${bounds.max.y} m`,
    );
    assert.ok(
      bounds.max.x - bounds.min.x < 2.3,
      `${name} exceeds the compact module footprint`,
    );
    const binary = readFileSync(
      new URL(`../game-assets/${entry.model}`, import.meta.url),
    );
    const gltf = JSON.parse(binary.subarray(20, 20 + binary.readUInt32LE(12)));
    assert.ok(
      gltf.images.length >= 3,
      `${name} has lost its original surface maps`,
    );
    for (const image of gltf.images) {
      assert.equal(image.uri, undefined, `${name} refers to an external image`);
      assert.ok(
        Number.isInteger(image.bufferView),
        `${name} texture is not embedded in the GLB`,
      );
    }
    assert.ok(
      gltf.materials.some(
        (m) =>
          m.normalTexture &&
          m.pbrMetallicRoughness.baseColorTexture &&
          m.pbrMetallicRoughness.metallicRoughnessTexture,
      ),
      `${name} needs albedo, normal and roughness textures together`,
    );
  }
});
