import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Box3, Group, Scene, Vector3 } from "three";
import { assembleWorld } from "../src/world.js";
import { initialSave, DISTRICTS } from "../src/rules.js";
import { WILD_SITES } from "../src/field-notes.js";
import { createCollisionIndex } from "../src/spatial-index.js";
import { clearSegment } from "../src/animal-motion.js";
import { isMorrowQuayWater } from "../src/morrow-quay.js";
import { overlapsRoad } from "./lib/scene-geometry.js";

const readData = (name) =>
  JSON.parse(readFileSync(new URL(`../game-assets/${name}`, import.meta.url)));
const catalog = readData("asset-catalog.json");
const bedroom = readData("bedroom-layout.json");
const assets = Object.fromEntries(
  Object.keys(catalog).map((name) => [
    name,
    { scene: new Group(), animations: [] },
  ]),
);
const world = assembleWorld(new Scene(), assets, catalog, bedroom);
const { info, placementLog } = world;
const index = createCollisionIndex(info.collisions);
const blocked = (x, z) => isMorrowQuayWater(x, z) || index.blocked(x, z);
// The runtime owns collision geometry. Match each footprint to its source only
// for readable failures; never substitute another collision set in the checks.
const colliderLabels = new Array(info.collisions.length);
const colliderKey = (c) => [c.x, c.z, c.w, c.d].join(",");
const byGeometry = new Map();
info.collisions.forEach((c, i) => {
  const key = colliderKey(c);
  if (!byGeometry.has(key)) byGeometry.set(key, []);
  byGeometry.get(key).push(i);
});
const placementKey = (p) =>
  [p.asset, p.x, p.z, p.ry ?? p.angle, p.scale].join(",");
const residentialProps = info.residentialStreets?.props ?? [];
const residentialByPlacement = new Map(
  residentialProps.map((p) => [placementKey(p), p]),
);
assert.equal(
  residentialByPlacement.size,
  residentialProps.length,
  "Residential collision sources must be unique placements",
);
const checkedResidential = new Set();
for (const p of placementLog) {
  const residential = residentialByPlacement.get(placementKey(p));
  if (residential) {
    assert.ok(
      !checkedResidential.has(residential),
      "Residential source must match exactly one world placement",
    );
    checkedResidential.add(residential);
  }
  const localFootprints = [...(catalog[p.asset].colliders ?? [])];
  if (residential?.collisionFootprint)
    localFootprints.push(residential.collisionFootprint);
  for (const c of localFootprints) {
    const sx = p.scale,
      sz = p.scale * p.stretchZ,
      cos = Math.cos(p.ry),
      sin = Math.sin(p.ry);
    const expected = {
      x: p.x + c.x * sx * cos + c.z * sz * sin,
      z: p.z - c.x * sx * sin + c.z * sz * cos,
      w: Math.abs(c.w * sx * cos) + Math.abs(c.d * sz * sin),
      d: Math.abs(c.w * sx * sin) + Math.abs(c.d * sz * cos),
    };
    const match = byGeometry.get(colliderKey(expected))?.shift();
    assert.notEqual(
      match,
      undefined,
      `Missing assembled collider for ${p.asset} at (${p.x}, ${p.z})`,
    );
    assert.deepEqual(
      info.collisions[match],
      residential ? { ...expected, residentialStreet: true } : expected,
      `Collider metadata or geometry differs from its placed ${p.asset} source`,
    );
    colliderLabels[match] =
      `${p.asset}${residential?.collisionFootprint === c ? " residential footprint" : ""} at (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`;
  }
}
assert.equal(
  checkedResidential.size,
  residentialProps.length,
  "Every declared residential source must be placed",
);
info.collisions.forEach((c, i) => {
  assert.ok(
    colliderLabels[i],
    `Unidentified runtime collider at (${c.x}, ${c.z})`,
  );
});
const obstaclesAt = (x, z, padding = 0.22) =>
  info.collisions.flatMap((c, i) =>
    Math.abs(x - c.x) < c.w / 2 + padding &&
    Math.abs(z - c.z) < c.d / 2 + padding
      ? [colliderLabels[i]]
      : [],
  );
const reasonAt = (x, z) =>
  obstaclesAt(x, z).join("; ") ||
  (isMorrowQuayWater(x, z) ? "harbour water" : "no connected path");
function noFailures(failures) {
  const unique = [...new Set(failures)];
  assert.equal(
    unique.length,
    0,
    `${unique.length} layout defects:\n${unique
      .slice(0, 12)
      .map((s) => ` - ${s}`)
      .join("\n")}${unique.length > 12 ? "\n (further defects omitted)" : ""}`,
  );
}
function box(c, pad = 0) {
  return new Box3(
    new Vector3(c.x - c.w / 2 - pad, -100, c.z - c.d / 2 - pad),
    new Vector3(c.x + c.w / 2 + pad, 100, c.z + c.d / 2 + pad),
  );
}
function flood(start, allowed, step = 0.2) {
  assert.ok(
    !blocked(...start),
    `Flood start (${start}) is blocked by ${reasonAt(...start)}`,
  );
  const key = (x, z) => `${x},${z}`;
  const queue = [[Math.round(start[0] / step), Math.round(start[1] / step)]];
  const visited = new Set([key(...queue[0])]);
  for (let i = 0; i < queue.length; i++) {
    const [x, z] = queue[i];
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        nz = z + dz,
        k = key(nx, nz),
        px = nx * step,
        pz = nz * step;
      if (visited.has(k) || !allowed(px, pz) || blocked(px, pz)) continue;
      // Grid steps cannot jump narrow physical obstacles between endpoints.
      if (
        !clearSegment({ x: x * step, z: z * step }, { x: px, z: pz }, blocked)
      )
        continue;
      visited.add(k);
      queue.push([nx, nz]);
    }
  }
  return {
    has: (x, z) => visited.has(key(Math.round(x / step), Math.round(z / step))),
    near: (x, z, radius) =>
      queue.some(
        ([ix, iz]) => Math.hypot(ix * step - x, iz * step - z) <= radius,
      ),
  };
}
const inside = (room, x, z) =>
  x >= room.minX && x <= room.maxX && z >= room.minZ && z <= room.maxZ;

test("every assembled road module and junction keeps its entire carriageway clear", () => {
  const failures = [];
  const roadModules = placementLog.filter(
    (p) => p.asset === "road-straight-12m" || p.asset === "road-junction-12m",
  );
  assert.ok(
    roadModules.length > 150,
    "Audit must include the county ring and village streets",
  );
  for (const p of roadModules) {
    const half = 6 * p.scale * p.stretchZ;
    const dx = Math.sin(p.ry) * half,
      dz = Math.cos(p.ry) * half;
    const width = (p.asset === "road-junction-12m" ? 12 : 8) * p.scale;
    const a = [p.x - dx, p.z - dz],
      b = [p.x + dx, p.z + dz];
    for (let i = 0; i < info.collisions.length; i++)
      if (overlapsRoad(box(info.collisions[i]), a, b, width))
        failures.push(
          `${colliderLabels[i]} intersects ${p.asset} at (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`,
        );
  }
  noFailures(failures);
});

test("all eight leaders have a six-metre battle apron and a route from their district junction", () => {
  assert.equal(info.towns.length, 8);
  const failures = [];
  info.towns.forEach((t, district) => {
    const battleArea = box({ x: t.gymX, z: t.gymZ, w: 6, d: 6 });
    info.collisions.forEach((c, i) => {
      if (battleArea.intersectsBox(box(c, 0.22)))
        failures.push(
          `${DISTRICTS[district].name}: ${colliderLabels[i]} intrudes into the 6 m battle apron`,
        );
    });
    const minX = Math.min(t.x, t.gymX) - 8,
      maxX = Math.max(t.x, t.gymX) + 8;
    const minZ = Math.min(t.z, t.gymZ) - 5,
      maxZ = Math.max(t.z, t.gymZ) + 8;
    const visited = flood(
      [t.x, t.z],
      (x, z) => x >= minX && x <= maxX && z >= minZ && z <= maxZ,
    );
    if (!visited.has(t.gymX, t.gymZ + 1.4))
      failures.push(
        `${DISTRICTS[district].name}: no connected junction-to-leader approach (${reasonAt(t.gymX, t.gymZ + 1.4)})`,
      );
  });
  noFailures(failures);
});

test("the furnished opening bedroom connects to every home room and the outside path", () => {
  const rooms = [
    { minX: -4, maxX: 4, minZ: -4, maxZ: 4 },
    ...info.interiors.rooms.filter((r) => r.id.startsWith("home-")),
    { minX: -1, maxX: 1, minZ: 8, maxZ: 14 },
  ];
  const start = initialSave().position;
  const visited = flood(
    [start.x, start.z],
    (x, z) => rooms.some((r) => inside(r, x, z)),
    0.1,
  );
  const failures = [];
  for (const [name, x, z] of [
    ["bedroom door", 0, 4],
    ["hall", 0, 6],
    ["kitchen", -4.4, 6],
    ["living room", 4.8, 6.1],
    ["parent's room", 4, 10],
    ["bathroom", -8, 9.1],
    ["utility room", -4, 9.1],
    ["front doorway", 0, 8],
    ["outside front path", 0, 13],
  ])
    if (!visited.has(x, z))
      failures.push(
        `${name} is unreachable from the actual bedroom spawn: ${reasonAt(x, z)}`,
      );
  for (const item of info.interiors.interactions.filter((i) =>
    i.id.startsWith("home-"),
  ))
    if (!visited.near(item.x, item.z, Math.min(item.radius, 1.15)))
      failures.push(
        `${item.id} cannot be approached from inside the furnished home`,
      );
  for (const [name, x, z, radius] of [
    ["school bag", 1.25, 3.12, 1.2],
    ["radio", -2.78, -2.82, 1.35],
    ["school homework", -1.35, -2.6, 1.35],
    ["bed/rest", 2, 0.6, 1.35],
  ])
    if (!visited.near(x, z, radius))
      failures.push(`${name} cannot be reached from the bedroom spawn`);
  noFailures(failures);
});

test("home-to-clinic access reaches Gary, every starter pen and indoor research notes", () => {
  const outside = flood(
    [0, 13],
    (x, z) => x >= -1 && x <= 32 && z >= -31 && z <= 22,
  );
  const failures = [];
  if (!outside.has(24, -17))
    failures.push(
      "The clinic entrance cannot be reached from the home's front path",
    );
  const clinic = info.interiors.rooms.find((r) => r.id === "county-research");
  const visited = flood(
    [24, -17],
    (x, z) =>
      inside(clinic, x, z) || (x >= 23 && x <= 25 && z >= -18 && z <= -16.5),
    0.1,
  );
  const researcher = info.interiors.researcher;
  if (blocked(researcher.x, researcher.z))
    failures.push(`Gary is inside ${reasonAt(researcher.x, researcher.z)}`);
  if (!visited.has(researcher.x, researcher.z + 1.2))
    failures.push("Gary has no indoor approach from the entrance");
  for (const pen of info.interiors.starters) {
    if (blocked(pen.x, pen.z))
      failures.push(
        `${pen.species} starter spawns inside ${reasonAt(pen.x, pen.z)}`,
      );
    if (!visited.has(pen.x, pen.z + 1.1))
      failures.push(
        `${pen.species} pen front is unreachable from the clinic entrance`,
      );
  }
  for (const item of info.interiors.interactions.filter((i) =>
    i.id.startsWith("research-"),
  ))
    if (!visited.near(item.x, item.z, 1.15))
      failures.push(`${item.id} is inaccessible inside the clinic`);
  noFailures(failures);
});

test("all wild animals spawn outside scenery and have unobstructed space to begin roaming", () => {
  const failures = [];
  for (const [x, z, species] of WILD_SITES) {
    if (blocked(x, z)) {
      failures.push(
        `${species} at (${x}, ${z}) spawns inside ${reasonAt(x, z)}`,
      );
      continue;
    }
    let openDirections = 0;
    for (let i = 0; i < 16; i++) {
      const angle = (i * Math.PI) / 8;
      if (
        clearSegment(
          { x, z },
          { x: x + Math.sin(angle) * 1.5, z: z + Math.cos(angle) * 1.5 },
          blocked,
        )
      )
        openDirections++;
    }
    if (openDirections < 4)
      failures.push(
        `${species} at (${x}, ${z}) has only ${openDirections}/16 clear initial roaming directions`,
      );
  }
  noFailures(failures);
});

test("county waymarkers and neighbour doorbells have clear front reading positions", () => {
  const failures = [];
  assert.equal(info.waymarkers.length, 8);
  for (const marker of info.waymarkers) {
    const p = placementLog.find(
      (p) =>
        p.asset.startsWith("waymarker-") &&
        p.x === marker.x &&
        p.z === marker.z,
    );
    assert.ok(p, `District ${marker.district} waypoint has no Blender sign`);
    const x = p.x + Math.sin(p.ry) * 1.6,
      z = p.z + Math.cos(p.ry) * 1.6;
    if (blocked(x, z))
      failures.push(
        `${p.asset} reading position is blocked by ${reasonAt(x, z)}`,
      );
  }
  for (const house of placementLog.filter(
    (p) => p.asset === "terrace-house-v2",
  )) {
    const x = house.x - 2.3 * Math.cos(house.ry) + 4.9 * Math.sin(house.ry);
    const z = house.z + 2.3 * Math.sin(house.ry) + 4.9 * Math.cos(house.ry);
    if (blocked(x, z))
      failures.push(
        `Doorbell at house (${house.x}, ${house.z}) has no clear doorstep: ${reasonAt(x, z)}`,
      );
  }
  noFailures(failures);
});

test("district observation targets can be approached from the public junctions", () => {
  const failures = [];
  const modules = Object.entries(info).filter(
    ([name, value]) =>
      name !== "interiors" && Array.isArray(value?.interactions),
  );
  assert.ok(
    modules.length >= 4,
    "District interaction metadata must be included in assembled world info",
  );
  for (const [, district] of modules)
    for (const item of district.interactions) {
      const town = [...info.towns].sort(
        (a, b) =>
          Math.hypot(a.x - item.x, a.z - item.z) -
          Math.hypot(b.x - item.x, b.z - item.z),
      )[0];
      const minX = Math.min(town.x, item.x) - 8,
        maxX = Math.max(town.x, item.x) + 8;
      const minZ = Math.min(town.z, item.z) - 8,
        maxZ = Math.max(town.z, item.z) + 8;
      const visited = flood(
        [town.x, town.z],
        (x, z) => x >= minX && x <= maxX && z >= minZ && z <= maxZ,
      );
      if (!visited.near(item.x, item.z, Math.min(item.radius, 1.5)))
        failures.push(`${item.id} has no approach from its public junction`);
    }
  noFailures(failures);
});
