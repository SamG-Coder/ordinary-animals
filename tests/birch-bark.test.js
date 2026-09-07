import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { exportedBounds, loadCatalog } from "./lib/scene-geometry.js";

test("the preserved birch trunk exports its own embedded bark colour, normal and roughness maps", () => {
  const catalog = loadCatalog();
  const bytes = readFileSync(new URL(`../game-assets/${catalog.birch.model}`, import.meta.url));
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
  const trunk = gltf.nodes.find((node) => node.name.startsWith("Trunk"));
  const material = gltf.materials[gltf.meshes[trunk.mesh].primitives[0].material];
  assert.equal(material.name, "birch-papery-bark");
  assert.ok(material.pbrMetallicRoughness.baseColorTexture);
  assert.ok(material.pbrMetallicRoughness.metallicRoughnessTexture);
  assert.ok(material.normalTexture);
  assert.ok(gltf.images.every((image) => image.bufferView !== undefined));
  const bounds = exportedBounds(catalog, "birch", (node) => node.name.startsWith("Trunk"));
  assert.ok(Math.abs(bounds.min.y) < 1e-6 && Math.abs(bounds.max.y - 8) < 1e-6);
  assert.ok(Math.abs(bounds.max.x - bounds.min.x - .32) < 1e-6);
  assert.equal(gltf.nodes.filter((node) => /^Bare branch/.test(node.name)).length, 12);
  assert.equal(gltf.nodes.filter((node) => /^Twig/.test(node.name)).length, 48);
  assert.equal(gltf.animations?.length ?? 0, 0);
});
