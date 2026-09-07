// X/Z bounds measured from the actual Blender GLB exports. Keep asymmetric
// kerbs and the authored court's irregular outer edges, rather than inferring
// dimensions from asset names. Tests audit these constants against the files.
export const PAVED_FOOTPRINTS = Object.freeze({
  "road-straight-12m": Object.freeze({ minX: -4, maxX: 4, minZ: -6, maxZ: 6 }),
  "road-junction-12m": Object.freeze({ minX: -6, maxX: 6, minZ: -6, maxZ: 6 }),
  "path-2m": Object.freeze({ minX: -0.8, maxX: 0.8, minZ: -1, maxZ: 1 }),
  "pavement-4m": Object.freeze({ minX: -1.05, maxX: 1, minZ: -2, maxZ: 2 }),
  "court-paving-4m": Object.freeze({
    minX: -1.99711561,
    maxX: 1.99706795,
    minZ: -1.99723808,
    maxZ: 1.99703187,
  }),
});

const EPSILON = 1e-7;

// Build after all roads, courtyards and modular paths have been placed, then
// test each plant's horizontal radius before adding that plant to the world.
export function buildPavedSurfaceFilter(placementLog) {
  const records = [];
  for (const p of placementLog) {
    const footprint = PAVED_FOOTPRINTS[p.asset];
    if (!footprint) continue;
    const sx = p.scale ?? 1,
      sz = sx * (p.stretchZ ?? 1),
      angle = p.ry ?? 0;
    if (![p.x, p.z, sx, sz, angle].every(Number.isFinite))
      throw new TypeError(`Invalid paved surface transform: ${p.asset}`);
    if (sx === 0 || sz === 0) continue;
    const ax = footprint.minX * sx,
      bx = footprint.maxX * sx;
    const az = footprint.minZ * sz,
      bz = footprint.maxZ * sz;
    // Bounds are scaled once but remain in axes parallel to the local slab.
    // Queries undo only rotation, so plant radius remains in world metres even
    // when paths have independent longitudinal stretch.
    records.push(
      p.x,
      p.z,
      Math.cos(angle),
      Math.sin(angle),
      Math.min(ax, bx),
      Math.max(ax, bx),
      Math.min(az, bz),
      Math.max(az, bz),
    );
  }
  const surfaces = new Float64Array(records);
  return {
    surfaceCount: surfaces.length / 8,
    isPaved(x, z, radius = 0) {
      if (
        !Number.isFinite(x) ||
        !Number.isFinite(z) ||
        !Number.isFinite(radius) ||
        radius < 0
      )
        throw new TypeError(
          "Paved surface queries require finite coordinates and a non-negative radius",
        );
      const padded = radius + EPSILON;
      for (let i = 0; i < surfaces.length; i += 8) {
        const dx = x - surfaces[i],
          dz = z - surfaces[i + 1];
        const localX = dx * surfaces[i + 2] - dz * surfaces[i + 3];
        const localZ = dx * surfaces[i + 3] + dz * surfaces[i + 2];
        const minX = surfaces[i + 4],
          maxX = surfaces[i + 5];
        const minZ = surfaces[i + 6],
          maxZ = surfaces[i + 7];
        if (
          localX < minX - padded ||
          localX > maxX + padded ||
          localZ < minZ - padded ||
          localZ > maxZ + padded
        )
          continue;
        const outsideX = Math.max(minX - localX, 0, localX - maxX);
        const outsideZ = Math.max(minZ - localZ, 0, localZ - maxZ);
        // Rounded corners test a circular plant footprint, avoiding oversized
        // exclusions at the corners of diagonally placed pavement modules.
        if (outsideX * outsideX + outsideZ * outsideZ <= padded * padded)
          return true;
      }
      return false;
    },
  };
}
