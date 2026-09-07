// Landscape pieces remain individual Blender assets. Their exported vertex samples
// provide the same triangular walking surface that the browser renders.
export const TERRAIN_PLACEMENTS = [
  { asset: "road-bank-24m", x: -270, z: -85, rotation: 0, scale: 1 },
  { asset: "road-bank-24m", x: -200, z: -122, rotation: 0, scale: 1 },
  { asset: "meadow-rise-40m", x: -273, z: -120, rotation: 0, scale: 1 },
  { asset: "meadow-rise-40m", x: -190, z: -112, rotation: 0, scale: 1 },
  { asset: "moor-ridge-80m", x: -329, z: -123, rotation: 0.18, scale: 1.2 },
  { asset: "moor-ridge-80m", x: -132, z: -100, rotation: -0.15, scale: 1 },
  { asset: "meadow-rise-40m", x: -199, z: 82, rotation: 0, scale: 1 },
  { asset: "moor-ridge-80m", x: -225, z: 140, rotation: 0.1, scale: 1 },
  { asset: "moor-ridge-80m", x: -48, z: 139, rotation: -0.15, scale: 1 },
  { asset: "moor-ridge-80m", x: -326, z: 80, rotation: 0, scale: 1.1 },
  { asset: "meadow-rise-40m", x: 32, z: -57, rotation: 0, scale: 1 },
];

export function sampleSurface(surface, x, z) {
  const { width, depth, columns, rows, heights } = surface;
  if (Math.abs(x) > width / 2 || Math.abs(z) > depth / 2) return -Infinity;
  const px = (x / width + 0.5) * columns;
  const pz = (z / depth + 0.5) * rows;
  const ix = Math.min(columns - 1, Math.floor(px));
  const iz = Math.min(rows - 1, Math.floor(pz));
  const fx = px - ix,
    fz = pz - iz;
  const i = iz * (columns + 1) + ix;
  const a = heights[i],
    b = heights[i + 1];
  const c = heights[i + columns + 1],
    d = heights[i + columns + 2];
  return fx + fz <= 1
    ? a + (b - a) * fx + (c - a) * fz
    : d + (c - d) * (1 - fx) + (b - d) * (1 - fz);
}

export function createTerrain(catalog, placements = TERRAIN_PLACEMENTS) {
  const pieces = placements.map((p) => {
    const surface = catalog[p.asset]?.groundSurface;
    if (!surface || surface.diagonal !== "b-c")
      throw new Error(`Missing Blender ground samples: ${p.asset}`);
    return {
      ...p,
      surface,
      cos: Math.cos(p.rotation),
      sin: Math.sin(p.rotation),
    };
  });
  return {
    height(x, z) {
      let highest = 0;
      for (const p of pieces) {
        const dx = x - p.x,
          dz = z - p.z;
        const lx = (dx * p.cos - dz * p.sin) / p.scale;
        const lz = (dx * p.sin + dz * p.cos) / p.scale;
        highest = Math.max(highest, sampleSurface(p.surface, lx, lz) * p.scale);
      }
      return highest;
    },
    placements,
  };
}
