import { DISTRICT_HOUSES } from "./district-housing.js";
import { WILD_SITES } from "./field-notes.js";

const NAMES = [
  "School Mews",
  "",
  "Garden Cottages",
  "Pump Row",
  "Pine Cottages",
  "Harbour Row",
  "School Lane",
  "Crown Cottages",
];
const DOOR_X = -2.61;
const LANE_WIDTH = 4;
const LINK_WIDTH = 3.2;
const FRONT = 8.8;
const EPS = 1e-7;
// Local Blender footprints are scoped to these new residential placements.
// Existing uses of the legacy assets retain their original collision behaviour.
const RESIDENTIAL_FOOTPRINTS = {
  "fence-3m": { x: 0, z: 0.00625, w: 3, d: 0.1125 },
  streetlamp: { x: 0, z: 0, w: 0.14, d: 0.14 },
};

const rect = (x0, z0, x1, z1) => ({
  minX: Math.min(x0, x1),
  maxX: Math.max(x0, x1),
  minZ: Math.min(z0, z1),
  maxZ: Math.max(z0, z1),
});
const overlaps = (a, b, gap = 0) =>
  a.minX < b.maxX + gap - EPS &&
  a.maxX > b.minX - gap + EPS &&
  a.minZ < b.maxZ + gap - EPS &&
  a.maxZ > b.minZ - gap + EPS;
const pointRectDistance = (x, z, r) =>
  Math.hypot(
    Math.max(r.minX - x, 0, x - r.maxX),
    Math.max(r.minZ - z, 0, z - r.maxZ),
  );

function segmentRectangle(a, b, width) {
  if (Math.abs(a[0] - b[0]) < EPS)
    return rect(a[0] - width / 2, a[1], a[0] + width / 2, b[1]);
  if (Math.abs(a[1] - b[1]) < EPS)
    return rect(a[0], a[1] - width / 2, b[0], a[1] + width / 2);
  throw new Error(
    "Residential paths require orthogonal Blender module segments",
  );
}

function polylineRectangles(points, width) {
  const rectangles = points
    .slice(1)
    .map((b, i) => segmentRectangle(points[i], b, width));
  for (const [x, z] of points.slice(1, -1))
    rectangles.push(
      rect(x - width / 2, z - width / 2, x + width / 2, z + width / 2),
    );
  return rectangles;
}

// Partition a pavement union into disjoint rectangles. T-junctions and corners
// share boundaries instead of stacking coplanar path meshes over one another.
function partition(rectangles) {
  const xs = [...new Set(rectangles.flatMap((r) => [r.minX, r.maxX]))].sort(
    (a, b) => a - b,
  );
  const zs = [...new Set(rectangles.flatMap((r) => [r.minZ, r.maxZ]))].sort(
    (a, b) => a - b,
  );
  const strips = [];
  for (let iz = 0; iz < zs.length - 1; iz++) {
    const z = (zs[iz] + zs[iz + 1]) / 2;
    let start = null;
    for (let ix = 0; ix < xs.length - 1; ix++) {
      const x = (xs[ix] + xs[ix + 1]) / 2;
      const covered = rectangles.some(
        (r) =>
          x > r.minX - EPS &&
          x < r.maxX + EPS &&
          z > r.minZ - EPS &&
          z < r.maxZ + EPS,
      );
      if (covered && start === null) start = xs[ix];
      if (start !== null && (!covered || ix === xs.length - 2)) {
        const end = covered ? xs[ix + 1] : xs[ix];
        if (end - start > EPS && zs[iz + 1] - zs[iz] > EPS)
          strips.push(rect(start, zs[iz], end, zs[iz + 1]));
        start = null;
      }
    }
  }
  const result = [];
  for (const strip of strips) {
    const prior = result.find(
      (r) =>
        Math.abs(r.minX - strip.minX) < EPS &&
        Math.abs(r.maxX - strip.maxX) < EPS &&
        Math.abs(r.maxZ - strip.minZ) < EPS,
    );
    if (prior) prior.maxZ = strip.maxZ;
    else result.push({ ...strip });
  }
  return result;
}

function roadRectangle(a, b, width) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  const nx = ((-dz / length) * width) / 2,
    nz = ((dx / length) * width) / 2;
  return [
    [a[0] + nx, a[1] + nz],
    [b[0] + nx, b[1] + nz],
    [b[0] - nx, b[1] - nz],
    [a[0] - nx, a[1] - nz],
  ];
}

function polygonOverlap(box, polygon) {
  const corners = [
    [box.minX, box.minZ],
    [box.maxX, box.minZ],
    [box.maxX, box.maxZ],
    [box.minX, box.maxZ],
  ];
  for (const p of [polygon, corners])
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        nx = a[1] - b[1],
        nz = b[0] - a[0];
      const project = (points) => points.map(([x, z]) => x * nx + z * nz);
      const one = project(polygon),
        two = project(corners);
      if (
        Math.max(...one) <= Math.min(...two) + EPS ||
        Math.max(...two) <= Math.min(...one) + EPS
      )
        return false;
    }
  return true;
}

function connection(index, t, left, right, lastFront) {
  // These connectors follow the reviewed, fixed house rows. Each starts on a
  // free edge of the existing junction and avoids the ring-road carriageways.
  const side = [4, 7].includes(index) ? left - 7.2 : right + 7.2;
  if (index === 0)
    return [
      [t.x, t.z + 6],
      [t.x, t.z + 13],
      [side, t.z + 13],
      [side, lastFront],
    ];
  if (index === 2)
    return [
      [t.x - 6, lastFront],
      [side, lastFront],
      [side, lastFront - 16],
    ];
  if (index === 3)
    return [
      [t.x, t.z + 6],
      [t.x, t.z + 16],
      [side, t.z + 16],
      [side, lastFront],
    ];
  if (index === 4)
    return [
      [t.x - 6, t.z + 5],
      [side, t.z + 5],
      [side, lastFront],
    ];
  if (index === 5)
    return [
      [t.x + 5, t.z + 6],
      [t.x + 5, t.z + 13],
      [side, t.z + 13],
      [side, lastFront],
    ];
  if (index === 6)
    return [
      [t.x + 4, t.z + 6],
      [t.x + 4, t.z + 18],
      [side, t.z + 18],
      [side, lastFront],
    ];
  if (index === 7)
    return [
      [t.x - 2, t.z + 6],
      [t.x - 2, t.z + 12],
      [side, t.z + 12],
      [side, lastFront],
    ];
  return [];
}

export function buildResidentialStreets({
  place,
  lamp,
  towns,
  route,
  collisions = [],
}) {
  const streets = [],
    plots = [],
    props = [],
    skippedProps = [],
    surfaces = [];
  const roads = route.slice(1).map((b, i) => roadRectangle(route[i], b, 8));
  const junctions = route
    .slice(0, -1)
    .map(([x, z]) => rect(x - 6, z - 6, x + 6, z + 6));
  const leaderAprons = towns.map((t) =>
    rect(t.gymX - 3, t.gymZ - 3, t.gymX + 3, t.gymZ + 3),
  );
  const preexisting = collisions.map((c) =>
    rect(c.x - c.w / 2, c.z - c.d / 2, c.x + c.w / 2, c.z + c.d / 2),
  );

  function pave(box, district) {
    const width = box.maxX - box.minX,
      depth = box.maxZ - box.minZ;
    const horizontal = width > depth,
      length = horizontal ? width : depth,
      cross = horizontal ? depth : width;
    const count = Math.ceil(length / 2),
      step = length / count,
      scale = cross / 1.6;
    for (let i = 0; i < count; i++) {
      const x = horizontal
        ? box.minX + step * (i + 0.5)
        : (box.minX + box.maxX) / 2;
      const z = horizontal
        ? (box.minZ + box.maxZ) / 2
        : box.minZ + step * (i + 0.5);
      // path-2m is 1.6 × 2 m. Compensate uniform width scaling in its length.
      place(
        "path-2m",
        x,
        z,
        0.028,
        horizontal ? Math.PI / 2 : 0,
        scale,
        true,
        step / (2 * scale),
      );
    }
    surfaces.push({ ...box, district });
  }

  function decor(
    asset,
    x,
    z,
    angle,
    scale,
    size,
    district,
    addCollider = false,
  ) {
    const [w, d] = size,
      box = rect(x - w / 2, z - d / 2, x + w / 2, z + d / 2);
    const unsafe =
      roads.some((p) => polygonOverlap(box, p)) ||
      junctions.some((r) => overlaps(box, r, 0.15)) ||
      leaderAprons.some((r) => overlaps(box, r, 0.3)) ||
      WILD_SITES.some(([wx, wz]) => pointRectDistance(wx, wz, box) < 6) ||
      preexisting.some((r) => overlaps(box, r, 0.12)) ||
      surfaces.some((r) => overlaps(box, r, 0.04)) ||
      props.some((p) =>
        overlaps(
          box,
          p.bounds,
          asset === "fence-3m" && p.asset === "fence-3m" ? -0.001 : 0.04,
        ),
      );
    if (unsafe) {
      skippedProps.push({ asset, x, z, district });
      return;
    }
    const priorColliders = collisions.length;
    if (asset === "streetlamp") lamp(x, z, angle);
    else place(asset, x, z, 0, angle, scale);
    const collisionFootprint = addCollider
      ? { ...RESIDENTIAL_FOOTPRINTS[asset] }
      : null;
    if (collisionFootprint) {
      const c = collisionFootprint,
        cos = Math.cos(angle),
        sin = Math.sin(angle);
      collisions.push({
        x: x + c.x * scale * cos + c.z * scale * sin,
        z: z - c.x * scale * sin + c.z * scale * cos,
        w: Math.abs(c.w * scale * cos) + Math.abs(c.d * scale * sin),
        d: Math.abs(c.w * scale * sin) + Math.abs(c.d * scale * cos),
      });
    }
    for (const c of collisions.slice(priorColliders))
      c.residentialStreet = true;
    props.push({
      asset,
      x,
      z,
      angle,
      scale,
      district,
      bounds: box,
      collisionFootprint,
    });
  }

  for (const [index, houses] of DISTRICT_HOUSES.entries()) {
    if (!houses.length) continue;
    const t = towns[index],
      xs = houses.map((h) => h[0]),
      rows = [...new Set(houses.map((h) => h[1]))].sort((a, b) => a - b);
    const left = Math.min(...xs),
      right = Math.max(...xs),
      fronts = rows.map((z) => z + FRONT);
    const link = connection(index, t, left, right, fronts.at(-1));
    const side = link.at(-1)[0];
    const rectangles = polylineRectangles(link, LINK_WIDTH);
    for (const z of fronts)
      rectangles.push(
        rect(
          Math.min(left - 5.8, side - LINK_WIDTH / 2),
          z - LANE_WIDTH / 2,
          Math.max(right + 5.8, side + LINK_WIDTH / 2),
          z + LANE_WIDTH / 2,
        ),
      );
    for (const [x, z] of houses) {
      const doorX = x + DOOR_X,
        doorZ = z + 3.72;
      rectangles.push(
        rect(doorX - 0.8, doorZ, doorX + 0.8, z + FRONT - LANE_WIDTH / 2),
      );
      plots.push({
        district: index,
        house: [x, z],
        doorstep: [doorX, doorZ],
        gate: [doorX, z + 6],
        lane: [doorX, z + FRONT],
        privatePathWidth: 1.6,
      });
    }
    const divided = partition(rectangles);
    for (const box of divided) pave(box, index);
    streets.push({
      district: index,
      name: NAMES[index],
      junction: link[0],
      connection: link,
      rowCentres: fronts,
      width: LANE_WIDTH,
      sideWidth: LINK_WIDTH,
      houses: houses.length,
    });
  }

  // Props are placed only after every path footprint is known, so a fence or bin
  // cannot seal an adjacent row's connection. Gates remain aligned to the doors.
  for (const plot of plots) {
    const {
      district,
      house: [x, z],
    } = plot;
    for (const fx of [x - 4.5, x, x + 2.04])
      decor("fence-3m", fx, z + 6, 0, 0.68, [2.04, 0.072], district, true);
    for (const fx of [x - 5.35, x + 3.15])
      decor(
        "fence-3m",
        fx,
        z + 4.85,
        Math.PI / 2,
        0.68,
        [0.072, 2.04],
        district,
        true,
      );
    decor("wheelie-bin", x + 3.9, z + 4.75, -0.12, 1, [0.72, 0.8], district);
    decor(
      "grass-clump",
      x + 1.8,
      z + 4.8,
      x * 0.11,
      0.65,
      [1.0, 0.8],
      district,
    );
  }
  for (const street of streets) {
    const houses = DISTRICT_HOUSES[street.district],
      middle = houses[1][0];
    for (const z of street.rowCentres)
      decor(
        "streetlamp",
        middle + 3.7,
        z + 2.75,
        Math.PI,
        1,
        [0.17, 0.17],
        street.district,
        true,
      );
  }
  return { streets, plots, surfaces, props, skippedProps, interactions: [] };
}
