import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Box3, Matrix4, Quaternion, Vector3 } from "three";

test("exported road paint lies between 0.2 and 1 mm above the preserved asphalt", () => {
  const bytes = readFileSync(
    new URL("../game-assets/models/road-straight-12m.glb", import.meta.url),
  );
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
  const objects = [];
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
    if (node.mesh !== undefined) {
      const bounds = new Box3();
      for (const primitive of gltf.meshes[node.mesh].primitives) {
        const positions = gltf.accessors[primitive.attributes.POSITION];
        bounds.union(
          new Box3(
            new Vector3().fromArray(positions.min),
            new Vector3().fromArray(positions.max),
          ).applyMatrix4(matrix),
        );
      }
      objects.push({ name: node.name, bounds });
    }
    for (const child of node.children ?? []) visit(child, matrix);
  }
  for (const node of gltf.scenes[gltf.scene ?? 0].nodes) visit(node);
  const asphalt = objects.find((obj) => obj.name === "Asphalt");
  const paint = objects.filter((obj) =>
    /^(Edge marking|Centre dash)/.test(obj.name),
  );
  assert.ok(asphalt, "The original asphalt object must remain in the export");
  assert.equal(
    paint.length,
    5,
    "Preserve both edge lines and all three centre dashes",
  );
  assert.deepEqual(
    [
      asphalt.bounds.min.x,
      asphalt.bounds.max.x,
      asphalt.bounds.min.z,
      asphalt.bounds.max.z,
    ],
    [-4, 4, -6, 6],
    "The 8×12 metre road footprint changed",
  );
  assert.ok(Math.abs(asphalt.bounds.max.y) < 1e-6, "The asphalt datum moved");
  for (const { name, bounds } of paint) {
    assert.ok(
      bounds.min.y >= asphalt.bounds.max.y + 0.00019,
      `${name} intersects asphalt`,
    );
    assert.ok(
      bounds.max.y <= asphalt.bounds.max.y + 0.00101,
      `${name} still looks like a raised plastic strip`,
    );
  }
});
