import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Box3, Group, Matrix4, Quaternion, Scene, Vector3 } from "three";
import {
  buildUtilityLines,
  UTILITY_LINE_LAYOUT,
  UTILITY_POLE_FOOTPRINT,
} from "../src/utility-lines.js";
import { assembleWorld } from "../src/world.js";
import { MORROW_QUAY_WATER } from "../src/morrow-quay.js";
import { loadCatalog, overlapsRoad } from "./lib/scene-geometry.js";

const catalog = loadCatalog();
const bedroom = JSON.parse(
  readFileSync(new URL("../game-assets/bedroom-layout.json", import.meta.url)),
);
const assets = Object.fromEntries(
  Object.keys(catalog).map((name) => [
    name,
    { scene: new Group(), animations: [] },
  ]),
);
const world = assembleWorld(new Scene(), assets, catalog, bedroom);

function exportedVertices(name) {
  const bytes = readFileSync(
    new URL(`../game-assets/${catalog[name].model}`, import.meta.url),
  );
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength));
  const binaryStart = 28 + jsonLength;
  const vertices = [];
  function visit(index, parent = new Matrix4()) {
    const node = gltf.nodes[index];
    const matrix = node.matrix
      ? new Matrix4().fromArray(node.matrix)
      : new Matrix4().compose(
          new Vector3().fromArray(node.translation ?? [0, 0, 0]),
          new Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]),
          new Vector3().fromArray(node.scale ?? [1, 1, 1]),
        );
    matrix.premultiply(parent);
    for (const primitive of gltf.meshes?.[node.mesh]?.primitives ?? []) {
      const accessor = gltf.accessors[primitive.attributes.POSITION];
      assert.equal(accessor.componentType, 5126);
      const view = gltf.bufferViews[accessor.bufferView];
      const start =
        binaryStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
      for (let i = 0; i < accessor.count; i++) {
        const offset = start + i * (view.byteStride ?? 12);
        vertices.push(
          new Vector3(
            bytes.readFloatLE(offset),
            bytes.readFloatLE(offset + 4),
            bytes.readFloatLE(offset + 8),
          ).applyMatrix4(matrix),
        );
      }
    }
    for (const child of node.children ?? []) visit(child, matrix);
  }
  for (const node of gltf.scenes[gltf.scene ?? 0].nodes) visit(node);
  return { gltf, vertices };
}

function collect(options) {
  const placements = [];
  const result = buildUtilityLines({
    place: (...args) => placements.push(args),
    collisions: [],
    towns: [],
    height: () => 0,
    ...options,
  });
  return { ...result, placements };
}

function isPoleCollider(collider, pole) {
  const sin = Math.sin(pole.angle), cos = Math.cos(pole.angle);
  const expected = {
    x: pole.x + sin * UTILITY_POLE_FOOTPRINT.z,
    z: pole.z + cos * UTILITY_POLE_FOOTPRINT.z,
    w: (Math.abs(cos) + Math.abs(sin)) * UTILITY_POLE_FOOTPRINT.w,
    d: (Math.abs(cos) + Math.abs(sin)) * UTILITY_POLE_FOOTPRINT.d,
  };
  return Object.entries(expected).every(([key, value]) => Math.abs(collider[key] - value) < 1e-8);
}

test("the exported timber pole and three catenary wires share measured attachment datums", () => {
  const pole = exportedVertices("utility-pole"),
    line = exportedVertices("overhead-line-24m");
  assert.deepEqual(catalog["utility-pole"].colliders, [UTILITY_POLE_FOOTPRINT]);
  assert.equal(catalog["overhead-line-24m"].colliders.length, 0);
  const poleBounds = new Box3().setFromPoints(pole.vertices);
  assert.ok(Math.abs(poleBounds.max.y - 6.5) < 1e-5);
  for (const p of pole.vertices.filter((p) => p.y < 1.45)) {
    assert.ok(
      Math.abs(p.x - UTILITY_POLE_FOOTPRINT.x) <=
        UTILITY_POLE_FOOTPRINT.w / 2 + 1e-5,
    );
    assert.ok(
      Math.abs(p.z - UTILITY_POLE_FOOTPRINT.z) <=
        UTILITY_POLE_FOOTPRINT.d / 2 + 1e-5,
    );
  }
  const average = (points) =>
    points
      .reduce((sum, p) => sum.add(p), new Vector3())
      .divideScalar(points.length);
  for (const x of UTILITY_LINE_LAYOUT.wireOffsets) {
    const wire = line.vertices.filter((v) => Math.abs(v.x - x) < 0.007);
    assert.ok(wire.length > 200, `Conductor ${x} is missing`);
    assert.ok(
      wire.every((p) => Math.abs(p.x - x) <= 0.00601),
      "Conductor diameter exceeds 12 mm",
    );
    for (const end of [-12, 12]) {
      const points = wire.filter((p) => Math.abs(p.z - end) < 0.001);
      assert.ok(points.length >= 6);
      const center = average(points);
      assert.ok(
        center.distanceTo(new Vector3(x, 6.1, end)) < 1e-4,
        "A wire endpoint has moved off its insulator datum",
      );
      const support = pole.vertices.filter(
        (p) =>
          Math.abs(p.x - x) < 0.05 &&
          Math.abs(p.z) < 0.05 &&
          p.y > 6.06 &&
          p.y < 6.105,
      );
      assert.ok(support.length > 0, "No porcelain saddle supports this wire");
    }
    const middle = average(wire.filter((p) => Math.abs(p.z) < 0.001));
    assert.ok(
      Math.abs(middle.y - 5.75) < 1e-4,
      "The authored span no longer sags 35 cm",
    );
  }
  assert.equal(
    line.vertices.filter(
      (p) =>
        !UTILITY_LINE_LAYOUT.wireOffsets.some((x) => Math.abs(p.x - x) < 0.007),
    ).length,
    0,
  );
  for (const [name, gltf, limit] of [
    ["pole", pole.gltf, 4],
    ["span", line.gltf, 1],
  ]) {
    assert.ok(
      gltf.meshes.reduce((sum, m) => sum + m.primitives.length, 0) <= limit,
      `${name} export has excess draw calls`,
    );
    assert.ok(
      gltf.images.length >= 3 &&
        gltf.images.every((image) => image.bufferView !== undefined),
      `${name} images are not embedded`,
    );
    assert.ok(
      gltf.materials.some(
        (m) =>
          m.normalTexture &&
          m.pbrMetallicRoughness?.baseColorTexture &&
          m.pbrMetallicRoughness?.metallicRoughnessTexture,
      ),
      `${name} lacks packed PBR maps`,
    );
  }
});

test("sparse utility placement stays beside actual county roads and outside populated areas", () => {
  const { info } = world;
  const poleShape = new Box3().setFromPoints(
    exportedVertices("utility-pole").vertices,
  );
  const built = info.utilityLines;
  assert.ok(built, "Audit must check the utility runs integrated into the actual world");
  assert.ok(
    built.spans.length >= 8,
    "County should retain some useful roadside silhouettes",
  );
  assert.ok(built.spans.length <= 3 * (info.route.length - 1));
  const bySegment = new Map();
  for (const pole of built.poles) {
    assert.equal(info.collisions.filter((c) => isPoleCollider(c, pole)).length, 1, "The placed pole must have exactly its authored ground collider");
    assert.ok(Math.hypot(pole.x, pole.z) > 80);
    for (const town of info.towns)
      assert.ok(Math.hypot(pole.x - town.x, pole.z - town.z) > 60);
    const a = info.route[pole.segment - 1],
      b = info.route[pole.segment];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    assert.ok(pole.distance >= 20 && pole.distance <= length - 20);
    const perpendicular =
      ((pole.x - a[0]) * (b[1] - a[1]) - (pole.z - a[1]) * (b[0] - a[0])) /
      length;
    assert.ok(Math.abs(Math.abs(perpendicular) - 8.8) < 1e-8);
    const matrix = new Matrix4().compose(
      new Vector3(pole.x, pole.ground, pole.z),
      new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), pole.angle),
      new Vector3(1, 1, 1),
    );
    const bounds = poleShape.clone().applyMatrix4(matrix);
    for (let i = 1; i < info.route.length; i++)
      assert.equal(
        overlapsRoad(bounds, info.route[i - 1], info.route[i]),
        false,
        "A pole or cross-arm overhangs a carriageway",
      );
  }
  for (const span of built.spans) {
    assert.ok(
      built.poles.includes(span.start) && built.poles.includes(span.end),
    );
    assert.ok(
      Math.abs(
        Math.hypot(span.end.x - span.start.x, span.end.z - span.start.z) - 24,
      ) < 1e-8,
    );
    assert.equal(span.start.side, span.end.side);
    if (!bySegment.has(span.segment)) bySegment.set(span.segment, new Set());
    bySegment.get(span.segment).add(span.side);
    for (let step = 0; step <= 24; step++) {
      const t = step / 24,
        x = span.start.x + (span.end.x - span.start.x) * t,
        z = span.start.z + (span.end.z - span.start.z) * t;
      assert.ok(
        Math.abs(info.terrain.height(x, z) - span.ground) <= 0.001,
        "A wire would leave its pole attachments on uneven terrain",
      );
      assert.ok(
        !MORROW_QUAY_WATER.some(
          (r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ,
        ),
      );
      assert.ok(
        !info.collisions.some(
          (c) => !isPoleCollider(c, span.start) && !isPoleCollider(c, span.end) &&
            Math.abs(x - c.x) <= c.w / 2 + 1.19 &&
            Math.abs(z - c.z) <= c.d / 2 + 1.19,
        ),
        "Wire strip crosses existing scenery",
      );
    }
  }
  assert.ok(
    [...bySegment.values()].every((sides) => sides.size === 1),
    "Utility runs swap verges on a straight",
  );
});

test("blocked candidates and uneven ground break spans without stretching or jumping gaps", () => {
  const route = [
    [-450, -400],
    [-450, 400],
  ];
  const collisions = [-8.8, 8.8].map((offset) => ({
    x: -450 + offset,
    z: -355,
    w: 1,
    d: 1,
  }));
  const obstructed = collect({ route, collisions });
  assert.ok(obstructed.spans.length > 0);
  assert.ok(obstructed.poles.every((p) => p.distance !== 45));
  assert.ok(
    obstructed.spans.every((s) => s.end.distance - s.start.distance === 24),
  );
  const mound = collect({
    route,
    height: (x, z) => (z > -378 && z < -360 ? 0.05 : 0),
  });
  assert.ok(mound.spans.length > 0);
  assert.ok(
    mound.spans.every((s) => s.start.distance !== 21),
    "Mid-span terrain bump failed to reject a floating attachment",
  );
  assert.equal(collect({ route, height: () => NaN }).spans.length, 0);
  assert.equal(
    collect({
      route: [
        [360, -118],
        [360, -22],
      ],
    }).poles.length,
    0,
    "Utility structures enter harbour water",
  );
  assert.equal(
    collect({
      route: [
        [-50, 0],
        [50, 0],
      ],
    }).poles.length,
    0,
    "Utility structures enter the opening home exclusion",
  );
  assert.equal(
    collect({
      route: [
        [-450, -45],
        [-450, 45],
      ],
      towns: [{ x: -450, z: 0 }],
    }).poles.length,
    0,
    "Utility structures enter a town junction",
  );
});
