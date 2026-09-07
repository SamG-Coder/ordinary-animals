import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Box3, Group, Matrix4, Quaternion, Scene, Vector3 } from "three";
import {
  DISTRICT_HOUSES,
  placeDistrictHousing,
} from "../src/district-housing.js";
import { assembleWorld } from "../src/world.js";
import { createTerrain } from "../src/terrain.js";
import { HOME_CLINIC_ROAD } from "../src/home-clinic.js";

const catalog = JSON.parse(
  readFileSync(new URL("../game-assets/asset-catalog.json", import.meta.url)),
);
// Run the actual placement code with empty model containers: town coordinates and
// road endpoints therefore come from the world, without a second route definition.
const assets = Object.fromEntries(
  Object.keys(catalog).map((name) => [
    name,
    { scene: new Group(), animations: [] },
  ]),
);
const assembled = assembleWorld(new Scene(), assets, catalog, []);
const { towns } = assembled.info;
const actualHousing = assembled.placementLog.filter(
  (p) => p.asset === "terrace-house-v2",
);
const route = assembled.info.route;
const roadSegments = [
  ...route
    .slice(0, -1)
    .map((a, i) => ({ name: `ring road ${i}`, a, b: route[i + 1] })),
  { name: "village north-south road", a: [HOME_CLINIC_ROAD.x, HOME_CLINIC_ROAD.startZ], b: [HOME_CLINIC_ROAD.x, HOME_CLINIC_ROAD.endZ] },
  { name: "village east-west road", a: [-90, 20], b: [90, 20] },
];

function exportedFootprint(entry) {
  const binary = readFileSync(
    new URL(`../game-assets/${entry.model}`, import.meta.url),
  );
  const gltf = JSON.parse(binary.subarray(20, 20 + binary.readUInt32LE(12)));
  const bounds = new Box3();
  function visit(index, parent = new Matrix4()) {
    const node = gltf.nodes[index];
    const transform = node.matrix
      ? new Matrix4().fromArray(node.matrix)
      : new Matrix4().compose(
          new Vector3().fromArray(node.translation ?? [0, 0, 0]),
          new Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]),
          new Vector3().fromArray(node.scale ?? [1, 1, 1]),
        );
    transform.premultiply(parent);
    if (node.mesh !== undefined)
      for (const primitive of gltf.meshes[node.mesh].primitives) {
        const positions = gltf.accessors[primitive.attributes.POSITION];
        assert.ok(
          positions.min && positions.max,
          "Blender export must include position bounds",
        );
        bounds.union(
          new Box3(
            new Vector3().fromArray(positions.min),
            new Vector3().fromArray(positions.max),
          ).applyMatrix4(transform),
        );
      }
    for (const child of node.children ?? []) visit(child, transform);
  }
  for (const root of gltf.scenes[gltf.scene ?? 0].nodes) visit(root);
  assert.ok(!bounds.isEmpty());
  return {
    minX: bounds.min.x,
    maxX: bounds.max.x,
    minZ: bounds.min.z,
    maxZ: bounds.max.z,
  };
}
const footprint = exportedFootprint(catalog["terrace-house-v2"]);
// Mesh eaves and doorstep extend beyond the collider. Protect both rather than
// clearing only the centre of a house or allowing a roof to overhang the lanes.
const localBounds = [
  footprint,
  ...catalog["terrace-house-v2"].colliders.map((c) => ({
    minX: c.x - c.w / 2,
    maxX: c.x + c.w / 2,
    minZ: c.z - c.d / 2,
    maxZ: c.z + c.d / 2,
  })),
];
const boxAt = (box, x, z) => ({
  minX: box.minX + x,
  maxX: box.maxX + x,
  minZ: box.minZ + z,
  maxZ: box.maxZ + z,
});
function placedPoint(p, x, z) {
  const cos = Math.cos(p.ry),
    sin = Math.sin(p.ry);
  return [
    p.x + (x * cos + z * sin * p.stretchZ) * p.scale,
    p.z + (-x * sin + z * cos * p.stretchZ) * p.scale,
  ];
}
function placedBounds(box, placement) {
  const corners = [box.minX, box.maxX].flatMap((x) =>
    [box.minZ, box.maxZ].map((z) => placedPoint(placement, x, z)),
  );
  return {
    minX: Math.min(...corners.map((p) => p[0])),
    maxX: Math.max(...corners.map((p) => p[0])),
    minZ: Math.min(...corners.map((p) => p[1])),
    maxZ: Math.max(...corners.map((p) => p[1])),
  };
}
function pointSegmentDistance([x, z], [ax, az], [bx, bz]) {
  const dx = bx - ax,
    dz = bz - az;
  const t = Math.max(
    0,
    Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)),
  );
  return Math.hypot(x - ax - t * dx, z - az - t * dz);
}
function segmentBoxDistance(a, b, box) {
  // Slab intersection followed by endpoint/edge distances is analytic over the
  // whole segment, including oblique roads. No gaps between sampled lane points.
  let lo = 0,
    hi = 1,
    intersects = true;
  for (const [axis, lower, upper] of [
    [0, box.minX, box.maxX],
    [1, box.minZ, box.maxZ],
  ]) {
    const d = b[axis] - a[axis];
    if (Math.abs(d) < 1e-12) {
      if (a[axis] < lower || a[axis] > upper) intersects = false;
    } else {
      const t0 = (lower - a[axis]) / d,
        t1 = (upper - a[axis]) / d;
      lo = Math.max(lo, Math.min(t0, t1));
      hi = Math.min(hi, Math.max(t0, t1));
      if (lo > hi) intersects = false;
    }
  }
  if (intersects) return 0;
  const pointBoxDistance = ([x, z]) =>
    Math.hypot(
      Math.max(box.minX - x, 0, x - box.maxX),
      Math.max(box.minZ - z, 0, z - box.maxZ),
    );
  return Math.min(
    pointBoxDistance(a),
    pointBoxDistance(b),
    ...[box.minX, box.maxX].flatMap((x) =>
      [box.minZ, box.maxZ].map((z) => pointSegmentDistance([x, z], a, b)),
    ),
  );
}
function separated(a, b, margin = 0.25) {
  return (
    a.minX > b.maxX + margin ||
    b.minX > a.maxX + margin ||
    a.minZ > b.maxZ + margin ||
    b.minZ > a.maxZ + margin
  );
}

test("generic housing preserves six homes per district and leaves bespoke districts unchanged", () => {
  assert.equal(DISTRICT_HOUSES.length, towns.length);
  assert.deepEqual(DISTRICT_HOUSES[0], [
    [-144, 110],
    [-130, 110],
    [-116, 110],
    [-144, 126],
    [-130, 126],
    [-116, 126],
  ]);
  assert.deepEqual(DISTRICT_HOUSES[1], []);
  for (let i = 0; i < towns.length; i++) {
    const placed = [];
    placeDistrictHousing(i, (...args) => placed.push(args));
    assert.equal(placed.length, i === 1 ? 0 : 6);
    assert.equal(
      new Set(placed.map((p) => p.slice(1).join(","))).size,
      placed.length,
    );
    for (const [name, x, z] of placed) {
      assert.equal(name, "terrace-house-v2");
      assert.ok(Number.isFinite(x) && Number.isFinite(z));
      assert.equal(
        actualHousing.filter((p) => p.x === x && p.z === z).length,
        1,
        `reviewed district house ${x},${z} must be placed exactly once by the world`,
      );
    }
  }
});

test("all assembled terrace houses clear both lanes of ring and village roads", () => {
  assert.ok(
    actualHousing.length > DISTRICT_HOUSES.flat().length,
    "the assembled-world audit must also include home-village houses",
  );
  const blockers = [];
  for (const p of actualHousing)
    for (const [boundIndex, local] of localBounds.entries())
      for (const road of roadSegments) {
        const clearance = segmentBoxDistance(
          road.a,
          road.b,
          placedBounds(local, p),
        );
        if (clearance <= 4.25)
          blockers.push(
            `house ${p.x},${p.z}, ${boundIndex === 0 ? "exported footprint" : "collider"}, ${road.name}: ${clearance.toFixed(3)}m clearance; need 4.25m`,
          );
      }
  assert.deepEqual(blockers, []);
  // A regression sentinel for the observed obstruction; this must fail clearance.
  assert.ok(
    segmentBoxDistance(
      [-250, -20],
      [-210, -200],
      boxAt(footprint, -220, -164),
    ) < 4.25,
  );
});

test("district houses leave leader buildings, courtyards and direct approaches open", () => {
  for (const [i, houses] of DISTRICT_HOUSES.entries()) {
    const t = towns[i];
    const landmarks=["county-school","lettings-office","groundskeeper-lodge","pump-station","ranger-lodge","harbour-office","st-marrow-school-block","league-inspection-office"];
    const building=assembled.placementLog.find(p=>p.asset===landmarks[i]);
    assert.ok(building, "Each leader has a placed landmark");
    const protectedAreas = [
      { minX: t.gymX - 8, maxX: t.gymX + 8, minZ: t.gymZ - 4, maxZ: t.z + 8 },
      placedBounds(exportedFootprint(catalog[building.asset]),building),
    ];
    const approach = [
      [t.x, t.z],
      [t.gymX, t.z],
      [t.gymX, t.gymZ + 2.4],
    ];
    for (const [j, [x, z]] of houses.entries()) {
      const box = boxAt(footprint, x, z);
      for (const protectedArea of protectedAreas)
        assert.ok(
          separated(box, protectedArea),
          `district ${i} house ${x},${z} intrudes into leader grounds`,
        );
      for (let k = 0; k < approach.length - 1; k++)
        assert.ok(
          segmentBoxDistance(approach[k], approach[k + 1], box) > 0.5,
          `district ${i} house ${x},${z} blocks leader approach`,
        );
      for (const [otherX, otherZ] of houses.slice(j + 1))
        assert.ok(
          separated(box, boxAt(footprint, otherX, otherZ), 1),
          `houses overlap in district ${i}`,
        );
    }
  }
});

test("all assembled terrace houses remain on flat ground across rotated footprints", () => {
  const terrain = createTerrain(catalog);
  for (const placement of actualHousing) {
    const box = footprint;
    // A dense grid includes corners, complete edges, centre and the interior.
    for (let ix = 0; ix <= 10; ix++)
      for (let iz = 0; iz <= 10; iz++) {
        const [px, pz] = placedPoint(
          placement,
          box.minX + ((box.maxX - box.minX) * ix) / 10,
          box.minZ + ((box.maxZ - box.minZ) * iz) / 10,
        );
        assert.ok(
          terrain.height(px, pz) < 0.02,
          `house ${placement.x},${placement.z} intersects raised ground at ${px},${pz}`,
        );
      }
  }
});
