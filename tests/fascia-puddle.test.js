import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Ray, Vector3 } from "three";
import { exportedBounds, loadCatalog } from "./lib/scene-geometry.js";

const catalog = loadCatalog();

test("the Briarfield title clears its porch canopy from a child's courtyard view", () => {
  const name = "groundskeeper-lodge";
  const title = exportedBounds(catalog, name, (node) => node.name === "Lodge sign");
  const board = exportedBounds(catalog, name, (node) => node.name === "County office sign");
  const canopy = exportedBounds(catalog, name, (node) => node.name === "Porch lead roof");
  const sill = exportedBounds(catalog, name, (node) => node.name === "Drip sill.002");
  assert.ok(board.max.y < sill.min.y, "The raised fascia collides with the attic window sill");
  assert.ok(title.min.y >= board.min.y && title.max.y <= board.max.y);
  for (const x of [-1.5, 0, 1.5]) for (const z of [11, 13, 16]) {
    const eye = new Vector3(x, 1.25, z);
    // Check the title's bottom edge as well as its centre so a partially hidden
    // word does not pass merely because its midpoint is above the canopy.
    for (const y of [title.min.y, title.getCenter(new Vector3()).y]) {
      const target = new Vector3(0, y, title.max.z);
      const hit = new Ray(eye, target.clone().sub(eye).normalize()).intersectBox(canopy, new Vector3());
      assert.ok(!hit || eye.distanceTo(hit) > eye.distanceTo(target), `Canopy hides the title from ${x},${z}`);
    }
  }
});

test("the puddle preserves its footprint and datum while exporting a single softly blended surface", () => {
  const bounds = exportedBounds(catalog, "puddle");
  const actual = [bounds.min.x, bounds.max.x, bounds.min.z, bounds.max.z, bounds.min.y, bounds.max.y];
  const original = [-.9546086788, .9317740202, -.5798925757, .5646858215, .013, .013];
  assert.ok(actual.every((value, i) => Math.abs(value - original[i]) < 1e-6), "Puddle envelope or walking grade changed");
  const bytes = readFileSync(new URL(`../game-assets/${catalog.puddle.model}`, import.meta.url));
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
  const primitives = gltf.meshes.flatMap((mesh) => mesh.primitives);
  assert.equal(primitives.length, 1, "The wet shoreline adds extra draw calls");
  assert.equal(gltf.accessors[primitives[0].indices].count, 192 * 3, "The low polygon shoreline was not smoothed");
  const material = gltf.materials[primitives[0].material];
  assert.equal(material.alphaMode, "BLEND", "A hard opacity mask recreates the cutout shoreline");
  assert.ok(material.pbrMetallicRoughness.baseColorTexture);
  assert.ok(material.pbrMetallicRoughness.metallicRoughnessTexture);
  assert.ok(material.normalTexture);
  assert.ok(gltf.images.length >= 3 && gltf.images.every((image) => image.bufferView !== undefined));
  assert.equal(catalog.puddle.colliders?.length ?? 0, 0);
});
