import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Matrix4, Quaternion, Vector3 } from "three";
import { exportedBounds } from "./lib/scene-geometry.js";

const bytes = readFileSync(new URL("../game-assets/models/cat.glb", import.meta.url));
const jsonLength = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength));
const binaryOffset = 20 + jsonLength + 8;
const dimensions = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function rawAccessor(index) {
  const accessor = gltf.accessors[index];
  const view = gltf.bufferViews[accessor.bufferView];
  assert.equal(accessor.componentType, 5126, "Animation sampler changed from float data");
  const start = binaryOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  assert.equal(view.byteStride ?? 0, 0, "Unexpected interleaved animation sampler");
  return bytes.subarray(start, start + accessor.count * dimensions[accessor.type] * 4).toString("base64");
}

// Captured from the published cat before the anatomical/material pass. These
// cover every keyframe time and transform on every joint, independently of node
// index changes caused by merging the new Blender-authored face details.
const originalClips = {
  Idle: "2c5409f2ad327b87658946b7198b271c5e8f1bcf110b321b7d2d088bdee25b4f",
  Walk: "4cf765ee1cff79772ca58bfc75365ae15f6ae3b723ec8a5f128ce32f8558db59",
  Attack: "567ad7e8c762138fdbd0d451fb369f4f82bc260ff9ec2e2ede05bb8722a1cc55",
  Hit: "2794f6fedba59ac4f5b0f8ededf1ff347055dfbff3f7768747037fc510698223",
  Faint: "dd084b3ed208e1c9f9aa59f3656840a1412c1b1a836a49fc3e08d8b9bcd7eb1e",
};

test("the refined cat preserves four clips and the authored Faint roll", () => {
  assert.deepEqual(gltf.animations.map((a) => a.name).sort(), Object.keys(originalClips).sort());
  for (const animation of gltf.animations) {
    let channels = animation.channels.filter((channel) => channel.target.path !== "weights").map((channel) => {
      const sampler = animation.samplers[channel.sampler];
      return [gltf.nodes[channel.target.node].name, channel.target.path, sampler.interpolation ?? "LINEAR",
        rawAccessor(sampler.input), rawAccessor(sampler.output)];
    }).sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1]));
    assert.equal(channels.length, 21, `${animation.name} lost an authored joint transform`);
    if (animation.name === "Faint") {
      // Changing the root height alters decomposition roundoff in descendant
      // translations by less than 0.00000002m; compare these at micron precision.
      channels = animation.channels.filter((channel) => channel.target.path !== "weights" &&
        !(gltf.nodes[channel.target.node].name === "body" && channel.target.path === "translation")).map((channel) => {
        const sampler = animation.samplers[channel.sampler];
        return [gltf.nodes[channel.target.node].name, channel.target.path, sampler.interpolation ?? "LINEAR",
          Array.from(values(sampler.input), (v) => Math.round(v * 1e6) / 1e6),
          Array.from(values(sampler.output), (v) => Math.round(v * 1e6) / 1e6)];
      }).sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1]));
      assert.equal(createHash("sha256").update(JSON.stringify(channels)).digest("hex"),
        "b205b560030270889d49e0042fc82d3c70ce472d6c3f741ad8a0de235373c6f6",
        "Faint changed beyond its necessary ground-placement repair");
      continue;
    }
    assert.equal(createHash("sha256").update(JSON.stringify(channels)).digest("hex"), originalClips[animation.name],
      `${animation.name} changed while refining the cat's appearance`);
  }
});

const accessorCache = new Map();
function values(index) {
  if (accessorCache.has(index)) return accessorCache.get(index);
  const a = gltf.accessors[index], view = gltf.bufferViews[a.bufferView];
  const size = dimensions[a.type], componentBytes = { 5121: 1, 5123: 2, 5126: 4 }[a.componentType];
  assert.ok(componentBytes);
  const stride = view?.byteStride ?? size * componentBytes;
  const start = binaryOffset + (view?.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const out = new Float64Array(a.count * size);
  if (view) for (let i = 0; i < a.count; i++) for (let j = 0; j < size; j++) {
    const offset = start + i * stride + j * componentBytes;
    out[i * size + j] = a.componentType === 5126 ? bytes.readFloatLE(offset) :
      a.componentType === 5123 ? bytes.readUInt16LE(offset) : bytes.readUInt8(offset);
  }
  if (a.sparse) {
    const s = a.sparse, iv = gltf.bufferViews[s.indices.bufferView], vv = gltf.bufferViews[s.values.bufferView];
    const indexBytes = { 5121: 1, 5123: 2, 5125: 4 }[s.indices.componentType];
    const io = binaryOffset + (iv.byteOffset ?? 0) + (s.indices.byteOffset ?? 0);
    const vo = binaryOffset + (vv.byteOffset ?? 0) + (s.values.byteOffset ?? 0);
    assert.equal(a.componentType, 5126);
    for (let i = 0; i < s.count; i++) {
      const index = indexBytes === 4 ? bytes.readUInt32LE(io + i * 4) : indexBytes === 2 ? bytes.readUInt16LE(io + i * 2) : bytes.readUInt8(io + i);
      for (let j = 0; j < size; j++) out[index * size + j] = bytes.readFloatLE(vo + (i * size + j) * 4);
    }
  }
  accessorCache.set(index, out);
  return out;
}

test("the exported Faint animation rolls the complete cat onto the floor", () => {
  const faint = gltf.animations.find((a) => a.name === "Faint");
  const duration = Math.max(...faint.samplers.map((s) => values(s.input).at(-1)));
  const parents = new Map();
  gltf.nodes.forEach((node, index) => node.children?.forEach((child) => parents.set(child, index)));
  const inverseBinds = values(gltf.skins[0].inverseBindMatrices);
  const poses = [];
  for (let sample = 0; sample <= 156; sample++) {
    const time = duration * sample / 156;
    const transforms = gltf.nodes.map((node) => ({
      position: [...(node.translation ?? [0, 0, 0])], rotation: [...(node.rotation ?? [0, 0, 0, 1])],
      scale: [...(node.scale ?? [1, 1, 1])], weights: [...(node.weights ?? gltf.meshes[node.mesh]?.weights ?? [0])],
    }));
    for (const channel of faint.channels) {
      const sampler = faint.samplers[channel.sampler], inputs = values(sampler.input), outputs = values(sampler.output);
      assert.ok(["LINEAR", "STEP"].includes(sampler.interpolation ?? "LINEAR"));
      let lo = 0;
      while (lo + 1 < inputs.length && inputs[lo + 1] <= time) lo++;
      const hi = Math.min(lo + 1, inputs.length - 1), alpha = hi === lo || sampler.interpolation === "STEP" ? 0 :
        Math.max(0, Math.min(1, (time - inputs[lo]) / (inputs[hi] - inputs[lo])));
      const path = channel.target.path, size = path === "rotation" ? 4 : path === "weights" ? outputs.length / inputs.length : 3;
      const target = transforms[channel.target.node];
      if (path === "rotation") target.rotation = new Quaternion().fromArray(outputs, lo * 4)
        .slerp(new Quaternion().fromArray(outputs, hi * 4), alpha).toArray();
      else target[path === "translation" ? "position" : path] = Array.from({ length: size }, (_, j) =>
        outputs[lo * size + j] * (1 - alpha) + outputs[hi * size + j] * alpha);
    }
    const worlds = [];
    const world = (i) => {
      if (worlds[i]) return worlds[i];
      const t = transforms[i], local = gltf.nodes[i].matrix ? new Matrix4().fromArray(gltf.nodes[i].matrix) :
        new Matrix4().compose(new Vector3().fromArray(t.position), new Quaternion().fromArray(t.rotation), new Vector3().fromArray(t.scale));
      if (parents.has(i)) local.premultiply(world(parents.get(i)));
      return worlds[i] = local;
    };
    const joints = gltf.skins[0].joints.map((node, index) => world(node).clone()
      .multiply(new Matrix4().fromArray(inverseBinds, index * 16)).elements);
    let lowest = Infinity, lowPoint;
    gltf.nodes.forEach((node, nodeIndex) => {
      if (node.mesh === undefined) return;
      for (const primitive of gltf.meshes[node.mesh].primitives) {
        const positions = values(primitive.attributes.POSITION);
        const weights = primitive.attributes.WEIGHTS_0 === undefined ? null : values(primitive.attributes.WEIGHTS_0);
        const indices = weights ? values(primitive.attributes.JOINTS_0) : null;
        const morphs = (primitive.targets ?? []).map((target) => target.POSITION === undefined ? null : values(target.POSITION));
        const matrix = world(nodeIndex).elements;
        for (let i = 0; i < positions.length / 3; i++) {
          let x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
          morphs.forEach((morph, m) => {
            if (!morph) return;
            const weight = transforms[nodeIndex].weights[m] ?? 0;
            x += morph[i * 3] * weight; y += morph[i * 3 + 1] * weight; z += morph[i * 3 + 2] * weight;
          });
          let height = 0;
          if (weights) for (let j = 0; j < 4; j++) {
            const transform = joints[indices[i * 4 + j]];
            height += weights[i * 4 + j] * (transform[1] * x + transform[5] * y + transform[9] * z + transform[13]);
          } else height = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
          if (height < lowest) { lowest = height; lowPoint = { node: node.name, vertex: i, point: [x, y, z], indices: indices ? [...indices.slice(i*4,i*4+4)] : null, matrix: indices ? joints[indices[i*4]] : null }; }
        }
      }
    });
    assert.ok(lowest > -.001, `Faint sinks ${(-lowest).toFixed(4)}m below the floor at ${time.toFixed(3)}s ${JSON.stringify(lowPoint)}`);
    poses.push(lowest);
  }
  assert.ok(poses.at(-1) < .003, "The final resting cat floats above the floor");
  const body = gltf.nodes.findIndex((node) => node.name === "body");
  const movement = faint.channels.find((channel) => channel.target.node === body && channel.target.path === "translation");
  const translation = values(faint.samplers[movement.sampler].output);
  assert.ok(translation.at(-2) > .06, "The old downward Faint translation returned");
});

test("the feline surface remains skinned and grounded at the existing adult-cat scale", () => {
  assert.equal(gltf.skins.length, 1);
  const bones = gltf.skins[0].joints.map((index) => gltf.nodes[index].name);
  assert.deepEqual(bones.slice().sort(), ["body", "frontL", "frontR", "head", "rearL", "rearR", "tail"].sort());
  const skinNode = gltf.nodes.find((node) => node.name === "Continuous anatomical skin");
  assert.equal(skinNode.skin, 0);
  for (const primitive of gltf.meshes[skinNode.mesh].primitives) {
    assert.ok(primitive.attributes.JOINTS_0 !== undefined && primitive.attributes.WEIGHTS_0 !== undefined);
    const accessor = gltf.accessors[primitive.attributes.WEIGHTS_0];
    const view = gltf.bufferViews[accessor.bufferView];
    const start = binaryOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const stride = view.byteStride ?? 16;
    assert.equal(accessor.componentType, 5126);
    for (let i = 0; i < accessor.count; i++) {
      const values = [0, 1, 2, 3].map((j) => bytes.readFloatLE(start + i * stride + j * 4));
      assert.ok(values.every((value) => value >= 0 && value <= 1), `Invalid skin influence at vertex ${i}`);
      assert.ok(Math.abs(values.reduce((a, b) => a + b, 0) - 1) < .00002, `Unweighted cat vertex ${i}`);
    }
  }
  const box = exportedBounds({ cat: { model: "models/cat.glb" } }, "cat");
  assert.ok(Math.abs(box.min.y - .0004793196) < .00015, "The paws no longer contact the same ground datum");
  assert.ok(box.max.y > .412 && box.max.y < .425, "Adult cat height changed materially");
  assert.ok(box.max.z > .36 && box.max.z < .39 && box.min.z > -.51 && box.min.z < -.475,
    "The face/tail orientation or gameplay envelope changed");
  const faceIndex = gltf.nodes.findIndex((node) => node.name === "Feline face · eyes nose ears whiskers");
  const head = gltf.nodes.find((node) => node.name === "head");
  assert.ok(head.children.includes(faceIndex), "The new facial details no longer move with the original head bone");
});

test("the cat exports a compact set of packed PBR fur and iris materials", () => {
  const primitives = gltf.meshes.flatMap((mesh) => mesh.primitives);
  assert.ok(primitives.length <= 5, "Face refinement unexpectedly increases draw calls");
  const fur = gltf.materials.find((material) => material.name === "Cat · short mackerel-tabby fur");
  assert.ok(fur.pbrMetallicRoughness.baseColorTexture);
  assert.ok(fur.pbrMetallicRoughness.metallicRoughnessTexture);
  assert.ok(fur.normalTexture);
  assert.ok(gltf.images.length >= 4 && gltf.images.every((image) => image.bufferView !== undefined && !image.uri),
    "A generated feline texture was left outside the self-contained asset");
});
