// Assembly of independent Blender harbour modules. No runtime-generated geometry.
export const MORROW_QUAY_WATER = [
  { minX: 344, maxX: 424, minZ: -120, maxZ: -20 },
];
export const MORROW_QUAY_DOCKS = [
  { minX: 342, maxX: 362, minZ: -70.2, maxZ: -67.8 },
];
export const MORROW_QUAY_LEADER = { x: 292, z: -69 };
export const MORROW_QUAY_APPROACH = [
  [275, -60],
  [292, -60],
  [292, -69],
  [332, -69],
  [350, -69],
  [361, -69],
];

function contains(rect, x, z, inset = 0) {
  return (
    x >= rect.minX + inset &&
    x <= rect.maxX - inset &&
    z >= rect.minZ + inset &&
    z <= rect.maxZ - inset
  );
}

// Call from the player's existing collision query before scenery collision.
// Dock clearance is measured for the whole body, so walking off its edge stops.
export function isMorrowQuayWater(x, z, radius = 0.22) {
  if (!MORROW_QUAY_WATER.some((rect) => contains(rect, x, z, -radius)))
    return false;
  return !MORROW_QUAY_DOCKS.some((rect) => contains(rect, x, z, radius));
}

export function buildMorrowQuay({ place, lamp }) {
  place("harbour-office", 292, -77);
  // Nine separate paving modules surround the leader without placing furniture
  // in the six-metre square needed by the first-person battle arrangement.
  for (const x of [288, 292, 296])
    for (const z of [-73, -69, -65]) place("court-paving-4m", x, z);
  for (let x = 278; x <= 292; x += 2)
    place("path-2m", x, -60, 0.003, Math.PI / 2);
  for (let z = -62; z >= -68; z -= 2) place("path-2m", 292, z, 0.003);
  for (let x = 298; x <= 342; x += 2)
    place("path-2m", x, -69, 0.003, Math.PI / 2);

  // A compact, enclosed harbour basin establishes the coast with 20 repeatable
  // water modules. Fixed tile edges remain watertight even when animation culls.
  for (const x of [354, 374, 394, 414])
    for (const z of [-110, -90, -70, -50, -30])
      place("harbour-water-tile20m", x, z, 0, 0, 1, false);
  for (let z = -118; z <= -22; z += 4) {
    place("stone-quay4m", 344, z, 0, Math.PI / 2);
    place("stone-quay4m", 424, z, 0, Math.PI / 2);
  }
  for (let x = 346; x <= 422; x += 4) {
    place("stone-quay4m", x, -120);
    place("stone-quay4m", x, -20);
  }
  for (const x of [344, 348, 352, 356, 360]) place("timber-pier4m", x, -69);
  for (const [x, z] of [
    [343.3, -82],
    [343.3, -56],
    [348, -70],
    [360, -68],
  ])
    place("mooring-bollard", x, z, 0.03);
  place("moored-dinghy", 353.5, -72.3, 0.02, 0.025);

  place("wheelie-bin", 286.4, -78.2, 0, 0.05);
  place("storage-boxes", 298.2, -78.5, 0, Math.PI / 2);
  place("storm-drain", 299.2, -70.8);
  place("puddle", 296.5, -73.5, 0.012, 0.22, 1.2);
  for (const [x, z] of [
    [287, -66],
    [310, -71.8],
    [333, -71.8],
    [342.4, -76],
    [342.4, -50],
  ])
    lamp(x, z);

  return {
    waterAreas: MORROW_QUAY_WATER.map((rect) => ({ ...rect })),
    allowedDock: MORROW_QUAY_DOCKS.map((rect) => ({ ...rect })),
    leader: { ...MORROW_QUAY_LEADER },
    approach: MORROW_QUAY_APPROACH.map((point) => [...point]),
    deckTop: 0.025,
    waterHeight: 0.015,
    waterAmplitude: 0.004,
    office: { x: 292, z: -77 },
  };
}
