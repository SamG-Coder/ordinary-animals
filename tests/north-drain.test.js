import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Box3, Matrix4, Quaternion, Vector3 } from "three";
import { buildNorthDrain, NORTH_DRAIN, NORTH_DRAIN_INTERACTIONS } from "../src/north-drain.js";
import { placeDistrictHousing } from "../src/district-housing.js";

const catalog = JSON.parse(readFileSync(new URL("../game-assets/asset-catalog.json", import.meta.url)));
const boundsCache = new Map();
function exportBounds(name, part = "all") {
  const key = `${name}:${part}`;
  if (boundsCache.has(key)) return boundsCache.get(key);
  const b = readFileSync(new URL(`../game-assets/${catalog[name].model}`, import.meta.url));
  const gltf = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)));
  const box = new Box3();
  function visit(index, parent = new Matrix4()) {
    const node = gltf.nodes[index];
    const matrix = node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(
      new Vector3().fromArray(node.translation ?? [0, 0, 0]),
      new Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]),
      new Vector3().fromArray(node.scale ?? [1, 1, 1]),
    );
    matrix.premultiply(parent);
    const matchesPart = part === "all" || (part === "walking-deck" && /^(Individual steel bridge deck plate|Raised anti-slip chevron)/.test(node.name ?? ""));
    if (node.mesh !== undefined && matchesPart)
      for (const primitive of gltf.meshes[node.mesh].primitives) {
        const a = gltf.accessors[primitive.attributes.POSITION];
        assert.ok(a.min && a.max, `${name} has no exported geometry bounds`);
        box.union(new Box3(new Vector3().fromArray(a.min), new Vector3().fromArray(a.max)).applyMatrix4(matrix));
      }
    for (const child of node.children ?? []) visit(child, matrix);
  }
  for (const root of gltf.scenes[gltf.scene ?? 0].nodes) visit(root);
  assert.ok(!box.isEmpty(), `${name} has no exported mesh`);
  boundsCache.set(key, box);
  return box;
}

function layout() {
  const obstacles = [], placements = [];
  buildNorthDrain({
    lamp() {},
    place(name, x, z, y = 0, angle = 0, scale = 1) {
      assert.ok(catalog[name], `Missing Blender module ${name}`);
      placements.push({ name, x, z, y, angle, scale });
      const cos = Math.cos(angle), sin = Math.sin(angle);
      for (const c of catalog[name].colliders ?? []) obstacles.push({
        name, x: x + (c.x * cos + c.z * sin) * scale,
        z: z + (-c.x * sin + c.z * cos) * scale,
        w: (Math.abs(c.w * cos) + Math.abs(c.d * sin)) * scale,
        d: (Math.abs(c.w * sin) + Math.abs(c.d * cos)) * scale,
      });
    },
  });
  const blocked = (x, z) => obstacles.find((c) => Math.abs(x - c.x) < c.w / 2 + .22 && Math.abs(z - c.z) < c.d / 2 + .22);
  return { obstacles, placements, blocked };
}

const boxPolygon = (b) => [[b.min.x, b.min.z], [b.max.x, b.min.z], [b.max.x, b.max.z], [b.min.x, b.max.z]];
function intersects(a, b) {
  for (const polygon of [a, b])
    for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i], q = polygon[(i + 1) % polygon.length];
      const nx = -(q[1] - p[1]), nz = q[0] - p[0];
      const project = (points) => points.map(([x, z]) => x * nx + z * nz);
      const av = project(a), bv = project(b);
      if (Math.max(...av) <= Math.min(...bv) || Math.max(...bv) <= Math.min(...av)) return false;
    }
  return true;
}
function roadPolygon(a, b, width = 8) {
  const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
  const nx = -dz / length * width / 2, nz = dx / length * width / 2;
  return [[a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz], [a[0] - nx, a[1] - nz]];
}

test("North Drain's open bridge and full six-metre battle apron are walkable", () => {
  const { blocked, placements } = layout();
  const clear = (x, z) => assert.ok(!blocked(x, z), `${blocked(x, z)?.name} blocks ${x}, ${z}`);
  for (let x = -45; x <= -28; x += .1) clear(x, -295);
  for (let z = -295; z >= -307; z -= .1) clear(-28, z);
  for (let x = -29.05; x <= -26.95; x += .1)
    for (let z = -300.5; z <= -296; z += .1) clear(x, z);
  for (let x = -31; x <= -25; x += .25)
    for (let z = -307; z <= -301; z += .25) clear(x, z);
  assert.equal(placements.filter((p) => p.name === "canal-footbridge").length, 1);
  assert.equal(placements.some((p) => p.name === "brick-drain-channel-4m" && p.x === -28), false, "A hidden channel bank must not obstruct the bridge");
  clear(...NORTH_DRAIN.leader);
  for (const note of NORTH_DRAIN_INTERACTIONS) {
    let approachable = false;
    for (let x = note.x - 1.25; x <= note.x + 1.25; x += .1)
      for (let z = note.z - 1.25; z <= note.z + 1.25; z += .1)
        if (!blocked(x, z) && Math.hypot(x - note.x, z - note.z) < 1.2) approachable = true;
    assert.ok(approachable, `${note.id} cannot be approached`);
  }
});

test("North Drain exported architecture clears both full road surfaces and existing houses", () => {
  const { placements } = layout();
  const roads = [roadPolygon(NORTH_DRAIN.incoming, NORTH_DRAIN.junction), roadPolygon(NORTH_DRAIN.junction, NORTH_DRAIN.outgoing)];
  const [jx, jz] = NORTH_DRAIN.junction;
  roads.push([[jx - 6, jz - 6], [jx + 6, jz - 6], [jx + 6, jz + 6], [jx - 6, jz + 6]]);
  const architecture = new Set(["pump-station", "brick-drain-channel-4m", "drainage-pipe", "canal-footbridge", "north-drain-notice"]);
  const housing = [];
  placeDistrictHousing(3, (name, x, z) => housing.push({ name, x, z }));
  for (const p of placements.filter((p) => architecture.has(p.name))) {
    const transform = new Matrix4().compose(new Vector3(p.x, p.y, p.z), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), p.angle), new Vector3(p.scale, p.scale, p.scale));
    const box = exportBounds(p.name).clone().applyMatrix4(transform);
    const polygon = boxPolygon(box);
    for (const road of roads) assert.equal(intersects(polygon, road), false, `${p.name} mesh overlaps a reserved road surface`);
    for (const { name, x, z } of housing) {
      const house = exportBounds(name).clone().translate(new Vector3(x, 0, z));
      assert.equal(intersects(polygon, boxPolygon(house)), false, `${p.name} overlaps existing housing at ${x}, ${z}`);
    }
  }
});

test("the exported bridge deck stays at the existing walking grade", () => {
  const deck = exportBounds("canal-footbridge", "walking-deck");
  assert.ok(deck.min.y >= 0, "Deck must not sink into the ground plane");
  assert.ok(deck.max.y <= .027, `Deck top ${deck.max.y} would visibly clip feet above the runtime walking grade`);
  assert.ok(deck.max.y >= .018, "Walking-deck geometry must exist above the water");
});
