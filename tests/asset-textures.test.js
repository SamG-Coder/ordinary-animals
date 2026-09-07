import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  Group,
  Mesh,
  MeshStandardMaterial,
  Texture,
  RepeatWrapping,
  ClampToEdgeWrapping,
  SRGBColorSpace,
  NoColorSpace,
} from "three";
import {
  createAssetTexturePool,
  createTextureUploadQueue,
  gltfTextures,
} from "../src/asset-textures.js";
import { auditAssetTextures } from "../scripts/audit-asset-textures.mjs";

const bytes = new TextEncoder().encode("the same immutable image payload");
const metadata = {
  sha256: createHash("sha256").update(bytes).digest("hex"),
  bytes: bytes.byteLength,
  width: 8,
  height: 8,
  mimeType: "image/webp",
  duplicate: true,
};
const manifest = {
  assets: {
    first: { images: { 0: metadata } },
    second: { images: { 0: metadata } },
  },
};
function fixture(data = bytes, options = {}) {
  const texture = new Texture({ width: 8, height: 8 });
  texture.flipY = false;
  texture.needsUpdate = true;
  Object.assign(texture, options);
  const material = new MeshStandardMaterial({ map: texture });
  const scene = new Group();
  scene.add(new Mesh(undefined, material));
  const gltf = {
    scene,
    scenes: [scene],
    parser: {
      associations: new Map([[texture, { textures: 0 }]]),
      json: {
        textures: [{ extensions: { EXT_texture_webp: { source: 0 } } }],
        images: [{ mimeType: "image/webp", bufferView: 0 }],
      },
      getDependency: async (kind, index) => {
        assert.equal(kind, "bufferView");
        assert.equal(index, 0);
        return data;
      },
    },
  };
  return { gltf, texture, material, scene };
}
const snapshot = (texture) => ({
  wrapS: texture.wrapS,
  wrapT: texture.wrapT,
  magFilter: texture.magFilter,
  minFilter: texture.minFilter,
  anisotropy: texture.anisotropy,
  colorSpace: texture.colorSpace,
  channel: texture.channel,
  offset: texture.offset.toArray(),
  repeat: texture.repeat.toArray(),
  center: texture.center.toArray(),
  rotation: texture.rotation,
  matrixAutoUpdate: texture.matrixAutoUpdate,
  matrix: texture.matrix.toArray(),
  flipY: texture.flipY,
  premultiplyAlpha: texture.premultiplyAlpha,
  generateMipmaps: texture.generateMipmaps,
  format: texture.format,
  internalFormat: texture.internalFormat,
  type: texture.type,
  unpackAlignment: texture.unpackAlignment,
  version: texture.version,
  name: texture.name,
});

test("byte-identical images share only Source while texture identity, sampler, color space and UV transforms remain independent", async () => {
  const a = fixture(bytes, {
    colorSpace: SRGBColorSpace,
    wrapS: RepeatWrapping,
  });
  const b = fixture(bytes, {
    colorSpace: NoColorSpace,
    wrapS: ClampToEdgeWrapping,
    anisotropy: 8,
    channel: 1,
  });
  b.texture.offset.set(0.2, 0.3);
  b.texture.repeat.set(2, 3);
  b.texture.center.set(0.5, 0.5);
  b.texture.rotation = 0.4;
  b.texture.updateMatrix();
  const before = snapshot(b.texture),
    originalTexture = b.texture,
    pool = createAssetTexturePool(manifest);
  await pool.share("first", a.gltf);
  await pool.share("second", b.gltf);
  assert.equal(b.texture.source, a.texture.source);
  assert.equal(b.material.map, originalTexture);
  assert.notEqual(a.material.map, b.material.map);
  assert.deepEqual(snapshot(b.texture), before);
  b.texture.offset.x = 0.9;
  assert.equal(
    a.texture.offset.x,
    0,
    "Later UV adjustment must not modify the other asset",
  );
  assert.equal(pool.stats.sharedSources, 1);
  assert.equal(pool.stats.reboundTextures, 1);
});

test("GLTF UV-channel clones without their own parser association are found through their original Source", async () => {
  const a = fixture(),
    b = fixture();
  const clone = b.texture.clone();
  clone.channel = 2;
  clone.matrixAutoUpdate = false;
  clone.matrix.elements[6] = 0.7;
  b.material.normalMap = clone;
  const before = snapshot(clone),
    pool = createAssetTexturePool(manifest);
  await Promise.all([
    pool.share("first", a.gltf),
    pool.share("second", b.gltf),
  ]);
  assert.equal(clone.source, b.texture.source);
  assert.equal(clone.source, a.texture.source);
  assert.deepEqual(snapshot(clone), before);
  assert.equal(gltfTextures(b.gltf).length, 2);
});

test("a stale manifest or mismatched decoded dimensions never replaces an asset image", async () => {
  const a = fixture(),
    changed = fixture(new TextEncoder().encode("changed encoded pixels"));
  const pool = createAssetTexturePool(manifest),
    original = changed.texture.source;
  await pool.share("first", a.gltf);
  await pool.share("second", changed.gltf);
  assert.equal(changed.texture.source, original);
  assert.equal(pool.stats.staleImages, 1);
  const sameLength = bytes.slice();
  sameLength[0] ^= 1;
  const changedSameLength = fixture(sameLength),
    originalSameLength = changedSameLength.texture.source;
  await pool.share("second", changedSameLength.gltf);
  assert.equal(changedSameLength.texture.source, originalSameLength);
  assert.equal(pool.stats.staleImages, 2);
  const wrongSize = fixture();
  wrongSize.texture.image.width = 16;
  await pool.share("second", wrongSize.gltf);
  assert.notEqual(wrongSize.texture.source, a.texture.source);
  assert.equal(pool.stats.skippedImages, 1);
  const unavailable = createAssetTexturePool(manifest, {
    digest: async () => {
      throw new Error("Hashing unavailable");
    },
  });
  const untouched = fixture(),
    originalSource = untouched.texture.source;
  await unavailable.share("first", untouched.gltf);
  assert.equal(untouched.texture.source, originalSource);
  assert.equal(unavailable.stats.skippedImages, 1);
});

test("repeated pool processing is idempotent and dynamic/data/canvas textures are untouched", async () => {
  const a = fixture(),
    b = fixture(),
    pool = createAssetTexturePool(manifest);
  await pool.share("first", a.gltf);
  await pool.share("second", b.gltf);
  const stats = { ...pool.stats };
  await pool.share("second", b.gltf);
  assert.deepEqual(pool.stats, stats);
  for (const key of [
    "isVideoTexture",
    "isDataTexture",
    "isCompressedTexture",
    "isRenderTargetTexture",
  ]) {
    const other = fixture(bytes, { [key]: true }),
      source = other.texture.source;
    await pool.share("second", other.gltf);
    assert.equal(other.texture.source, source);
  }
  const canvas = fixture();
  canvas.texture.image.getContext = () => {};
  const source = canvas.texture.source;
  await pool.share("second", canvas.gltf);
  assert.equal(canvas.texture.source, source);
});

test("preupload queue respects per-step count/time budgets and does not upload a texture twice", () => {
  const a = fixture(),
    b = fixture(),
    c = fixture();
  let time = 0;
  const uploads = [];
  const queue = createTextureUploadQueue(
    {
      initTexture(texture) {
        uploads.push(texture);
        time += 4;
      },
    },
    { now: () => time },
  );
  queue.add(a.gltf);
  queue.add(a.gltf);
  queue.add(b.gltf);
  queue.add(c.gltf);
  assert.equal(queue.remaining, 3);
  assert.deepEqual(queue.step({ budgetMs: 3, maxTextures: 2 }), {
    uploaded: 1,
    total: 3,
    remaining: 2,
    done: false,
  });
  assert.equal(queue.step({ budgetMs: 100, maxTextures: 1 }).uploaded, 1);
  assert.equal(queue.step().done, true);
  assert.equal(queue.step().uploaded, 0);
  assert.deepEqual(uploads, [a.texture, b.texture, c.texture]);
});

test("the checked-in manifest matches every current catalog GLB byte hash", () => {
  const root = new URL("../", import.meta.url);
  const catalog = JSON.parse(
    readFileSync(new URL("game-assets/asset-catalog.json", root)),
  );
  const stored = JSON.parse(
    readFileSync(new URL("game-assets/texture-hashes.json", root)),
  );
  const current = auditAssetTextures(catalog);
  assert.deepEqual(
    stored,
    current.manifest,
    "Re-run node scripts/audit-asset-textures.mjs --write after exporting assets",
  );
  assert.ok(current.report.duplicateMipBytes > 0);
});
