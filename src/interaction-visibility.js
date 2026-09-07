// Only solid architectural assets participate. Heights are Blender-exported
// bounds, rounded outward; furniture, glazing-only buildings, foliage, open
// railings, bridges and surfaces deliberately do not become opaque volumes.
export const INTERACTION_OCCLUDER_HEIGHTS = Object.freeze({
  "wall-4m": 3,
  "wall-door-4m": 3.000001,
  "wall-window-4m": 3,
  "room-window-4m": 3,
  "corner-shopfront8m": 3,
  "stone-wall-4m": 1.141,
  "county-school": 8.76,
  "lettings-office": 6.000001,
  "tenement-wing": 10.511,
  "groundskeeper-lodge": 6.485,
  "pump-station": 6.28,
  "terrace-house-v2": 7.174,
  "league-inspection-office": 6.305,
  "ranger-lodge": 6.645,
  "harbour-office": 4.761,
  "st-marrow-school-block": 8.746,
});

const CLOSED_DOORS = Object.freeze({ doorOpen: false, frontOpen: false });
const EPSILON = 1e-10;

// Inclusive segment/slab test. Parallel segments avoid division by zero;
// tangent contact counts as occlusion rather than leaking through wall edges.
function crosses(x, y, z, dx, dy, dz, end, minX, maxX, minY, maxY, minZ, maxZ) {
  let near = 0,
    far = end,
    a,
    b;
  if (Math.abs(dx) < EPSILON) {
    if (x < minX || x > maxX) return false;
  } else {
    a = (minX - x) / dx;
    b = (maxX - x) / dx;
    near = Math.max(near, Math.min(a, b));
    far = Math.min(far, Math.max(a, b));
    if (near > far) return false;
  }
  if (Math.abs(dy) < EPSILON) {
    if (y < minY || y > maxY) return false;
  } else {
    a = (minY - y) / dy;
    b = (maxY - y) / dy;
    near = Math.max(near, Math.min(a, b));
    far = Math.min(far, Math.max(a, b));
    if (near > far) return false;
  }
  if (Math.abs(dz) < EPSILON) {
    if (z < minZ || z > maxZ) return false;
  } else {
    a = (minZ - z) / dz;
    b = (maxZ - z) / dz;
    near = Math.max(near, Math.min(a, b));
    far = Math.min(far, Math.max(a, b));
    if (near > far) return false;
  }
  return near <= far;
}

export function createInteractionVisibility(
  placementLog,
  catalog,
  targetInset = 0.15,
) {
  const boxes = [];
  for (const p of placementLog) {
    const height = INTERACTION_OCCLUDER_HEIGHTS[p.asset];
    if (height === undefined) continue;
    const sx = p.scale ?? 1,
      sz = sx * (p.stretchZ ?? 1);
    const cos = Math.cos(p.ry ?? 0),
      sin = Math.sin(p.ry ?? 0);
    // world.js scales wall-4m horizontally while retaining full-height walls.
    const sy = p.asset === "wall-4m" ? 1 : Math.abs(sx);
    for (const c of catalog[p.asset]?.colliders ?? []) {
      const x = p.x + c.x * sx * cos + c.z * sz * sin;
      const z = p.z - c.x * sx * sin + c.z * sz * cos;
      const w = Math.abs(c.w * sx * cos) + Math.abs(c.d * sz * sin);
      const d = Math.abs(c.w * sx * sin) + Math.abs(c.d * sz * cos);
      boxes.push(
        x - w / 2,
        x + w / 2,
        p.y ?? 0,
        (p.y ?? 0) + height * sy,
        z - d / 2,
        z + d / 2,
      );
    }
  }
  const bounds = new Float64Array(boxes);
  const inset = Math.max(0, targetInset);
  return {
    occluderCount: bounds.length / 6,
    visible(from, target, doors = CLOSED_DOORS) {
      const x = from.x,
        y = from.y,
        z = from.z;
      const dx = target.x - x,
        dy = target.y - y,
        dz = target.z - z;
      const distance = Math.hypot(dx, dy, dz);
      if (!Number.isFinite(distance)) return false;
      if (distance <= inset) return true;
      const end = 1 - inset / distance;
      for (let i = 0; i < bounds.length; i += 6) {
        if (
          crosses(
            x,
            y,
            z,
            dx,
            dy,
            dz,
            end,
            bounds[i],
            bounds[i + 1],
            bounds[i + 2],
            bounds[i + 3],
            bounds[i + 4],
            bounds[i + 5],
          )
        )
          return false;
      }
      // Dynamic leaves match the actual Blender door panel, not the padded
      // movement collision. Door targets remain operable from either side.
      if (
        !doors.doorOpen &&
        target.id !== "door" &&
        crosses(x, y, z, dx, dy, dz, end, -0.7, 0.7, 0, 2.28, 3.9625, 4.0375)
      )
        return false;
      if (
        !doors.frontOpen &&
        target.id !== "front-door" &&
        crosses(x, y, z, dx, dy, dz, end, -0.7, 0.7, 0, 2.28, 7.9625, 8.0375)
      )
        return false;
      return true;
    },
  };
}
