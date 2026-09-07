// Exact encoded-image hashes from tracked GLBs. No image decoding or browser.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

const root = new URL("../", import.meta.url);
export const hashBytes = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");
function dimensions(bytes, mime) {
  if (mime === "image/png")
    return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  if (mime !== "image/webp" || bytes.toString("ascii", 0, 4) !== "RIFF")
    return null;
  for (let offset = 12; offset + 8 < bytes.length;) {
    const kind = bytes.toString("ascii", offset, offset + 4),
      length = bytes.readUInt32LE(offset + 4),
      data = offset + 8;
    if (kind === "VP8X")
      return [
        1 + bytes.readUIntLE(data + 4, 3),
        1 + bytes.readUIntLE(data + 7, 3),
      ];
    if (kind === "VP8L") {
      const packed = bytes.readUInt32LE(data + 1);
      return [(packed & 0x3fff) + 1, ((packed >>> 14) & 0x3fff) + 1];
    }
    if (kind === "VP8 ")
      return [
        bytes.readUInt16LE(data + 6) & 0x3fff,
        bytes.readUInt16LE(data + 8) & 0x3fff,
      ];
    offset = data + length + (length % 2);
  }
  return null;
}
function rgbaMipBytes(width, height) {
  let total = 0;
  for (;;) {
    total += width * height * 4;
    if (width === 1 && height === 1) return total;
    width = Math.max(1, Math.floor(width / 2));
    height = Math.max(1, Math.floor(height / 2));
  }
}
export function auditAssetTextures(catalog) {
  const groups = new Map(),
    assets = {},
    gpuBefore = new Map(),
    gpuAfter = new Map();
  let payloads = 0,
    totalBytes = 0,
    totalRgbaBytes = 0,
    totalMipBytes = 0;
  for (const [name, entry] of Object.entries(catalog)) {
    const bytes = readFileSync(new URL(`game-assets/${entry.model}`, root));
    const jsonSize = bytes.readUInt32LE(12),
      json = JSON.parse(bytes.toString("utf8", 20, 20 + jsonSize)),
      binaryStart = 28 + jsonSize;
    const images = {};
    for (const [index, image] of (json.images ?? []).entries()) {
      if (image.bufferView === undefined) continue;
      const view = json.bufferViews[image.bufferView];
      const data = bytes.subarray(
        binaryStart + (view.byteOffset ?? 0),
        binaryStart + (view.byteOffset ?? 0) + view.byteLength,
      );
      const sha256 = hashBytes(data),
        size = dimensions(data, image.mimeType);
      const metadata = {
        sha256,
        bytes: data.length,
        mimeType: image.mimeType,
        width: size?.[0] ?? null,
        height: size?.[1] ?? null,
      };
      images[index] = metadata;
      if (!groups.has(sha256)) groups.set(sha256, { ...metadata, uses: [] });
      groups.get(sha256).uses.push({ asset: name, image: index });
      payloads++;
      totalBytes += data.length;
      if (size) {
        totalRgbaBytes += size[0] * size[1] * 4;
        totalMipBytes += rgbaMipBytes(...size);
      }
    }
    assets[name] = {
      model: entry.model,
      modelSha256: hashBytes(bytes),
      images,
    };
    // Refine the storage estimate using actual material roles and GLTF
    // samplers. Main applies maximum anisotropy to base-colour maps only;
    // treating that separately is conservative on devices whose maximum is 1.
    const colorMaps = new Set([
      "baseColorTexture",
      "emissiveTexture",
      "sheenColorTexture",
      "specularColorTexture",
    ]);
    function visit(value) {
      if (!value || typeof value !== "object") return;
      for (const [key, child] of Object.entries(value)) {
        if (key.endsWith("Texture") && Number.isInteger(child?.index)) {
          const definition = json.textures[child.index],
            imageIndex =
              definition.extensions?.EXT_texture_webp?.source ??
              definition.source,
            image = images[imageIndex];
          if (!image?.width) continue;
          const sampler = json.samplers?.[definition.sampler] ?? {};
          const minFilter = sampler.minFilter ?? 9987;
          const properties = [
            sampler.wrapS ?? 10497,
            sampler.wrapT ?? 10497,
            sampler.magFilter ?? 9729,
            minFilter,
            colorMaps.has(key) ? "srgb" : "linear-data",
            key === "baseColorTexture"
              ? "max-anisotropy"
              : "default-anisotropy",
          ];
          const identity = `${image.sha256}:${JSON.stringify(properties)}`;
          const size = [9728, 9729].includes(minFilter)
            ? image.width * image.height * 4
            : rgbaMipBytes(image.width, image.height);
          gpuBefore.set(`${name}:${imageIndex}:${identity}`, size);
          gpuAfter.set(identity, size);
        } else visit(child);
      }
    }
    visit(json.materials);
  }
  for (const entry of Object.values(assets))
    for (const image of Object.values(entry.images))
      image.duplicate = groups.get(image.sha256).uses.length > 1;
  const unique = [...groups.values()];
  const uniqueBytes = unique.reduce((sum, group) => sum + group.bytes, 0);
  const uniqueRgbaBytes = unique.reduce(
    (sum, group) => sum + (group.width ? group.width * group.height * 4 : 0),
    0,
  );
  const uniqueMipBytes = unique.reduce(
    (sum, group) =>
      sum + (group.width ? rgbaMipBytes(group.width, group.height) : 0),
    0,
  );
  return {
    manifest: { version: 1, algorithm: "SHA-256", assets },
    report: {
      models: Object.keys(catalog).length,
      payloads,
      uniqueImages: groups.size,
      totalBytes,
      uniqueBytes,
      repeatedPayloadBytes: totalBytes - uniqueBytes,
      totalRgbaBytes,
      uniqueRgbaBytes,
      duplicateRgbaBytes: totalRgbaBytes - uniqueRgbaBytes,
      totalMipBytes,
      uniqueMipBytes,
      duplicateMipBytes: totalMipBytes - uniqueMipBytes,
      materialGpuVariantsBefore: gpuBefore.size,
      materialGpuVariantsAfter: gpuAfter.size,
      materialGpuBytesBefore: [...gpuBefore.values()].reduce(
        (sum, size) => sum + size,
        0,
      ),
      materialGpuBytesAfter: [...gpuAfter.values()].reduce(
        (sum, size) => sum + size,
        0,
      ),
      estimateLimit:
        "RGBA8 image and full-mipmap storage estimates, not measured GPU allocation. Differing samplers/color spaces may require separate GPU textures. Post-load Source sharing does not avoid original downloads or decodes.",
      duplicateGroups: unique
        .filter((group) => group.uses.length > 1)
        .sort(
          (a, b) =>
            (b.uses.length - 1) * b.bytes - (a.uses.length - 1) * a.bytes,
        ),
    },
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const catalog = JSON.parse(
    readFileSync(new URL("game-assets/asset-catalog.json", root)),
  );
  const { manifest, report } = auditAssetTextures(catalog);
  if (process.argv.includes("--write"))
    writeFileSync(
      new URL("game-assets/texture-hashes.json", root),
      JSON.stringify(manifest, null, 2) + "\n",
    );
  writeFileSync(
    new URL("artifacts/texture-duplicate-audit.json", root),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify(
      { ...report, duplicateGroups: report.duplicateGroups.length },
      null,
      2,
    ),
  );
}
