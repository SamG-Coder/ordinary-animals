import { MORROW_QUAY_WATER } from "./morrow-quay.js";
import { WILD_SITES } from "./field-notes.js";

// The attachment datum is the placement origin. The trunk is behind the arm,
// leaving the centre conductor clear; this footprint matches the Blender source.
export const UTILITY_POLE_FOOTPRINT = Object.freeze({
  x: 0,
  z: -0.245,
  w: 0.42,
  d: 0.42,
});
export const UTILITY_LINE_LAYOUT = Object.freeze({
  spanLength: 24,
  verge: 8.8,
  endMargin: 21,
  townRadius: 60,
  homeRadius: 80,
  attachmentHeight: 6.1,
  sag: 0.35,
  wireOffsets: [-0.9, 0, 0.9],
  maxSpansPerSegment: 3,
});

const pointSegmentDistance = (x, z, a, b) => {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  const t = Math.max(
    0,
    Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)),
  );
  return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
};

function segmentHitsCollider(a, b, c, padding) {
  let near = 0,
    far = 1;
  for (const [axis, size] of [
    ["x", "w"],
    ["z", "d"],
  ]) {
    const delta = b[axis] - a[axis];
    const min = c[axis] - c[size] / 2 - padding;
    const max = c[axis] + c[size] / 2 + padding;
    if (Math.abs(delta) < 1e-9) {
      if (a[axis] < min || a[axis] > max) return false;
    } else {
      const p = (min - a[axis]) / delta,
        q = (max - a[axis]) / delta;
      near = Math.max(near, Math.min(p, q));
      far = Math.min(far, Math.max(p, q));
      if (near > far) return false;
    }
  }
  return true;
}

export function buildUtilityLines({
  place,
  route,
  collisions,
  towns,
  height = () => 0,
}) {
  const rules = UTILITY_LINE_LAYOUT;
  // place() may append pole colliders to the same world array. Do not treat the
  // endpoints of a newly placed span as pre-existing scenery beneath its wires.
  const existing = [...collisions];
  const poles = [],
    spans = [];
  const outsideExclusions = (a, b) => {
    const start = [a.x, a.z],
      end = [b.x, b.z];
    if (pointSegmentDistance(0, 0, start, end) < rules.homeRadius + 1.2)
      return false;
    if (
      towns.some(
        (town) =>
          pointSegmentDistance(town.x, town.z, start, end) <
          rules.townRadius + 1.2,
      )
    )
      return false;
    if (WILD_SITES.some(([x, z]) => pointSegmentDistance(x, z, start, end) < 6))
      return false;
    if (
      MORROW_QUAY_WATER.some((water) =>
        segmentHitsCollider(
          a,
          b,
          {
            x: (water.minX + water.maxX) / 2,
            z: (water.minZ + water.maxZ) / 2,
            w: water.maxX - water.minX,
            d: water.maxZ - water.minZ,
          },
          1.2,
        ),
      )
    )
      return false;
    return true;
  };
  for (let segment = 1; segment < route.length; segment++) {
    const a = route[segment - 1],
      b = route[segment];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < 2 * rules.endMargin + rules.spanLength) continue;
    const dx = (b[0] - a[0]) / length,
      dz = (b[1] - a[1]) / length;
    const angle = Math.atan2(dx, dz);
    const options = [];
    for (const side of [segment % 2 ? 1 : -1, segment % 2 ? -1 : 1]) {
      const pairs = [];
      let previous = null;
      for (
        let distance = rules.endMargin;
        distance <= length - rules.endMargin;
        distance += rules.spanLength
      ) {
        const p = {
          x: a[0] + dx * distance - dz * rules.verge * side,
          z: a[1] + dz * distance + dx * rules.verge * side,
          distance,
          segment,
          side,
          angle,
        };
        p.ground = height(p.x, p.z);
        const footprint = {
          x: p.x + Math.sin(angle) * UTILITY_POLE_FOOTPRINT.z,
          z: p.z + Math.cos(angle) * UTILITY_POLE_FOOTPRINT.z,
          w:
            (Math.abs(Math.cos(angle)) + Math.abs(Math.sin(angle))) *
            UTILITY_POLE_FOOTPRINT.w,
          d:
            (Math.abs(Math.cos(angle)) + Math.abs(Math.sin(angle))) *
            UTILITY_POLE_FOOTPRINT.d,
        };
        const collides = existing.some(
          (c) =>
            Math.abs(c.x - footprint.x) < (c.w + footprint.w) / 2 + 1.2 &&
            Math.abs(c.z - footprint.z) < (c.d + footprint.d) / 2 + 1.2,
        );
        if (
          !Number.isFinite(p.ground) ||
          collides ||
          !outsideExclusions(p, p)
        ) {
          previous = null;
          continue;
        }
        // Also keep the line clear of any other road at crossings or close bends.
        if (
          route
            .slice(1)
            .some(
              (end, index) =>
                pointSegmentDistance(p.x, p.z, route[index], end) < 6,
            )
        ) {
          previous = null;
          continue;
        }
        if (previous) {
          let clear =
            outsideExclusions(previous, p) &&
            !existing.some((c) => segmentHitsCollider(previous, p, c, 1.2));
          for (let step = 0; clear && step <= 12; step++) {
            const t = step / 12;
            const x = previous.x + (p.x - previous.x) * t,
              z = previous.z + (p.z - previous.z) * t;
            // All samples, including both endpoints and the centre, share the
            // source datum. No scale/shear/deformation of the wire is needed.
            if (
              Math.abs(height(x, z) - p.ground) > 0.001 ||
              route
                .slice(1)
                .some(
                  (end, index) =>
                    pointSegmentDistance(x, z, route[index], end) < 6,
                )
            )
              clear = false;
          }
          if (clear) pairs.push([previous, p]);
        }
        previous = p;
      }
      options.push({ side, pairs });
    }
    // Use one verge for the entire straight, choosing the side with fewer
    // conflicts. A rejected candidate never creates a longer bridging span.
    options.sort((a, b) => b.pairs.length - a.pairs.length);
    const chosen = options[0].pairs.slice(0, rules.maxSpansPerSegment);
    const placed = new Map();
    for (const [start, end] of chosen) {
      for (const p of [start, end]) {
        if (placed.has(p.distance)) continue;
        place("utility-pole", p.x, p.z, 0, p.angle);
        placed.set(p.distance, p);
        poles.push(p);
      }
      const span = {
        x: (start.x + end.x) / 2,
        z: (start.z + end.z) / 2,
        angle,
        segment,
        side: start.side,
        start,
        end,
        ground: height((start.x + end.x) / 2, (start.z + end.z) / 2),
      };
      place("overhead-line-24m", span.x, span.z, 0, angle);
      spans.push(span);
    }
  }
  return { poles, spans };
}
