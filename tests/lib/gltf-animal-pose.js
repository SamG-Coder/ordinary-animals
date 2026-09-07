// Read exported Blender animation data directly; no browser, renderer or input.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Matrix4, Quaternion, Vector3 } from 'three';

const sizes = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const componentBytes = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function readAnimalModel(path) {
  const bytes = readFileSync(path), jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength));
  const binaryOffset = 28 + jsonLength;
  const cache = new Map();
  function accessorBytes(index) {
    const a = gltf.accessors[index], view = gltf.bufferViews[a.bufferView];
    const size = sizes[a.type] * componentBytes[a.componentType];
    const start = binaryOffset + (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const result = Buffer.alloc(a.count * size), stride = view.byteStride ?? size;
    for (let i = 0; i < a.count; i++) bytes.copy(result, i * size, start + i * stride, start + i * stride + size);
    return result;
  }
  function values(index) {
    if (cache.has(index)) return cache.get(index);
    const a = gltf.accessors[index], bytes = accessorBytes(index), width = componentBytes[a.componentType];
    const readers = { 5120: 'readInt8', 5121: 'readUInt8', 5122: 'readInt16LE', 5123: 'readUInt16LE', 5125: 'readUInt32LE', 5126: 'readFloatLE' };
    const result = new Float64Array(a.count * sizes[a.type]);
    for (let i = 0; i < result.length; i++) {
      let value = bytes[readers[a.componentType]](i * width);
      if (a.normalized) value = a.componentType === 5121 ? value / 255 : a.componentType === 5123 ? value / 65535 : value;
      result[i] = value;
    }
    cache.set(index, result);
    return result;
  }
  return { bytes, gltf, binaryOffset, accessorBytes, values };
}

export function clipFingerprint(model, name, omitGroundContact = false) {
  const { gltf, accessorBytes } = model;
  const animation = gltf.animations.find((a) => a.name === name);
  assert.ok(animation, `Missing ${name} animation`);
  const channels = animation.channels.filter((channel) => !(omitGroundContact && gltf.nodes[channel.target.node].name.startsWith('Whisker') && channel.target.path === 'scale')).map((channel) => {
    const sampler = animation.samplers[channel.sampler], node = gltf.nodes[channel.target.node].name;
    const output = accessorBytes(sampler.output);
    if (omitGroundContact && node === 'body' && channel.target.path === 'translation') {
      assert.equal(gltf.accessors[sampler.output].componentType, 5126);
      for (let i = 4; i < output.length; i += 12) output.writeFloatLE(0, i);
    }
    // Re-exporting a changed parent translation can perturb a child's derived
    // local translation by a few float32 ulps. Preserve Faint's other channels
    // to micrometre precision; the four untouched clips retain exact bytes.
    const outputRecord = omitGroundContact ? Array.from({ length: output.length / 4 }, (_, i) => Math.round(output.readFloatLE(i * 4) * 1e6) / 1e6) : output.toString('base64');
    return [node, channel.target.path, sampler.interpolation ?? 'LINEAR', accessorBytes(sampler.input).toString('base64'), outputRecord];
  }).sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1]));
  return digest(channels);
}

export function modelFingerprint(model) {
  const { gltf, accessorBytes, bytes, binaryOffset } = model;
  const accessor = (index) => ({ type: gltf.accessors[index].type, componentType: gltf.accessors[index].componentType,
    normalized: gltf.accessors[index].normalized ?? false, data: accessorBytes(index).toString('base64') });
  return {
    geometry: digest(gltf.meshes.map((mesh) => [mesh.name, mesh.primitives.map((p) => ({
      attributes: Object.fromEntries(Object.entries(p.attributes).sort(([a], [b]) => a.localeCompare(b)).map(([name, index]) => [name, accessor(index)])),
      indices: p.indices === undefined ? null : accessor(p.indices), mode: p.mode ?? 4,
      material: gltf.materials[p.material]?.name,
    }))])),
    materials: digest(gltf.materials),
    images: digest(gltf.images.map((image) => {
      const view = gltf.bufferViews[image.bufferView], start = binaryOffset + (view.byteOffset ?? 0);
      return [image.mimeType, createHash('sha256').update(bytes.subarray(start, start + view.byteLength)).digest('hex')];
    })),
    rig: digest(gltf.skins.map((skin) => [skin.joints.map((i) => gltf.nodes[i].name), accessor(skin.inverseBindMatrices)])),
  };
}

export function animationDuration(model, name) {
  return Math.max(...model.gltf.animations.find((a) => a.name === name).samplers.map((sampler) => model.values(sampler.input).at(-1)));
}

export function poseHeightRange(model, name, time) {
  const { gltf, values } = model;
  const animation = gltf.animations.find((a) => a.name === name);
  const transforms = gltf.nodes.map((node) => ({ position: [...(node.translation ?? [0, 0, 0])],
    rotation: [...(node.rotation ?? [0, 0, 0, 1])], scale: [...(node.scale ?? [1, 1, 1])] }));
  for (const channel of animation.channels) {
    const sampler = animation.samplers[channel.sampler], times = values(sampler.input), data = values(sampler.output);
    const interpolation = sampler.interpolation ?? 'LINEAR';
    assert.ok(interpolation === 'LINEAR' || interpolation === 'STEP');
    let lo = 0;
    while (lo + 1 < times.length && times[lo + 1] <= time) lo++;
    const hi = Math.min(lo + 1, times.length - 1), alpha = hi === lo || interpolation === 'STEP' ? 0 : Math.max(0, (time - times[lo]) / (times[hi] - times[lo]));
    const path = channel.target.path, target = transforms[channel.target.node];
    if (path === 'rotation') target.rotation = new Quaternion().fromArray(data, lo * 4).slerp(new Quaternion().fromArray(data, hi * 4), alpha).toArray();
    else {
      assert.ok(path === 'translation' || path === 'scale');
      target[path === 'translation' ? 'position' : path] = Array.from({ length: 3 }, (_, j) => data[lo * 3 + j] * (1 - alpha) + data[hi * 3 + j] * alpha);
    }
  }
  const parents = new Map();
  gltf.nodes.forEach((node, i) => node.children?.forEach((child) => parents.set(child, i)));
  const worlds = [];
  const world = (i) => {
    if (worlds[i]) return worlds[i];
    const t = transforms[i], local = gltf.nodes[i].matrix ? new Matrix4().fromArray(gltf.nodes[i].matrix) :
      new Matrix4().compose(new Vector3().fromArray(t.position), new Quaternion().fromArray(t.rotation), new Vector3().fromArray(t.scale));
    if (parents.has(i)) local.premultiply(world(parents.get(i)));
    return worlds[i] = local;
  };
  const skins = gltf.skins.map((skin) => skin.joints.map((node, i) => world(node).clone().multiply(new Matrix4().fromArray(values(skin.inverseBindMatrices), i * 16)).elements));
  let minY = Infinity, maxY = -Infinity, skinMinY = Infinity;
  gltf.nodes.forEach((node, index) => {
    if (node.mesh === undefined) return;
    const matrix = world(index).elements;
    for (const primitive of gltf.meshes[node.mesh].primitives) {
      const positions = values(primitive.attributes.POSITION);
      const weights = primitive.attributes.WEIGHTS_0 === undefined ? null : values(primitive.attributes.WEIGHTS_0);
      const indices = weights ? values(primitive.attributes.JOINTS_0) : null;
      for (let i = 0; i < positions.length / 3; i++) {
        const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
        let height = 0;
        if (weights) for (let j = 0; j < 4; j++) {
          const m = skins[node.skin][indices[i * 4 + j]];
          height += weights[i * 4 + j] * (m[1] * x + m[5] * y + m[9] * z + m[13]);
        } else height = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
        minY = Math.min(minY, height); maxY = Math.max(maxY, height);
        if (node.skin !== undefined) skinMinY = Math.min(skinMinY, height);
      }
    }
  });
  return { minY, maxY, skinMinY };
}
