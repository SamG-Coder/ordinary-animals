import test from "node:test";
import assert from "node:assert/strict";
import { Box3, Group, Matrix4, Quaternion, Scene, Vector3 } from "three";
import { assembleWorld } from "../src/world.js";
import { buildResidentialStreets } from "../src/residential-streets.js";
import { DISTRICT_HOUSES } from "../src/district-housing.js";
import { WILD_SITES } from "../src/field-notes.js";
import {
  loadCatalog,
  exportedBounds,
  overlapsRoad,
} from "./lib/scene-geometry.js";

const catalog = loadCatalog();
const assets = Object.fromEntries(
  Object.keys(catalog).map((name) => [
    name,
    { scene: new Group(), animations: [] },
  ]),
);
const world = assembleWorld(new Scene(), assets, catalog, []);
const { towns, route, terrain } = world.info;
const collisions = world.info.collisions
  .filter((c) => !c.residentialStreet)
  .map((c) => ({ ...c }));
const initialCollisions = [...collisions];
const placements = [];
function place(
  name,
  x,
  z,
  y = 0,
  angle = 0,
  scale = 1,
  batch = true,
  stretchZ = 1,
) {
  assert.ok(catalog[name], `Missing Blender asset ${name}`);
  const matrix = new Matrix4().compose(
    new Vector3(x, y, z),
    new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), angle),
    new Vector3(scale, scale, scale * stretchZ),
  );
  placements.push({ name, x, z, y, angle, scale, stretchZ, matrix });
  const cos = Math.cos(angle),
    sin = Math.sin(angle);
  for (const c of catalog[name].colliders ?? [])
    collisions.push({
      x: x + (c.x * cos + c.z * stretchZ * sin) * scale,
      z: z + (-c.x * sin + c.z * stretchZ * cos) * scale,
      w: (Math.abs(c.w * cos) + Math.abs(c.d * stretchZ * sin)) * scale,
      d: (Math.abs(c.w * sin) + Math.abs(c.d * stretchZ * cos)) * scale,
    });
}
const built = buildResidentialStreets({
  place,
  lamp: (x, z, angle) => place("streetlamp", x, z, 0, angle),
  towns,
  route,
  collisions,
});
const bounds = new Map();
const localBounds = (name) => {
  if (!bounds.has(name)) bounds.set(name, exportedBounds(catalog, name));
  return bounds.get(name);
};
const box = (r) =>
  new Box3(new Vector3(r.minX, -0.1, r.minZ), new Vector3(r.maxX, 8, r.maxZ));
const intersects = (a, b, tolerance = 1e-6) =>
  a.minX < b.maxX - tolerance &&
  a.maxX > b.minX + tolerance &&
  a.minZ < b.maxZ - tolerance &&
  a.maxZ > b.minZ + tolerance;
const obstacle = (c) => ({
  minX: c.x - c.w / 2,
  maxX: c.x + c.w / 2,
  minZ: c.z - c.d / 2,
  maxZ: c.z + c.d / 2,
});
const contains = (r, [x, z]) =>
  x >= r.minX - 1e-6 &&
  x <= r.maxX + 1e-6 &&
  z >= r.minZ - 1e-6 &&
  z <= r.maxZ + 1e-6;

test("every fixed district door joins a named pedestrian neighbourhood, with Ash End untouched", () => {
  assert.deepEqual(
    built.streets.map((s) => s.district),
    [0, 2, 3, 4, 5, 6, 7],
  );
  assert.equal(built.plots.length, 42);
  assert.ok(
    placements.every((p) =>
      [
        "path-2m",
        "fence-3m",
        "wheelie-bin",
        "grass-clump",
        "streetlamp",
      ].includes(p.name),
    ),
  );
  for (const street of built.streets) {
    assert.equal(street.houses, 6);
    assert.equal(street.width, 4);
    for (const plot of built.plots.filter(
      (p) => p.district === street.district,
    )) {
      assert.ok(
        DISTRICT_HOUSES[street.district].some(
          (h) => h[0] === plot.house[0] && h[1] === plot.house[1],
        ),
      );
      assert.equal(
        plot.doorstep[0],
        plot.house[0] - 2.61,
        "Paths must meet the offset Blender door",
      );
      assert.ok(
        built.surfaces.some(
          (r) => r.district === street.district && contains(r, plot.doorstep),
        ),
      );
    }
  }
  assert.ok(built.props.filter((p) => p.asset === "wheelie-bin").length >= 35);
  assert.equal(built.props.filter((p) => p.asset === "streetlamp").length, 14);
});

test("path geometry is partitioned without coplanar overlaps and uses the exported two-metre length", () => {
  for (let i = 0; i < built.surfaces.length; i++)
    for (const b of built.surfaces.slice(i + 1))
      assert.equal(
        intersects(built.surfaces[i], b),
        false,
        `Overlapping pavement rectangles ${i}`,
      );
  let area = 0;
  for (const p of placements.filter((p) => p.name === "path-2m")) {
    const b = localBounds(p.name).clone().applyMatrix4(p.matrix);
    area += (b.max.x - b.min.x) * (b.max.z - b.min.z);
    assert.ok(p.scale > 0 && p.stretchZ > 0);
    assert.ok(
      2 * p.scale * p.stretchZ <= 2.00001,
      "Avoid stretched twelve-metre paving joints",
    );
    assert.ok(
      b.max.y < 0.045,
      "New pedestrian surfaces stay close to walking grade",
    );
  }
  const intended = built.surfaces.reduce(
    (sum, r) => sum + (r.maxX - r.minX) * (r.maxZ - r.minZ),
    0,
  );
  assert.ok(
    Math.abs(area - intended) < 0.01,
    `Exported tile area ${area} differs from continuous pavement area ${intended}`,
  );
});

test("complete lane surfaces and ground-level furniture clear the eight-metre roads and twelve-metre junctions", () => {
  const failures = [];
  for (const [i, r] of [
    ...built.surfaces,
    ...built.props.map((p) => p.bounds),
  ].entries()) {
    const b = box(r);
    b.expandByScalar(-0.00001);
    for (let j = 1; j < route.length; j++)
      if (overlapsRoad(b, route[j - 1], route[j], 8))
        failures.push(`surface/prop ${i} overlaps ring segment ${j - 1}`);
    for (const [x, z] of route.slice(0, -1))
      if (intersects(r, { minX: x - 6, maxX: x + 6, minZ: z - 6, maxZ: z + 6 }))
        failures.push(`surface/prop ${i} overlaps junction ${x},${z}`);
  }
  assert.deepEqual(failures, []);
});

test("every door-to-junction path stays clear of buildings, obstacles, leader spaces and wild sites", () => {
  const problems = [];
  for (const [i, r] of built.surfaces.entries()) {
    for (const c of initialCollisions)
      if (intersects(r, obstacle(c)))
        problems.push(
          `district ${r.district} surface ${i} intersects collider ${c.x},${c.z},${c.w},${c.d}`,
        );
    for (const t of towns)
      if (
        intersects(r, {
          minX: t.gymX - 3,
          maxX: t.gymX + 3,
          minZ: t.gymZ - 3,
          maxZ: t.gymZ + 3,
        })
      )
        problems.push(`surface ${i} enters leader apron`);
    for (const [x, z] of WILD_SITES) {
      const distance = Math.hypot(
        Math.max(r.minX - x, 0, x - r.maxX),
        Math.max(r.minZ - z, 0, z - r.maxZ),
      );
      if (distance < 6)
        problems.push(`surface ${i} approaches wild site ${x},${z}`);
    }
    for (const x of [r.minX, (r.minX + r.maxX) / 2, r.maxX])
      for (const z of [r.minZ, (r.minZ + r.maxZ) / 2, r.maxZ])
        if (terrain.height(x, z) > 0.02)
          problems.push(`surface ${i} climbs terrain at ${x},${z}`);
  }
  const house = localBounds("terrace-house-v2");
  for (const plot of built.plots) {
    const [x, z] = plot.house,
      houseBox = {
        minX: x + house.min.x,
        maxX: x + house.max.x,
        minZ: z + house.min.z,
        maxZ: z + house.max.z,
      };
    for (const r of built.surfaces)
      if (intersects(r, houseBox))
        problems.push(`pavement crosses the exported house at ${x},${z}`);
    for (let dz = plot.doorstep[1] + 0.25; dz <= plot.lane[1]; dz += 0.1) {
      const blocked = collisions.find(
        (c) =>
          Math.abs(plot.doorstep[0] - c.x) < c.w / 2 + 0.22 &&
          Math.abs(dz - c.z) < c.d / 2 + 0.22,
      );
      if (blocked)
        problems.push(`blocked door/gate ${x},${z}: ${blocked.x},${blocked.z}`);
    }
  }
  assert.deepEqual(problems, []);
});

test("each neighbourhood pavement forms a continuous connection from all six doors to its junction", () => {
  const adjacent = (a, b) => {
    const xOverlap = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX),
      zOverlap = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);
    return (
      (xOverlap > 0.22 && zOverlap >= -1e-6) ||
      (zOverlap > 0.22 && xOverlap >= -1e-6)
    );
  };
  for (const street of built.streets) {
    const surfaces = built.surfaces.filter(
      (r) => r.district === street.district,
    );
    const reached = new Set(
      surfaces.flatMap((r, i) => (contains(r, street.junction) ? [i] : [])),
    );
    assert.ok(reached.size, `No junction connection for ${street.name}`);
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < surfaces.length; i++)
        if (
          !reached.has(i) &&
          [...reached].some((j) => adjacent(surfaces[i], surfaces[j]))
        ) {
          reached.add(i);
          changed = true;
        }
    }
    for (const plot of built.plots.filter(
      (p) => p.district === street.district,
    ))
      assert.ok(
        [...reached].some((i) => contains(surfaces[i], plot.doorstep)),
        `Door at ${plot.house} disconnected from ${street.name}`,
      );
  }
});

test("the actual Blender fence, bin and garden meshes stay out of lanes and houses", () => {
  const problems = [];
  const house = localBounds("terrace-house-v2");
  for (const p of placements.filter(
    (p) => !["path-2m", "streetlamp"].includes(p.name),
  )) {
    const b = localBounds(p.name).clone().applyMatrix4(p.matrix);
    const r = { minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z };
    for (const surface of built.surfaces)
      if (intersects(r, surface))
        problems.push(`${p.name} ${p.x},${p.z} clips a lane`);
    for (let i = 1; i < route.length; i++)
      if (overlapsRoad(b, route[i - 1], route[i]))
        problems.push(`${p.name} ${p.x},${p.z} intrudes into a ring road`);
    for (const [x, z] of DISTRICT_HOUSES.flat())
      if (
        intersects(r, {
          minX: x + house.min.x,
          maxX: x + house.max.x,
          minZ: z + house.min.z,
          maxZ: z + house.max.z,
        })
      )
        problems.push(`${p.name} ${p.x},${p.z} intersects a house`);
  }
  assert.deepEqual(problems, []);
});

test("explicit residential collider metadata matches the authored fence and lamp pole geometry", () => {
  const sourceBounds = {
    "fence-3m": localBounds("fence-3m"),
    streetlamp: exportedBounds(
      catalog,
      "streetlamp",
      (node) => node.name === "Pole",
    ),
  };
  const overrides = built.props.filter((p) => p.collisionFootprint);
  assert.equal(overrides.length, 224);
  for (const prop of overrides) {
    const b = sourceBounds[prop.asset],
      c = prop.collisionFootprint;
    assert.ok(b, `Unexpected explicit collision source ${prop.asset}`);
    for (const [actual, expected] of [
      [c.x - c.w / 2, b.min.x],
      [c.x + c.w / 2, b.max.x],
      [c.z - c.d / 2, b.min.z],
      [c.z + c.d / 2, b.max.z],
    ]) {
      assert.ok(
        Math.abs(actual - expected) < 0.000001,
        `${prop.asset} collider differs from its Blender footprint`,
      );
    }
    const cos = Math.cos(prop.angle),
      sin = Math.sin(prop.angle),
      scale = prop.scale;
    const expected = {
      x: prop.x + c.x * scale * cos + c.z * scale * sin,
      z: prop.z - c.x * scale * sin + c.z * scale * cos,
      w: Math.abs(c.w * scale * cos) + Math.abs(c.d * scale * sin),
      d: Math.abs(c.w * scale * sin) + Math.abs(c.d * scale * cos),
      residentialStreet: true,
    };
    assert.equal(
      collisions.filter((actual) =>
        ["x", "z", "w", "d"].every((key) => actual[key] === expected[key]),
      ).length,
      1,
      "Each explicit footprint must exist exactly once",
    );
  }
});
