// Placement of independent Blender assets for Old School Road and the first leader's grounds.
export function buildRouteOne({ place, lamp }) {
  const dx = -120,
    dz = 70,
    length = Math.hypot(dx, dz),
    nx = -dz / length,
    nz = dx / length;
  const roadAngle = Math.atan2(dx, dz);
  place("route-sign", -16, 25, 0, Math.atan2(16, -5));
  place("bus-shelter", -71, 67, 0, roadAngle - Math.PI / 2);
  const sites = [
    [-69, 59],
    [-108, 72],
  ];
  const openEncounter = (x, z) =>
    sites.some(([sx, sz]) => Math.hypot(x - sx, z - sz) < 5);
  for (let i = 0; i < 24; i++) {
    const t = 0.23 + i * 0.025,
      x = dx * t,
      z = 20 + dz * t;
    for (const side of [-1, 1]) {
      const bx = x + nx * side * 9.5,
        bz = z + nz * side * 9.5;
      if (!openEncounter(bx, bz))
        place("bramble-patch", bx, bz, 0, i * 1.7, 0.7 + (i % 3) * 0.2);
      if (i % 3 === 0) {
        const tx = x + nx * side * (14 + (i % 2) * 3),
          tz = z + nz * side * (14 + (i % 2) * 3);
        if (!openEncounter(tx, tz))
          place("oak-tree", tx, tz, 0, i * 0.7, 0.85 + (i % 4) * 0.07, false);
      }
      if (i % 2 === 0 && i > 4 && i < 19 && !openEncounter(bx, bz))
        place(
          "stone-wall-4m",
          x + nx * side * 7.2,
          z + nz * side * 7.2,
          0,
          roadAngle + Math.PI / 2,
        );
      place(
        "fallen-leaves",
        x + nx * side * 5,
        z + nz * side * 5,
        0,
        i * 0.8,
        1.6,
      );
    }
    if (i % 6 === 0) lamp(x + nx * 5.2, z + nz * 5.2, roadAngle);
  }
  place("pedestrian-crossing", -112, 85.34, 0, roadAngle);
  for (const side of [-1, 1])
    place("crossing-beacon", -112 + nx * side * 4.5, 85.34 + nz * side * 4.5);
  for (const x of [-105, -101, -85, -81]) place("stone-wall-4m", x, 60);
  for (const x of [-107, -79])
    for (const z of [56, 52, 48, 44, 40])
      place("stone-wall-4m", x, z, 0, Math.PI / 2);
  for (let z = 52; z <= 82; z += 2) place("path-2m", -93, z, 0, 0, 1.6);
  place("notice-board", -99, 50.1, 0.25);
  for (const [x, z, s] of [
    [-110, 42, 1.1],
    [-76, 40, 1.2],
    [-77, 85, 1],
    [-130, 98, 1.1],
  ])
    place("oak-tree", x, z, 0, x * 0.04, s, false);
  lamp(-89, 59, Math.PI);
}
