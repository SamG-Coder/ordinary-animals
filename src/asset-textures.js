// Loaded GLTF image Sources are immutable. Keep Texture objects independent:
// Three r185 WebGLTextures caches GPU storage by Source + sampler/upload/color
// settings, while UV channel and transforms remain on each original Texture.
// Call Source sharing BEFORE any renderer.initTexture/render of these assets.

export function gltfTextures(gltf) {
  const found = new Set();
  for (const [object] of gltf.parser?.associations ?? [])
    if (object?.isTexture) found.add(object);
  for (const scene of gltf.scenes ?? [gltf.scene])
    scene?.traverse((object) => {
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material]) {
        if (!material) continue;
        for (const value of Object.values(material))
          if (value?.isTexture) found.add(value);
      }
    });
  return [...found];
}
function ordinaryImage(texture) {
  return (
    texture.isTexture &&
    !texture.isDataTexture &&
    !texture.isCompressedTexture &&
    !texture.isCubeTexture &&
    !texture.isVideoTexture &&
    !texture.isDepthTexture &&
    !texture.isRenderTargetTexture &&
    !texture.isExternalTexture &&
    !texture.isFramebufferTexture &&
    !texture.isDataArrayTexture &&
    !texture.isData3DTexture &&
    !texture.mipmaps?.length &&
    texture.image &&
    !texture.image.getContext &&
    Number.isFinite(texture.image.width) &&
    Number.isFinite(texture.image.height)
  );
}
async function sha256(bytes) {
  const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}

export function createAssetTexturePool(manifest, { digest = sha256 } = {}) {
  const sources = new Map(),
    processed = new WeakSet();
  const stats = {
    verifiedImages: 0,
    sharedSources: 0,
    reboundTextures: 0,
    staleImages: 0,
    skippedImages: 0,
  };
  return {
    stats,
    async share(assetName, gltf) {
      if (processed.has(gltf)) return { ...stats };
      const entry = manifest?.assets?.[assetName],
        parser = gltf.parser;
      if (!entry || !parser?.getDependency || !parser.associations)
        return { ...stats };
      const descriptors = new Map(),
        verification = new Map();
      for (const [texture, reference] of parser.associations) {
        if (!ordinaryImage(texture)) continue;
        const definition = parser.json.textures?.[reference?.textures];
        const imageIndex =
          definition?.extensions?.EXT_texture_webp?.source ??
          definition?.source;
        const image = parser.json.images?.[imageIndex],
          expected = entry.images?.[imageIndex];
        if (
          !expected?.duplicate ||
          !["image/png", "image/webp", "image/jpeg"].includes(
            image?.mimeType,
          ) ||
          image.bufferView === undefined
        )
          continue;
        if (!verification.has(imageIndex))
          verification.set(
            imageIndex,
            (async () => {
              const bytes = await parser.getDependency(
                "bufferView",
                image.bufferView,
              );
              // A stale build manifest must never assign a different image. Verify
              // the actual embedded bytes already held by this GLTF parser.
              if (
                bytes.byteLength !== expected.bytes ||
                (await digest(bytes)) !== expected.sha256
              ) {
                stats.staleImages++;
                return null;
              }
              stats.verifiedImages++;
              return expected;
            })().catch(() => {
              // Sharing is optional: unsupported hashing or a verification
              // failure must leave the original image available for loading.
              stats.skippedImages++;
              return null;
            }),
          );
        const metadata = await verification.get(imageIndex);
        if (!metadata) continue;
        if (
          texture.image.width !== metadata.width ||
          texture.image.height !== metadata.height
        ) {
          stats.skippedImages++;
          continue;
        }
        // Keep ImageBitmap and HTML-image decode paths separate. The standard
        // GLTFLoader uses one consistent set of bitmap creation options.
        const imageKind = texture.image.constructor?.name ?? "Image";
        descriptors.set(
          texture.source,
          `${metadata.sha256}:${metadata.mimeType}:${metadata.width}x${metadata.height}:${imageKind}`,
        );
      }
      const bindings = gltfTextures(gltf)
        .filter(ordinaryImage)
        .map((texture) => ({
          texture,
          original: texture.source,
          key: descriptors.get(texture.source),
        }));
      const rebound = new Set();
      for (const { texture, original, key } of bindings) {
        if (!key) continue;
        if (!sources.has(key)) sources.set(key, original);
        const source = sources.get(key);
        if (source === original) continue;
        texture.source = source;
        stats.reboundTextures++;
        rebound.add(original);
      }
      stats.sharedSources += rebound.size;
      processed.add(gltf);
      return { ...stats };
    },
  };
}

// Upload small batches while the loading screen is visible, after final texture
// settings (e.g. anisotropy) are applied. A single upload cannot be interrupted;
// the budget prevents starting another after time is spent, not a hard GPU cap.
export function createTextureUploadQueue(
  renderer,
  { now = () => performance.now() } = {},
) {
  const queue = [],
    seen = new WeakSet();
  let cursor = 0;
  return {
    add(gltf) {
      for (const texture of gltfTextures(gltf)) {
        if (!ordinaryImage(texture) || seen.has(texture)) continue;
        seen.add(texture);
        queue.push(texture);
      }
      return queue.length - cursor;
    },
    step({ budgetMs = 3, maxTextures = 2 } = {}) {
      const start = now();
      let uploaded = 0;
      while (
        cursor < queue.length &&
        uploaded < maxTextures &&
        (uploaded === 0 || now() - start < budgetMs)
      ) {
        renderer.initTexture(queue[cursor]);
        cursor++;
        uploaded++;
      }
      return {
        uploaded,
        total: queue.length,
        remaining: queue.length - cursor,
        done: cursor === queue.length,
      };
    },
    get remaining() {
      return queue.length - cursor;
    },
  };
}
