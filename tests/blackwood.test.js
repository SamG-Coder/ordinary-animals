import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Box3, Matrix4, Quaternion, Vector3 } from "three";
import { buildBlackwood, BLACKWOOD, BLACKWOOD_INTERACTIONS } from "../src/blackwood.js";
import { placeDistrictHousing } from "../src/district-housing.js";
import { WILD_SITES } from "../src/field-notes.js";

const catalog = JSON.parse(readFileSync(new URL("../game-assets/asset-catalog.json", import.meta.url)));
function sourceBox(name) {
  const b = readFileSync(new URL(`../game-assets/${catalog[name].model}`, import.meta.url));
  const gltf = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)));
  const box = new Box3();
  const visit = (index, parent = new Matrix4()) => {
    const node = gltf.nodes[index];
    const matrix = node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(new Vector3().fromArray(node.translation ?? [0, 0, 0]), new Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]), new Vector3().fromArray(node.scale ?? [1, 1, 1]));
    matrix.premultiply(parent);
    if (node.mesh !== undefined)
      for (const p of gltf.meshes[node.mesh].primitives) {
        const a = gltf.accessors[p.attributes.POSITION];
        assert.ok(a.min && a.max, `${name} has no exported position bounds`);
        box.union(new Box3(new Vector3().fromArray(a.min), new Vector3().fromArray(a.max)).applyMatrix4(matrix));
      }
    for (const child of node.children ?? []) visit(child, matrix);
  };
  for (const root of gltf.scenes[gltf.scene ?? 0].nodes) visit(root);
  assert.ok(!box.isEmpty());
  return box;
}
function collect() {
  const placements = [], obstacles = [];
  buildBlackwood({
    lamp(x, z) {
      for (const c of catalog.streetlamp.colliders ?? [])
        obstacles.push({ name: "streetlamp", x: x + c.x, z: z + c.z, w: c.w, d: c.d });
    },
    place(name, x, z, y = 0, angle = 0, scale = 1) {
      assert.ok(catalog[name], `Missing Blender asset ${name}`);
      placements.push({ name, x, z, y, angle, scale });
      const cos = Math.cos(angle), sin = Math.sin(angle);
      for (const c of catalog[name].colliders ?? []) obstacles.push({
        name, x: x + (c.x * cos + c.z * sin) * scale, z: z + (-c.x * sin + c.z * cos) * scale,
        w: (Math.abs(c.w * cos) + Math.abs(c.d * sin)) * scale, d: (Math.abs(c.w * sin) + Math.abs(c.d * cos)) * scale,
      });
    },
  });
  const blocked = (x, z) => obstacles.find((c) => Math.abs(x - c.x) < c.w / 2 + .22 && Math.abs(z - c.z) < c.d / 2 + .22);
  return { placements, obstacles, blocked };
}

function overlapsRoad(box, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
  const nx = -dz / length * 4, nz = dx / length * 4;
  const road = [[a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz], [a[0] - nx, a[1] - nz]];
  const points = [[box.min.x, box.min.z], [box.max.x, box.min.z], [box.max.x, box.max.z], [box.min.x, box.max.z]];
  for (const polygon of [road, points])
    for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i], q = polygon[(i + 1) % polygon.length], axis = [-(q[1] - p[1]), q[0] - p[0]];
      const project = (vs) => vs.map(([x, z]) => x * axis[0] + z * axis[1]);
      const u = project(road), v = project(points);
      if (Math.max(...u) <= Math.min(...v) || Math.max(...v) <= Math.min(...u)) return false;
    }
  return true;
}

test("Blackwood's gate and lodge have an open approach and a six-metre battle clearing", () => {
  const { blocked, placements } = collect();
  const clear = (x, z) => assert.ok(!blocked(x, z), `${blocked(x, z)?.name} blocks ${x}, ${z}`);
  for (let x = 155; x <= 172; x += .1) clear(x, -245);
  for (let z = -245; z >= -257; z -= .1) clear(172, z);
  for (let x = 169; x <= 175; x += .2)
    for (let z = -257; z <= -251; z += .2) clear(x, z);
  for (const p of placements.filter((p) => p.name.startsWith("pine-") || p.name === "oak-tree"))
    for (const [x, z] of WILD_SITES)
      assert.ok(Math.hypot(p.x - x, p.z - z) > 5, "New forest trunk crowds a wildlife encounter");
  for (const [a, b] of [[BLACKWOOD.incoming, BLACKWOOD.junction], [BLACKWOOD.junction, BLACKWOOD.outgoing]]) {
    const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    for (let i = 0; i <= Math.ceil(length * 3); i++)
      for (const side of [-3.8, 0, 3.8]) {
        const t = i / Math.ceil(length * 3);
        clear(a[0] + dx * t - dz / length * side, a[1] + dz * t + dx / length * side);
      }
  }
  for (const note of BLACKWOOD_INTERACTIONS)
    clear(note.x, note.z + 1.4);
});

test("Blackwood's exported buildings and trail landmarks clear the roads and housing", () => {
  const { placements } = collect();
  const names = new Set(["ranger-lodge", "timber-trail-gate", "forest-trailboard", "mossy-stone-culvert"]);
  const houses = [];
  placeDistrictHousing(4, (name, x, z) => houses.push(sourceBox(name).translate(new Vector3(x, 0, z))));
  const junction = new Box3(new Vector3(149, -100, -251), new Vector3(161, 100, -239));
  for (const p of placements.filter((p) => names.has(p.name))) {
    const matrix = new Matrix4().compose(new Vector3(p.x, p.y, p.z), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), p.angle), new Vector3(p.scale, p.scale, p.scale));
    const box = sourceBox(p.name).applyMatrix4(matrix);
    assert.equal(overlapsRoad(box, BLACKWOOD.incoming, BLACKWOOD.junction), false, `${p.name} overhangs incoming road`);
    assert.equal(overlapsRoad(box, BLACKWOOD.junction, BLACKWOOD.outgoing), false, `${p.name} overhangs outgoing road`);
    assert.equal(box.intersectsBox(junction), false, `${p.name} overlaps the 12 m junction`);
    for (const house of houses) assert.equal(box.intersectsBox(house), false, `${p.name} overlaps a terrace`);
  }
});
