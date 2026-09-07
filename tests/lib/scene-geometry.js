// Read actual Blender-exported bounds for district layout verification without a browser.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Box3, Matrix4, Quaternion, Vector3 } from "three";

export const loadCatalog = () => JSON.parse(readFileSync(new URL("../../game-assets/asset-catalog.json", import.meta.url)));

export function exportedBounds(catalog, name, nodeFilter = () => true) {
  assert.ok(catalog[name], `Missing Blender catalog asset ${name}`);
  const binary = readFileSync(new URL(`../../game-assets/${catalog[name].model}`, import.meta.url));
  const gltf = JSON.parse(binary.subarray(20, 20 + binary.readUInt32LE(12)));
  const bounds = new Box3();
  function visit(index, parent = new Matrix4()) {
    const node = gltf.nodes[index];
    const transform = node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(
      new Vector3().fromArray(node.translation ?? [0, 0, 0]),
      new Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]),
      new Vector3().fromArray(node.scale ?? [1, 1, 1]),
    );
    transform.premultiply(parent);
    if (node.mesh !== undefined && nodeFilter(node))
      for (const primitive of gltf.meshes[node.mesh].primitives) {
        const a = gltf.accessors[primitive.attributes.POSITION];
        assert.ok(a.min && a.max, `${name} has no exported position bounds`);
        bounds.union(new Box3(new Vector3().fromArray(a.min), new Vector3().fromArray(a.max)).applyMatrix4(transform));
      }
    for (const child of node.children ?? []) visit(child, transform);
  }
  for (const node of gltf.scenes[gltf.scene ?? 0].nodes) visit(node);
  assert.ok(!bounds.isEmpty(), `${name} has no mesh geometry`);
  return bounds;
}

export function collectScene(build, catalog) {
  const placements = [], colliders = [];
  function place(name, x, z, y = 0, angle = 0, scale = 1, batch = true, stretchZ = 1) {
    assert.ok(catalog[name], `Missing Blender asset ${name}`);
    const cos = Math.cos(angle), sin = Math.sin(angle), sx = scale, sz = scale * stretchZ;
    const matrix = new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), angle), new Vector3(sx, scale, sz));
    placements.push({ name, x, z, y, angle, scale, stretchZ, matrix });
    for (const c of catalog[name].colliders ?? []) colliders.push({
      name, x: x + c.x * sx * cos + c.z * sz * sin, z: z - c.x * sx * sin + c.z * sz * cos,
      w: Math.abs(c.w * sx * cos) + Math.abs(c.d * sz * sin),
      d: Math.abs(c.w * sx * sin) + Math.abs(c.d * sz * cos),
    });
  }
  const metadata = build({ place, lamp: (x, z, angle = 0) => place("streetlamp", x, z, 0, angle) });
  const blocked = (x, z, radius = .22) => colliders.find((c) => Math.abs(x - c.x) < c.w / 2 + radius && Math.abs(z - c.z) < c.d / 2 + radius);
  return { metadata, placements, colliders, blocked };
}

export function overlapsRoad(box, a, b, width = 8) {
  const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
  const nx = -dz / length * width / 2, nz = dx / length * width / 2;
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
