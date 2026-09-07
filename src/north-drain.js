// Independent Blender civic architecture, bridge and drain modules form the fourth district.
export const NORTH_DRAIN = {
  junction: [-45, -295],
  leader: [-28, -304],
  building: [-28, -312],
  bridge: [-28, -299.4],
  incoming: [-175, -242],
  outgoing: [155, -245],
};

export const NORTH_DRAIN_INTERACTIONS = [
  {
    id: "north-drain-warning",
    x: -33.7,
    z: -297.2,
    radius: 2.2,
    title: "JUNIOR INSPECTION ROUTE",
    label: "Read the drain warning",
    lines: [
      "No diving. No swimming. No adult supervision.",
      "The safety notice suggests contacting a responsible adult, then directs all enquiries to the junior field programme.",
      "You qualify. You are ten.",
    ],
  },
  {
    id: "north-drain-pipe",
    x: -34.6,
    z: -303,
    radius: 2,
    title: "OUTFALL 04",
    label: "Inspect the drainage pipe",
    lines: [
      "The pipe bears a council asset number and a repair sticker old enough to apply to the League itself.",
      "The emergency budget has been spent on eight commemorative badges.",
    ],
  },
];

export function buildNorthDrain({ place, lamp }) {
  place("pump-station", ...NORTH_DRAIN.building);
  // A dedicated bridge bay replaces the central channel segment. Its passage
  // is open; never put a banked channel collider underneath the bridge deck.
  for (const x of [-36, -32, -24, -20, -16, -12])
    place("brick-drain-channel-4m", x, -299.4, 0, Math.PI / 2, 1, false);
  place("canal-footbridge", ...NORTH_DRAIN.bridge);
  for (const z of [-309.8, -307, -304.2, -301.4])
    place("drainage-pipe", -36, z);
  place("north-drain-notice", -33.7, -297.2);
  for (let x = -41; x <= -29; x += 2)
    place("path-2m", x, -295, 0, Math.PI / 2, 1.15, true, 1 / 1.15);
  place("path-2m", -28, -295.6, 0, 0, 1.2, true, 1 / 1.2);
  for (const x of [-30, -26])
    for (const z of [-303, -307]) place("court-paving-4m", x, z);
  for (const x of [-19, -15, -11])
    for (const z of [-307, -311, -315]) place("court-paving-4m", x, z);

  // A modest utility yard gives the drain a destination without filling the map
  // with repeated props or crowding the six-metre battle apron.
  for (const x of [-19.5, -16.5, -13.5, -10.5])
    place("estate-railing-3m", x, -318);
  for (const z of [-315, -312, -309, -306])
    place("estate-railing-3m", -9, z, 0, Math.PI / 2);
  place("wheelie-bin", -19.5, -311.7);
  place("wheelie-bin", -18.7, -311.7, 0, .04);
  place("storm-drain", -23.2, -302.5, 0, Math.PI / 2);
  place("storm-drain", -18.0, -314.5);
  place("puddle", -18.9, -310.0, .012, .4, 1.9);
  place("fallen-leaves", -31.8, -296, 0, .3, 1.3);
  place("fallen-leaves", -12.2, -300.6, 0, -.4, 1.6);
  for (const [x, z, rotation] of [[-31.8, -297.5, 0], [-24.2, -301.4, Math.PI], [-16.5, -310.7, Math.PI]])
    lamp(x, z, rotation);
  for (const [x, z, scale] of [[-53, -311, 1.10], [-46, -322, 1.23], [-32, -326, 1.12], [-7, -323, 1.18], [0, -308, 1.23]])
    place("oak-tree", x, z, 0, x * .12, scale, false);
  return { interactions: NORTH_DRAIN_INTERACTIONS, ...NORTH_DRAIN };
}
