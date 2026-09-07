import { WILD_SITES } from "./field-notes.js";

// Individual Blender exports placed around the road and the Landlord's courtyard.
export function buildAshEnd({ place, lamp }) {
  place("lettings-office", -233, -37);
  place("tenement-wing", -216, -44);
  place("tenement-wing", -215, -61, 0, -Math.PI / 2);
  for (const z of [4, 21]) place("tenement-wing", -271, z, 0, Math.PI / 2);

  // The player approaches from the junction and enters through a five-metre gap.
  for (let x = -239; x <= -211; x += 4)
    for (let z = -25; z >= -49; z -= 4) {
      // Leave the northbound carriageway clear where it bends along the estate.
      if (x === -239 && z < -37) continue;
      place("court-paving-4m", x, z);
    }
  for (const x of [-242, -239, -227, -224, -221, -218, -215, -212, -209])
    place("estate-railing-3m", x, -22);
  for (const z of [-25, -28, -31, -34, -37, -40])
    place(
      "estate-railing-3m",
      -245 + ((-20 - z) * 40) / 180,
      z,
      0,
      Math.atan2(40, -180) + Math.PI / 2,
    );
  for (let x = -243; x <= -233; x += 2)
    place("path-2m", x, -20, 0, Math.PI / 2, 1.4);
  place("estate-notice", -227.2, -21.5, 0, 0, 1, false);
  for (const [x, z, angle] of [
    [-225, -37, 0.1],
    [-224.3, -37, -0.04],
    [-209.5, -36.5, 0.06],
    [-265.6, 9, Math.PI / 2],
  ]) {
    place("wheelie-bin", x, z, 0, angle);
    place("fallen-leaves", x + 0.4, z + 0.9, 0, angle, 1.3);
  }
  place("storm-drain", -231, -23.5);
  place("storm-drain", -240.8, -31, 0, Math.PI / 2);
  place("puddle", -231, -24.3, 0.015, 0.35, 1.7);
  place("puddle", -220, -32, 0.015, 1.2, 2.3);
  place("fallen-leaves", -226.5, -22.3, 0, 0.3, 1.5);
  for (const [x, z, s] of [
    [-205, -30, 1.15],
    [-206, -55, 1.25],
    [-222, -63, 1.1],
    [-281, -3, 1.2],
    [-284, 27, 1.3],
    [-266, 39, 1.05],
    [-255, 32, 1.1],
  ])
    place("oak-tree", x, z, 0, x * 0.03, s, false);
  for (const [x, z] of [
    [-234.7, -24.8],
    [-210.5, -26],
    [-264, 3],
  ])
    lamp(x, z);

  // Give the approach a verge and landmarks without crowding wild encounter sites.
  const dx = -130,
    dz = -110,
    length = Math.hypot(dx, dz);
  const nx = -dz / length,
    nz = dx / length;
  const angle = Math.atan2(dx, dz);
  const openEncounter = (x, z) =>
    WILD_SITES.some(([wx, wz]) => Math.hypot(x - wx, z - wz) < 5);
  for (let i = 0; i < 22; i++) {
    const t = 0.14 + i * 0.034;
    const x = -120 + dx * t,
      z = 90 + dz * t;
    for (const side of [-1, 1]) {
      const vx = x + nx * side * 6.2,
        vz = z + nz * side * 6.2;
      if (!openEncounter(vx, vz))
        place("verge-grass-2m", vx, vz, 0, angle + Math.PI / 2, 1.1, false);
      place(
        "roadside-gravel-2m",
        x + nx * side * 4.65,
        z + nz * side * 4.65,
        0,
        angle + Math.PI / 2,
      );
      if (i % 2 === 0 && !openEncounter(vx, vz))
        place("fallen-leaves", vx, vz, 0, i * 0.7, 1.5);
      if (i % 3 === 0) {
        const tx = x + nx * side * (12.5 + (i % 2) * 4),
          tz = z + nz * side * (12.5 + (i % 2) * 4);
        if (!openEncounter(tx, tz))
          place("oak-tree", tx, tz, 0, i * 0.4, 1 + (i % 4) * 0.07, false);
      }
      if (i % 2 === 0 && i > 3 && i < 17 && !openEncounter(vx, vz))
        place(
          "estate-railing-3m",
          x + nx * side * 8,
          z + nz * side * 8,
          0,
          angle + Math.PI / 2,
        );
    }
    if (i % 6 === 2) lamp(x + nx * 5.3, z + nz * 5.3, angle);
  }
  place("ash-end-sign", -222, -6, 0, Math.atan2(130, 110));
  lamp(-221, -9, Math.PI);
}
