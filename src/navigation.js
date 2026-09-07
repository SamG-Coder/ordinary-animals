// A small A* grid keeps click-to-walk routes clear of houses, water and the island edge.
export function findPath(start, end, blocked, step = 0.5) {
  const cell = (p) => ({ x: Math.round(p.x / step), z: Math.round(p.z / step) });
  const key = (p) => `${p.x},${p.z}`;
  const a = cell(start),
    b = cell(end);
  const open = [{ ...a, g: 0, f: 0, parent: null }],
    seen = new Map([[key(a), 0]]);
  let last = null,
    iterations = 0;
  while (open.length && iterations++ < 8000) {
    open.sort((p, q) => q.f - p.f);
    const node = open.pop();
    if (Math.hypot(node.x - b.x, node.z - b.z) < 1.1) {
      last = node;
      break;
    }
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      const x = node.x + dx,
        z = node.z + dz;
      if (Math.abs(x) > 36 || Math.abs(z) > 30 || blocked(x * step, z * step)) continue;
      if (
        dx &&
        dz &&
        (blocked((node.x + dx) * step, node.z * step) ||
          blocked(node.x * step, (node.z + dz) * step))
      )
        continue;
      const g = node.g + Math.hypot(dx, dz),
        id = `${x},${z}`;
      if (seen.has(id) && seen.get(id) <= g) continue;
      seen.set(id, g);
      open.push({ x, z, g, f: g + Math.hypot(x - b.x, z - b.z), parent: node });
    }
  }
  if (!last) return [];
  const path = [];
  while (last.parent) {
    path.push({ x: last.x * step, z: last.z * step });
    last = last.parent;
  }
  path.reverse();
  if (!blocked(end.x, end.z)) path.push({ x: end.x, z: end.z });
  return path;
}
