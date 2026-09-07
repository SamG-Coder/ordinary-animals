// Exact-size roof panels cover the floor plan. Eaves occur only on the outside
// of that union, so adjacent rooms never stack metal skins or hide extra gutters.
export function buildDomesticRoofs({ place, tiles, height = 3.2 }) {
  const cells = new Set();
  for (const [x, z] of tiles) {
    place("roof-panel-4m", x, z, height);
    for (const dx of [-1, 1])
      for (const dz of [-1, 1]) cells.add(`${x + dx},${z + dz}`);
  }
  const edges = [];
  for (const key of cells) {
    const [x, z] = key.split(",").map(Number);
    for (const [dx, dz, rotation] of [
      [0, 2, 0],
      [2, 0, Math.PI / 2],
      [0, -2, Math.PI],
      [-2, 0, -Math.PI / 2],
    ]) {
      if (cells.has(`${x + dx},${z + dz}`)) continue;
      const px = x + dx / 2,
        pz = z + dz / 2;
      edges.push({ x: px, z: pz, rotation });
    }
  }
  const pending = edges.map((edge) => ({ ...edge }));
  while (pending.length) {
    const edge = pending.shift();
    const horizontal = Math.abs(Math.sin(edge.rotation)) < 0.5;
    const partner = pending.findIndex(
      (other) =>
        other.rotation === edge.rotation &&
        (horizontal
          ? other.z === edge.z && other.x === edge.x + 2
          : other.x === edge.x && other.z === edge.z + 2),
    );
    if (partner < 0)
      place("roof-eave-2m", edge.x, edge.z, height, edge.rotation);
    else {
      const other = pending.splice(partner, 1)[0];
      place(
        "roof-eave-4m",
        (edge.x + other.x) / 2,
        (edge.z + other.z) / 2,
        height,
        edge.rotation,
      );
    }
  }
  return edges;
}
