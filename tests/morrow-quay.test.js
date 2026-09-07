import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Matrix4, Quaternion, Vector3, Box3 } from "three";
import {
  buildMorrowQuay,
  isMorrowQuayWater,
  MORROW_QUAY_APPROACH,
  MORROW_QUAY_WATER,
  MORROW_QUAY_DOCKS,
} from "../src/morrow-quay.js";
import { DISTRICT_HOUSES } from "../src/district-housing.js";
import { createTerrain } from "../src/terrain.js";

const root = new URL("../", import.meta.url);
const catalog = JSON.parse(
  readFileSync(new URL("game-assets/asset-catalog.json", root)),
);
const terrain = createTerrain(catalog);
const gltfCache = new Map();

function gltfFor(name) {
  if (gltfCache.has(name)) return gltfCache.get(name);
  const data = readFileSync(
    new URL("game-assets/" + catalog[name].model, root),
  );
  assert.equal(data.readUInt32LE(0), 0x46546c67);
  const jsonSize = data.readUInt32LE(12);
  const gltf = JSON.parse(data.toString("utf8", 20, 20 + jsonSize));
  gltfCache.set(name, gltf);
  return gltf;
}
function bounds(name) {
  const gltf = gltfFor(name),
    box = new Box3();
  function visit(index, parent) {
    const node = gltf.nodes[index];
    const local = node.matrix
      ? new Matrix4().fromArray(node.matrix)
      : new Matrix4().compose(
          new Vector3(...(node.translation ?? [0, 0, 0])),
          new Quaternion(...(node.rotation ?? [0, 0, 0, 1])),
          new Vector3(...(node.scale ?? [1, 1, 1])),
        );
    const matrix = parent.clone().multiply(local);
    if (node.mesh !== undefined)
      for (const primitive of gltf.meshes[node.mesh].primitives) {
        const a = gltf.accessors[primitive.attributes.POSITION];
        box.union(
          new Box3(new Vector3(...a.min), new Vector3(...a.max)).applyMatrix4(
            matrix,
          ),
        );
      }
    for (const child of node.children ?? []) visit(child, matrix);
  }
  for (const node of gltf.scenes[gltf.scene ?? 0].nodes)
    visit(node, new Matrix4());
  return box;
}
function floatAccessor(name, index) {
  const gltf = gltfFor(name),
    accessor = gltf.accessors[index];
  assert.equal(accessor.componentType, 5126);
  const components = accessor.type === "VEC3" ? 3 : 1;
  const bytes = readFileSync(
    new URL("game-assets/" + catalog[name].model, root),
  );
  const binaryStart = 28 + bytes.readUInt32LE(12);
  const result = Array.from({ length: accessor.count }, () =>
    Array(components).fill(0),
  );
  if (accessor.bufferView !== undefined) {
    const view = gltf.bufferViews[accessor.bufferView];
    const start = binaryStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    for (let i = 0; i < accessor.count; i++)
      for (let j = 0; j < components; j++)
        result[i][j] = bytes.readFloatLE(
          start + i * (view.byteStride ?? components * 4) + j * 4,
        );
  }
  if (accessor.sparse) {
    const { count, indices, values } = accessor.sparse;
    const indexView = gltf.bufferViews[indices.bufferView];
    const valueView = gltf.bufferViews[values.bufferView];
    const indexStart = binaryStart + (indexView.byteOffset ?? 0) + (indices.byteOffset ?? 0);
    const valueStart = binaryStart + (valueView.byteOffset ?? 0) + (values.byteOffset ?? 0);
    const indexBytes = { 5121: 1, 5123: 2, 5125: 4 }[indices.componentType];
    assert.ok(indexBytes, "Unsupported sparse index component type");
    for (let i = 0; i < count; i++) {
      const target = bytes.readUIntLE(indexStart + i * indexBytes, indexBytes);
      assert.ok(target < accessor.count);
      for (let j = 0; j < components; j++)
        result[target][j] = bytes.readFloatLE(valueStart + (i * components + j) * 4);
    }
  }
  return result;
}
function layout() {
  const obstacles = [],
    placements = [];
  function place(name, x, z, y = 0, angle = 0, scale = 1) {
    assert.ok(catalog[name], `Missing Blender asset ${name}`);
    placements.push({ name, x, z, y, angle, scale });
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
  }
  const metadata = buildMorrowQuay({
    place,
    lamp: (x, z) => place("streetlamp", x, z),
  });
  const house = catalog["terrace-house-v2"]
    ? "terrace-house-v2"
    : "terrace-house";
  for (const [x, z] of DISTRICT_HOUSES[5]) place(house, x, z);
  const blocked = (x, z, r = 0.22) =>
    isMorrowQuayWater(x, z, r) ||
    obstacles.find(
      (c) => Math.abs(x - c.x) < c.w / 2 + r && Math.abs(z - c.z) < c.d / 2 + r,
    );
  return { obstacles, placements, metadata, blocked };
}

function segmentBoxDistance(a, b, box) {
  const minX = box.x - box.w / 2,
    maxX = box.x + box.w / 2,
    minZ = box.z - box.d / 2,
    maxZ = box.z + box.d / 2;
  let low = 0,
    high = 1;
  for (const [origin, delta, min, max] of [
    [a[0], b[0] - a[0], minX, maxX],
    [a[1], b[1] - a[1], minZ, maxZ],
  ]) {
    if (Math.abs(delta) < 1e-12) {
      if (origin < min || origin > max) {
        low = 2;
        break;
      }
    } else {
      const first = (min - origin) / delta,
        last = (max - origin) / delta;
      low = Math.max(low, Math.min(first, last));
      high = Math.min(high, Math.max(first, last));
    }
  }
  if (low <= high && high >= 0 && low <= 1) return 0;
  const pointDistance = (p) =>
    Math.hypot(
      Math.max(minX - p[0], 0, p[0] - maxX),
      Math.max(minZ - p[1], 0, p[1] - maxZ),
    );
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = dx * dx + dz * dz;
  const cornerDistance = (x, z) => {
    const t = Math.max(
      0,
      Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / length),
    );
    return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
  };
  return Math.min(
    pointDistance(a),
    pointDistance(b),
    ...[
      [minX, minZ],
      [minX, maxZ],
      [maxX, minZ],
      [maxX, maxZ],
    ].map((p) => cornerDistance(...p)),
  );
}

test("Morrow Quay leader keeps a six-metre forecourt and the original direct dock route", () => {
  const built = layout();
  for (let x = 289; x <= 295; x += 0.25)
    for (let z = -72; z <= -66; z += 0.25)
      assert.ok(
        !built.blocked(x, z),
        `Leader forecourt obstructed at ${x},${z}`,
      );
  for (let index = 1; index < MORROW_QUAY_APPROACH.length; index++) {
    const a = MORROW_QUAY_APPROACH[index - 1],
      b = MORROW_QUAY_APPROACH[index],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let d = 0; d <= length; d += 0.1)
      for (const offset of [-0.5, 0, 0.5]) {
        const x =
          a[0] +
          ((b[0] - a[0]) * d) / length -
          ((b[1] - a[1]) * offset) / length;
        const z =
          a[1] +
          ((b[1] - a[1]) * d) / length +
          ((b[0] - a[0]) * offset) / length;
        assert.ok(!built.blocked(x, z), `Direct route obstructed at ${x},${z}`);
      }
  }
});

test("exported harbour footprints protect both full road lanes and the existing houses", () => {
  const { placements } = layout();
  for (const p of placements) {
    if (
      ["path-2m", "court-paving-4m", "puddle", "storm-drain"].includes(p.name)
    )
      continue;
    const b = bounds(p.name)
      .clone()
      .applyMatrix4(
        new Matrix4().compose(
          new Vector3(p.x, p.y, p.z),
          new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), p.angle),
          new Vector3(p.scale, p.scale, p.scale),
        ),
      );
    const rect = {
      x: (b.min.x + b.max.x) / 2,
      z: (b.min.z + b.max.z) / 2,
      w: b.max.x - b.min.x,
      d: b.max.z - b.min.z,
    };
    for (const [a, c] of [
      [
        [155, -245],
        [275, -60],
      ],
      [
        [275, -60],
        [220, 160],
      ],
    ])
      assert.ok(
        segmentBoxDistance(a, c, rect) > 4.25,
        `${p.name} at ${p.x},${p.z} enters the road/walking margin`,
      );
  }
  for (const [x, z] of DISTRICT_HOUSES[5])
    assert.ok(
      !isMorrowQuayWater(x, z, 5),
      "Harbour water overlaps existing housing",
    );
});

test("harbour water is blocked while the deck remains traversable with body clearance", () => {
  const { metadata, placements } = layout();
  assert.deepEqual(metadata.waterAreas, MORROW_QUAY_WATER);
  assert.deepEqual(metadata.allowedDock, MORROW_QUAY_DOCKS);
  assert.equal(
    placements.filter((p) => p.name === "harbour-water-tile20m").length,
    20,
  );
  assert.ok(isMorrowQuayWater(370, -69));
  assert.ok(isMorrowQuayWater(350, -71));
  assert.ok(isMorrowQuayWater(361.95, -69));
  assert.equal(isMorrowQuayWater(350, -69), false);
  assert.equal(isMorrowQuayWater(332, -69), false);
  assert.ok(metadata.waterHeight + metadata.waterAmplitude < metadata.deckTop);
  assert.equal(catalog["timber-pier4m"].walkableTop, 0.025);
  assert.ok(Math.abs(bounds("stone-quay4m").max.y - 0.03) < 1e-6);
});

test("all harbour modules sit on level terrain and the water contains a real Blender animation", () => {
  const { placements } = layout();
  for (const p of placements) {
    const footprint = bounds(p.name), cos = Math.cos(p.angle), sin = Math.sin(p.angle);
    for (const dx of [footprint.min.x, (footprint.min.x + footprint.max.x) / 2, footprint.max.x])
      for (const dz of [footprint.min.z, (footprint.min.z + footprint.max.z) / 2, footprint.max.z])
        assert.equal(
          terrain.height(p.x + (dx * cos + dz * sin) * p.scale, p.z + (-dx * sin + dz * cos) * p.scale),
          0,
          `${p.name} exported footprint placed over raised terrain`,
        );
  }
  const water = gltfFor("harbour-water-tile20m");
  assert.ok(water.animations?.length);
  assert.ok(
    water.meshes.some((mesh) => mesh.primitives.some((p) => p.targets?.length)),
    "No exported morph animation",
  );
  assert.ok(
    water.materials.every(
      (material) => !material.alphaMode || material.alphaMode === "OPAQUE",
    ),
  );
  const box = bounds("harbour-water-tile20m");
  assert.ok(box.min.y > 0.01 && box.max.y < 0.02);
  for (const name of [
    "harbour-office",
    "stone-quay4m",
    "timber-pier4m",
    "mooring-bollard",
    "harbour-water-tile20m",
    "moored-dinghy",
  ]) {
    const gltf = gltfFor(name);
    assert.ok(
      (gltf.images ?? []).every((image) => image.bufferView !== undefined),
      `${name} has external texture dependencies`,
    );
  }
});

test("exported water animation keeps every tile edge sealed and remains below the pier", () => {
  const name = "harbour-water-tile20m",
    gltf = gltfFor(name);
  const primitive = gltf.meshes[0].primitives[0];
  const base = floatAccessor(name, primitive.attributes.POSITION);
  const delta = floatAccessor(name, primitive.targets[0].POSITION);
  let edges = 0,
    moving = 0;
  base.forEach(([x, y, z], i) => {
    if (Math.abs(x) === 10 || Math.abs(z) === 10) {
      edges++;
      assert.ok(Math.abs(y - 0.015) < 1e-7);
      assert.ok(
        delta[i].every((component) => Math.abs(component) < 1e-7),
        "An independently culled tile would open a seam",
      );
    } else if (Math.abs(delta[i][1]) > 0.001) moving++;
    for (const weight of [0, 0.25, 0.5, 0.75, 1])
      assert.ok(
        y + delta[i][1] * weight > 0.01 && y + delta[i][1] * weight < 0.02,
        "Wave crosses ground or deck",
      );
  });
  assert.equal(edges, 96);
  assert.ok(moving > 50, "Animation contains no meaningful movement");
  for (const sampler of gltf.animations[0].samplers) {
    const values = floatAccessor(name, sampler.output).flat();
    assert.ok(values.every((value) => value >= 0 && value <= 1));
    assert.ok(
      Math.abs(values[0] - values.at(-1)) < 1e-7,
      "Water cycle does not loop smoothly",
    );
  }
});
