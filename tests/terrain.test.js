import test from "node:test";
import { insertHollowCrownRoadDetour } from "../src/hollow-crown.js";
import { insertBriarfieldRoadDetour } from "../src/briarfield.js";
import { HOME_CLINIC_ROAD } from "../src/home-clinic.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BufferGeometry,
  Float32BufferAttribute,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  DoubleSide,
  Quaternion,
  Raycaster,
  Vector3,
} from "three";
import {
  createTerrain,
  sampleSurface,
  TERRAIN_PLACEMENTS,
} from "../src/terrain.js";

const catalog = JSON.parse(readFileSync("game-assets/asset-catalog.json"));
const sampler = createTerrain(catalog);

function exportedMesh(asset) {
  const file = readFileSync(`game-assets/${catalog[asset].model}`);
  const jsonLength = file.readUInt32LE(12);
  const gltf = JSON.parse(file.subarray(20, 20 + jsonLength));
  const binaryStart = 20 + jsonLength + 8;
  function accessor(index, elements) {
    const a = gltf.accessors[index],
      view = gltf.bufferViews[a.bufferView];
    const bytes = a.componentType === 5123 ? 2 : 4;
    const values = [];
    for (let i = 0; i < a.count; i++)
      for (let j = 0; j < elements; j++) {
        const at =
          binaryStart +
          (view.byteOffset ?? 0) +
          (a.byteOffset ?? 0) +
          i * (view.byteStride ?? elements * bytes) +
          j * bytes;
        values.push(
          a.componentType === 5126
            ? file.readFloatLE(at)
            : bytes === 2
              ? file.readUInt16LE(at)
              : file.readUInt32LE(at),
        );
      }
    return values;
  }
  const node = gltf.nodes.find((n) => n.mesh !== undefined);
  const primitive = gltf.meshes[node.mesh].primitives[0];
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(accessor(primitive.attributes.POSITION, 3), 3),
  );
  if (primitive.indices !== undefined)
    geometry.setIndex(accessor(primitive.indices, 1));
  const transform = node.matrix
    ? new Matrix4().fromArray(node.matrix)
    : new Matrix4().compose(
        new Vector3().fromArray(node.translation ?? [0, 0, 0]),
        new Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]),
        new Vector3().fromArray(node.scale ?? [1, 1, 1]),
      );
  geometry.applyMatrix4(transform);
  const mesh = new Mesh(geometry, new MeshBasicMaterial({ side: DoubleSide }));
  mesh.updateMatrixWorld(true);
  return mesh;
}
const rays = new Raycaster(new Vector3(), new Vector3(0, -1, 0));

test("ground samples match the actual exported GLB triangle surfaces", () => {
  for (const name of new Set(TERRAIN_PLACEMENTS.map((p) => p.asset))) {
    const mesh = exportedMesh(name),
      surface = catalog[name].groundSurface;
    assert.equal(
      surface.heights.length,
      (surface.rows + 1) * (surface.columns + 1),
    );
    assert.ok(
      Math.max(...surface.heights) > 1,
      "a terrain piece must have actual relief",
    );
    for (let i = 0; i < 75; i++) {
      const x = (((i * 37) % 79) / 79 - 0.49) * surface.width;
      const z = (((i * 53 + 7) % 83) / 83 - 0.49) * surface.depth;
      rays.ray.origin.set(x, 100, z);
      const hit = rays.intersectObject(mesh)[0];
      assert.ok(hit, `${name} must have a rendered surface at ${x},${z}`);
      assert.ok(
        Math.abs(hit.point.y - sampleSurface(surface, x, z)) < 0.00001,
        `${name}: sampler must follow GLB triangles`,
      );
    }
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
});

test("rotated and scaled terrain samples match ray hits across assembled pieces", () => {
  const meshes = TERRAIN_PLACEMENTS.map((p) => {
    const mesh = exportedMesh(p.asset);
    mesh.position.set(p.x, 0, p.z);
    mesh.rotation.y = p.rotation;
    mesh.scale.setScalar(p.scale);
    mesh.updateMatrixWorld(true);
    return mesh;
  });
  for (const p of TERRAIN_PLACEMENTS)
    for (let i = 0; i < 11; i++) {
      const x = p.x - 11 + i * 2.13,
        z = p.z + 8 - i * 1.37;
      rays.ray.origin.set(x, 100, z);
      const hits = rays.intersectObjects(meshes);
      const expected = Math.max(0, ...hits.map((h) => h.point.y));
      assert.ok(
        Math.abs(sampler.height(x, z) - expected) < 0.00001,
        `world ground mismatch at ${x},${z}`,
      );
    }
  for (const mesh of meshes) {
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
});

test("modular hills leave the full ring road and opening village roads at grade", () => {
  const route = insertHollowCrownRoadDetour(insertBriarfieldRoadDetour([
    [0, 20],
    [-120, 90],
    [-250, -20],
    [-210, -200],
    [-45, -295],
    [155, -245],
    [275, -60],
    [220, 160],
    [45, 250],
    [0, 20],
  ]));
  const segments = route.slice(1).map((b, i) => [route[i], b]);
  segments.push(
    [
      [-90, 20],
      [90, 20],
    ],
    [
      [HOME_CLINIC_ROAD.x, HOME_CLINIC_ROAD.startZ],
      [HOME_CLINIC_ROAD.x, HOME_CLINIC_ROAD.endZ],
    ],
  );
  for (const [[ax, az], [bx, bz]] of segments) {
    const dx = bx - ax,
      dz = bz - az,
      length = Math.hypot(dx, dz),
      steps = Math.ceil(length * 2);
    for (let i = 0; i <= steps; i++)
      for (const side of [-4.5, -2, 0, 2, 4.5]) {
        const x = ax + (dx * i) / steps - (dz / length) * side,
          z = az + (dz * i) / steps + (dx / length) * side;
        assert.equal(
          sampler.height(x, z),
          0,
          `terrain lifts or covers the road at ${x},${z}`,
        );
      }
  }
  for (let x = -5; x <= 5; x += 0.5)
    for (let z = -5; z <= 10; z += 0.5)
      assert.equal(
        sampler.height(x, z),
        0,
        "opening room and both doors stay at grade",
      );
});
