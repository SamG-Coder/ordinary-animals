// Sparse, independent Blender repair/scar/ironwork modules on straight lanes.
export function buildRoadWear({ place, route }) {
  const marks = [];
  const variants = [
    "asphalt-repair-2m",
    "cast-iron-manhole",
    "shallow-road-scar-1m",
  ];
  for (let segment = 1; segment < route.length; segment++) {
    const [ax, az] = route[segment - 1],
      [bx, bz] = route[segment];
    const length = Math.hypot(bx - ax, bz - az),
      dx = (bx - ax) / length,
      dz = (bz - az) / length;
    let n = 0;
    for (let distance = 28; distance < length - 22; distance += 44) {
      const lane = (segment + n) % 2 ? 1.8 : -1.8;
      const x = ax + dx * distance - dz * lane,
        z = az + dz * distance + dx * lane;
      const asset = variants[(segment + n) % variants.length];
      place(
        asset,
        x,
        z,
        0.01235,
        Math.atan2(dx, dz) + Math.PI / 2 + ((n % 3) - 1) * 0.12,
      );
      marks.push({ asset, x, z, segment });
      n++;
    }
  }
  return marks;
}
