import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Box3, Group, Matrix4, Quaternion, Scene, Vector3 } from "three";
import { assembleWorld } from "../src/world.js";
import { createTerrain } from "../src/terrain.js";
import { CORNER_SHOP_ROOM } from "../src/corner-shop.js";

const root = new URL("../", import.meta.url);
const catalog = JSON.parse(
  readFileSync(new URL("game-assets/asset-catalog.json", root)),
);
// Actual world assembly supplies all nearby houses, bins, lamps and colliders.
// Empty mesh containers avoid rendering while preserving production placement.
const assets = Object.fromEntries(
  Object.keys(catalog).map((name) => [
    name,
    { scene: new Group(), animations: [] },
  ]),
);
const assembled = assembleWorld(new Scene(), assets, catalog, []);
const terrain = createTerrain(catalog);
const cache = new Map();
function model(name) {
  if (cache.has(name)) return cache.get(name);
  const bytes = readFileSync(
    new URL(`game-assets/${catalog[name].model}`, root),
  );
  const jsonSize = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.toString("utf8", 20, 20 + jsonSize));
  const binaryStart = 28 + jsonSize;
  function accessor(index) {
    const a = gltf.accessors[index],
      view = gltf.bufferViews[a.bufferView];
    assert.ok(!a.sparse, "These static asset accessors must be dense");
    const count = { SCALAR: 1, VEC3: 3 }[a.type];
    const componentBytes = { 5126: 4, 5123: 2, 5125: 4, 5121: 1 }[
      a.componentType
    ];
    assert.ok(count && componentBytes);
    const start = binaryStart + (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
    return Array.from({ length: a.count }, (_, i) =>
      Array.from({ length: count }, (_, j) => {
        const offset =
          start +
          i * (view.byteStride ?? count * componentBytes) +
          j * componentBytes;
        return a.componentType === 5126
          ? bytes.readFloatLE(offset)
          : bytes.readUIntLE(offset, componentBytes);
      }),
    );
  }
  const box = new Box3(),
    triangles = [];
  function visit(index, parent = new Matrix4()) {
    const node = gltf.nodes[index];
    const transform = node.matrix
      ? new Matrix4().fromArray(node.matrix)
      : new Matrix4().compose(
          new Vector3(...(node.translation ?? [0, 0, 0])),
          new Quaternion(...(node.rotation ?? [0, 0, 0, 1])),
          new Vector3(...(node.scale ?? [1, 1, 1])),
        );
    transform.premultiply(parent);
    if (node.mesh !== undefined)
      for (const p of gltf.meshes[node.mesh].primitives) {
        const position = gltf.accessors[p.attributes.POSITION];
        box.union(
          new Box3(
            new Vector3(...position.min),
            new Vector3(...position.max),
          ).applyMatrix4(transform),
        );
        if (name === "corner-shopfront8m") {
          const points = accessor(p.attributes.POSITION).map((point) =>
            new Vector3(...point).applyMatrix4(transform),
          );
          const indices =
            p.indices === undefined
              ? points.map((_, i) => i)
              : accessor(p.indices).flat();
          for (let i = 0; i < indices.length; i += 3)
            triangles.push(
              indices.slice(i, i + 3).map((index) => points[index]),
            );
        }
      }
    for (const child of node.children ?? []) visit(child, transform);
  }
  for (const node of gltf.scenes[gltf.scene ?? 0].nodes) visit(node);
  const result = { gltf, box, triangles };
  cache.set(name, result);
  return result;
}

function layout() {
  const fixtures = new Set([
    "corner-shopfront8m",
    "corner-shop-counter",
    "corner-shop-shelf",
    "corner-shop-pharmacy",
    "corner-shop-sign",
    "wall-4m",
    "exterior-wall-4m",
    "domestic-tile-floor-4m",
    "ceiling-4m",
    "roof-4m",
    "path-2m",
    "interior-ceiling-light",
  ]);
  const placements = assembled.placementLog
    .filter(
      (p) =>
        fixtures.has(p.asset) &&
        p.x > -46.4 &&
        p.x < -37.6 &&
        p.z > 2.6 &&
        p.z < 15.1,
    )
    .map((p) => ({ ...p, name: p.asset, angle: p.ry }));
  const obstacles = assembled.info.collisions.filter(
    (c) => Math.abs(c.x + 42) < 12 && c.z > -3 && c.z < 17,
  );
  const metadata = assembled.info.cornerShop;
  assert.ok(
    metadata,
    "Production world must expose the integrated shop metadata",
  );
  assert.equal(
    placements.filter((p) => p.name === "corner-shopfront8m").length,
    1,
    "Shopfront is missing or placed twice",
  );
  assert.equal(
    placements.filter((p) => p.name === "corner-shop-shelf").length,
    4,
    "All four shelves must be present exactly once",
  );
  const blocked = (x, z, radius = 0.22) =>
    obstacles.find(
      (c) =>
        Math.abs(x - c.x) < c.w / 2 + radius &&
        Math.abs(z - c.z) < c.d / 2 + radius,
    );
  return { placements, metadata, blocked };
}
function placedBox(p) {
  return model(p.name ?? p.asset)
    .box.clone()
    .applyMatrix4(
      new Matrix4().compose(
        new Vector3(p.x, p.y, p.z),
        new Quaternion().setFromAxisAngle(
          new Vector3(0, 1, 0),
          p.angle ?? p.ry,
        ),
        new Vector3(p.scale, p.scale, p.scale * (p.stretchZ ?? 1)),
      ),
    );
}
function intersectsXZ(a, b, margin = 0) {
  return (
    a.min.x < b.max.x + margin &&
    a.max.x > b.min.x - margin &&
    a.min.z < b.max.z + margin &&
    a.max.z > b.min.z - margin
  );
}

test("the real exported shopfront has a threshold-free 1.44m opening", () => {
  const { triangles, gltf } = model("corner-shopfront8m");
  const opening = new Box3(
    new Vector3(-0.719, 0.025, -0.3),
    new Vector3(0.719, 2.05, 0.3),
  );
  for (const triangle of triangles)
    assert.ok(
      !new Box3().setFromPoints(triangle).intersectsBox(opening),
      "A visible triangle obstructs the doorway",
    );
  const glass = gltf.materials.find((m) => m.name === "shopglass");
  assert.equal(glass.alphaMode, "BLEND");
  assert.ok(glass.pbrMetallicRoughness.baseColorFactor[3] < 0.3);
});

test("street entry and the two-metre interior aisle remain clear with real village colliders", () => {
  const built = layout();
  // The door is intentionally narrower than the interior aisle.
  for (let z = 15; z >= 10.3; z -= 0.05)
    for (const dx of [-0.45, 0, 0.45])
      assert.ok(
        !built.blocked(-42 + dx, z),
        `Street/door route blocked at ${-42 + dx},${z}`,
      );
  for (let z = 5.3; z <= 10.25; z += 0.05)
    for (let x = -42.75; x <= -41.25; x += 0.05)
      assert.ok(
        !built.blocked(x, z, 0.25),
        `Two-metre aisle pinched at ${x},${z}`,
      );
  const approach = built.metadata.counterApproach;
  assert.ok(!built.blocked(approach.x, approach.z));
  const counter = built.metadata.interactions.find((i) => i.kind === "shop");
  assert.ok(
    Math.hypot(counter.x - approach.x, counter.z - approach.z) < counter.radius,
  );
});

test("all shop interactions are reachable through the entrance without an exterior detour", () => {
  const built = layout(),
    step = 0.1,
    queue = [[-420, 108]],
    seen = new Set(["-420,108"]);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const [ix, iz] = queue[cursor];
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const xx = ix + dx,
        zz = iz + dz,
        x = xx * step,
        z = zz * step,
        key = `${xx},${zz}`;
      if (
        seen.has(key) ||
        x < -46 ||
        x > -38 ||
        z < 3 ||
        z > 11 ||
        built.blocked(x, z)
      )
        continue;
      seen.add(key);
      queue.push([xx, zz]);
    }
  }
  assert.ok(queue.length > 3000);
  for (const item of built.metadata.interactions.filter(
    (i) => i.id !== "mercy-shop-notice",
  ))
    assert.ok(
      queue.some(
        ([ix, iz]) =>
          Math.hypot(ix * step - item.x, iz * step - item.z) <
          Math.min(item.radius, 1.1),
      ),
      `${item.id} is unreachable inside the shop`,
    );
});

test("exported shop bounds clear existing houses, bin and both village road lanes", () => {
  const built = layout();
  const neighbors = assembled.placementLog.filter(
    (p) =>
      ["terrace-house-v2", "wheelie-bin", "streetlamp"].includes(p.asset) &&
      p.x > -60 &&
      p.x < -25 &&
      p.z > -15 &&
      p.z < 17,
  );
  assert.ok(
    neighbors.some((p) => p.x === -39 && p.z === 0),
    "Must check the existing bin",
  );
  assert.ok(
    neighbors.filter((p) => p.asset === "terrace-house-v2").length >= 2,
  );
  for (const p of built.placements) {
    const box = placedBox(p);
    if (!["path-2m"].includes(p.name))
      assert.ok(box.max.z < 15.75, `${p.name} enters road walking margin`);
    for (const neighbor of neighbors)
      assert.ok(
        !intersectsXZ(box, placedBox(neighbor), 0.15),
        `${p.name} overlaps existing ${neighbor.asset} at ${neighbor.x},${neighbor.z}`,
      );
    for (const x of [box.min.x, (box.min.x + box.max.x) / 2, box.max.x])
      for (const z of [box.min.z, (box.min.z + box.max.z) / 2, box.max.z])
        assert.equal(terrain.height(x, z), 0);
  }
  assert.deepEqual(built.metadata.rooms, [CORNER_SHOP_ROOM]);
  assert.equal(
    assembled.info.interiors.rooms.filter(
      (room) => room.id === CORNER_SHOP_ROOM.id,
    ).length,
    1,
    "Shop room must be registered once for rain masking",
  );
  assert.ok(
    !assembled.placementLog.some(
      (p) =>
        p.asset === "grass-clump" &&
        p.x > -46 &&
        p.x < -38 &&
        p.z > 3 &&
        p.z < 11,
    ),
    "Village grass was scattered inside the shop",
  );
});

test("floors are level, lights are below their shades, and every new asset is static and self-contained", () => {
  assert.ok(Math.abs(model("domestic-tile-floor-4m").box.max.y) < 1e-5);
  const built = layout();
  assert.equal(built.metadata.floorHeight, 0);
  const roofs = built.placements
    .filter((p) => p.name === "roof-4m")
    .map(placedBox);
  assert.equal(roofs.length, 4);
  for (let a = 0; a < roofs.length; a++)
    for (let b = a + 1; b < roofs.length; b++)
      assert.ok(
        !intersectsXZ(roofs[a], roofs[b], -0.001),
        "Coplanar roof skins overlap and flicker",
      );
  for (const light of built.metadata.lights)
    assert.ok(light.y > 2.2 && light.y < 2.42);
  for (const name of [
    "corner-shopfront8m",
    "corner-shop-counter",
    "corner-shop-shelf",
    "corner-shop-pharmacy",
    "corner-shop-sign",
  ]) {
    const { gltf } = model(name);
    assert.ok(
      !gltf.animations?.length,
      "Static shop fixtures must permit instancing",
    );
    assert.ok(
      (gltf.images ?? []).every((image) => image.bufferView !== undefined),
    );
    const triangles = gltf.meshes
      .flatMap((mesh) => mesh.primitives)
      .reduce((count, p) => count + gltf.accessors[p.indices].count / 3, 0);
    assert.ok(
      triangles < 6000,
      `${name} has excessive geometry for a small modular fixture`,
    );
  }
});
