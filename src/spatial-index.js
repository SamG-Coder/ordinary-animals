// Static Blender collider footprints indexed once after world assembly.
// Queries preserve the same padded rectangle test as the original full scan.
export function createCollisionIndex(colliders, padding = 0.22, cellSize = 12) {
  const cells = new Map();
  for (const c of colliders) {
    const minX = Math.floor((c.x - c.w / 2 - padding) / cellSize);
    const maxX = Math.floor((c.x + c.w / 2 + padding) / cellSize);
    const minZ = Math.floor((c.z - c.d / 2 - padding) / cellSize);
    const maxZ = Math.floor((c.z + c.d / 2 + padding) / cellSize);
    for (let x = minX; x <= maxX; x++)
      for (let z = minZ; z <= maxZ; z++) {
        const key = `${x},${z}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(c);
      }
  }
  const nearby = (x, z) =>
    cells.get(`${Math.floor(x / cellSize)},${Math.floor(z / cellSize)}`) || [];
  return {
    blocked(x, z) {
      return nearby(x, z).some(
        (c) =>
          Math.abs(x - c.x) < c.w / 2 + padding &&
          Math.abs(z - c.z) < c.d / 2 + padding,
      );
    },
    candidates(x, z) {
      return nearby(x, z).length;
    },
  };
}

export function nearestLights(lights, x, z, count = 4) {
  const selected = [];
  for (const light of lights) {
    const distance = (light.x - x) ** 2 + (light.z - z) ** 2;
    if (distance > 45 ** 2) continue;
    let at = selected.findIndex((entry) => distance < entry.distance);
    if (at < 0) at = selected.length;
    if (at < count) selected.splice(at, 0, { light, distance });
    if (selected.length > count) selected.pop();
  }
  return selected.map((entry) => entry.light);
}
