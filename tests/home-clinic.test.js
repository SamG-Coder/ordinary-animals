import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Vector3 } from "three";
import { exportedBounds } from "./lib/scene-geometry.js";
import {
  buildHomeClinic,
  HOME_CLINIC_ROOMS,
  HOME_CLINIC_INTERACTIONS,
  HOME_CLINIC_STARTERS,
  HOME_CLINIC_ROAD,
  HOME_CLINIC_RIVAL,
} from "../src/home-clinic.js";

const catalog = JSON.parse(
  readFileSync(new URL("../game-assets/asset-catalog.json", import.meta.url)),
);

function layout() {
  const obstacles = [];
  const placements = [];
  const metadata = buildHomeClinic({
    place(name, x, z, y = 0, angle = 0, scale = 1) {
      assert.ok(catalog[name], `Missing exported Blender asset ${name}`);
      placements.push({ name, x, z, y, angle, scale });
      const cos = Math.cos(angle), sin = Math.sin(angle);
      for (const c of catalog[name].colliders ?? [])
        obstacles.push({
          name,
          x: x + (c.x * cos + c.z * sin) * scale,
          z: z + (-c.x * sin + c.z * cos) * scale,
          w: (Math.abs(c.w * cos) + Math.abs(c.d * sin)) * scale,
          d: (Math.abs(c.w * sin) + Math.abs(c.d * cos)) * scale,
        });
    },
  });
  const blocked = (x, z, radius = .22) => obstacles.find((c) =>
    Math.abs(x - c.x) < c.w / 2 + radius &&
    Math.abs(z - c.z) < c.d / 2 + radius,
  );
  return { obstacles, placements, metadata, blocked };
}

function inside(room, x, z) {
  return x >= room.minX && x <= room.maxX && z >= room.minZ && z <= room.maxZ;
}

test("both kitchen chairs face the dining table according to the exported seat and back geometry", () => {
  const { placements } = layout();
  const kitchen = HOME_CLINIC_ROOMS.find((room) => room.id === "home-kitchen");
  const table = placements.find((p) => p.name === "home-dining-table");
  const chairs = placements.filter((p) => p.name === "chair" && inside(kitchen, p.x, p.z));
  assert.equal(chairs.length, 2);
  const seat = exportedBounds(catalog, "chair", (node) => node.name === "Chair seat").getCenter(new Vector3());
  const back = exportedBounds(catalog, "chair", (node) => node.name === "Chair back").getCenter(new Vector3());
  const top = exportedBounds(catalog, "home-dining-table", (node) => node.name === "Formica dining top").getCenter(new Vector3());
  const world = (point, p) => new Vector3(
    p.x + (point.x * Math.cos(p.angle) + point.z * Math.sin(p.angle)) * p.scale,
    0,
    p.z + (-point.x * Math.sin(p.angle) + point.z * Math.cos(p.angle)) * p.scale,
  );
  const centre = world(top, table);
  for (const chair of chairs) {
    const seatCentre = world(seat, chair), backCentre = world(back, chair);
    const facing = seatCentre.clone().sub(backCentre).normalize();
    const toTable = centre.clone().sub(seatCentre).normalize();
    assert.ok(facing.dot(toTable) > .99, `Kitchen chair at ${chair.x},${chair.z} faces away from the table`);
    assert.ok(backCentre.distanceTo(centre) > seatCentre.distanceTo(centre) + .15,
      `Kitchen chair at ${chair.x},${chair.z} puts its back between the seat and the table`);
  }
});

// Flood the actual collider geometry at 10 cm intervals. Restricting the search
// to interior rectangles prevents an exterior detour from hiding a blocked door.
function reachable({ blocked }, rooms, start) {
  const step = .1;
  const encode = (x, z) => `${Math.round(x / step)},${Math.round(z / step)}`;
  const queue = [[Math.round(start[0] / step), Math.round(start[1] / step)]];
  const seen = new Set([encode(...start)]);
  for (let index = 0; index < queue.length; index++) {
    const [ix, iz] = queue[index];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = ix + dx, nz = iz + dz;
      const key = `${nx},${nz}`, x = nx * step, z = nz * step;
      if (seen.has(key) || !rooms.some((room) => inside(room, x, z)) || blocked(x, z)) continue;
      seen.add(key);
      queue.push([nx, nz]);
    }
  }
  return {
    has: (x, z) => seen.has(encode(x, z)),
    near: (x, z, radius) => queue.some(([ix, iz]) => Math.hypot(ix * step - x, iz * step - z) <= radius),
    count: seen.size,
  };
}

test("home side doorways connect every furnished room for player and companion", () => {
  const built = layout();
  const rooms = HOME_CLINIC_ROOMS.filter((r) => r.id.startsWith("home-"));
  const visited = reachable(built, rooms, [0, 6]);
  for (const [label, x, z] of [
    ["kitchen", -4.4, 6],
    ["living room", 4.8, 6.1],
    ["parent's room", 4, 10],
    ["bathroom", -8, 9.1],
    ["utility room", -4, 9.1],
    ["front door", 0, 7.6],
    ["bedroom door", 0, 4.3],
  ]) assert.ok(visited.has(x, z), `No indoor path with .22 m body clearance to ${label}`);
  for (const doorway of [[-2, 6], [2, 6], [-8, 8], [-4, 8], [4, 8]])
    for (const offset of [-.20, 0, .20]) {
      const [x, z] = doorway;
      assert.ok(!built.blocked(x + (Math.abs(x) === 2 ? 0 : offset), z + (Math.abs(x) === 2 ? offset : 0)), `Doorway ${doorway} is pinched`);
    }
  for (const item of HOME_CLINIC_INTERACTIONS.filter((i) => i.id.startsWith("home-")))
    assert.ok(visited.near(item.x, item.z, Math.min(item.radius, 1.15)), `Cannot approach ${item.id} from inside home`);
});

test("clinic entrance reaches the researcher and all three open pen fronts", () => {
  const built = layout();
  const rooms = [
    HOME_CLINIC_ROOMS.find((r) => r.id === "county-research"),
    { minX: 23, maxX: 25, minZ: -18, maxZ: -16.5 },
  ];
  const visited = reachable(built, rooms, [24, -17]);
  assert.ok(visited.has(24, -25.4), "The researcher has no unobstructed front approach");
  assert.ok(!built.blocked(24, -26), "The researcher stands inside scenery");
  for (const pen of HOME_CLINIC_STARTERS) {
    assert.ok(visited.has(pen.x, pen.z + 1.05), `Cannot walk to the ${pen.species} pen front`);
    assert.ok(!built.blocked(pen.x, pen.z), `${pen.species} overlaps kennel scenery`);
    assert.ok(built.blocked(pen.x, pen.z - .84), `${pen.species} pen rear has no collision`);
  }
  for (const item of HOME_CLINIC_INTERACTIONS.filter((i) => i.id.startsWith("research-")))
    assert.ok(visited.near(item.x, item.z, 1.15), `Cannot approach ${item.id}`);
  for (let z = -17; z >= -25.4; z -= .1)
    assert.ok(!built.blocked(24, z), `Straight researcher approach blocked at ${z}`);
});

test("rain-mask rooms cover all placed indoor furniture and leave the front path outdoors", () => {
  const { placements } = layout();
  const furniture = new Set(["family-sofa", "home-crt-tv", "kitchen-counter", "kitchen-fridge", "home-dining-table", "family-photo", "bathroom-basin", "bathroom-toilet", "bathroom-tub", "research-bench", "starter-pen"]);
  for (const p of placements.filter((p) => furniture.has(p.name)))
    assert.ok(HOME_CLINIC_ROOMS.some((room) => inside(room, p.x, p.z)), `${p.name} is outside indoor weather bounds`);
  assert.equal(HOME_CLINIC_ROOMS.some((room) => inside(room, 0, 10)), false, "Front garden must remain outdoors");
  assert.equal(HOME_CLINIC_ROOMS.some((room) => inside(room, 24, -17)), false, "Clinic front path must remain outdoors");
});

test("the full village carriageway and junction clear the extended home and clinic", () => {
  const { obstacles, blocked } = layout();
  const r = HOME_CLINIC_ROAD;
  const roadBounds = [
    { label: "north-south carriageway", x: r.x, z: (r.startZ + r.endZ) / 2, w: r.width, d: r.endZ - r.startZ },
    { label: "main-road junction", x: r.junctionX, z: r.junctionZ, w: r.junctionWidth, d: r.junctionDepth },
  ];
  for (const road of roadBounds)
    for (const c of obstacles)
      assert.ok(
        Math.abs(c.x - road.x) >= (c.w + road.w) / 2 || Math.abs(c.z - road.z) >= (c.d + road.d) / 2,
        `${c.name} overlaps ${road.label}`,
      );
  for (let z = r.startZ; z <= r.endZ; z += .2)
    for (const edge of [-3.8, 0, 3.8])
      assert.ok(!blocked(r.x + edge, z), `Road edge blocked at ${r.x + edge}, ${z}`);
  assert.ok(!blocked(HOME_CLINIC_RIVAL.x, HOME_CLINIC_RIVAL.z), "Rival is inside scenery");
  assert.ok(Math.abs(HOME_CLINIC_RIVAL.x - r.x) > r.width / 2 + 1, "Rival stands on carriageway");
  for (let z = -12; z >= -18; z -= .1)
    assert.ok(!blocked(24, z), `Clinic forecourt access blocked at ${z}`);
});
