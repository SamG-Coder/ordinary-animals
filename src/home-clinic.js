// Walkable domestic and research interiors assembled from independent Blender assets.
export const HOME_CLINIC_ROAD = {
  x: 16,
  startZ: -12,
  endZ: 20,
  width: 8,
  junctionX: 16,
  junctionZ: 20,
  junctionWidth: 12,
  junctionDepth: 12,
};
export const HOME_CLINIC_RIVAL = { x: 24, z: -12 };

export const HOME_CLINIC_ROOMS = [
  {
    id: "home-hall",
    label: "Home · hall",
    minX: -2,
    maxX: 2,
    minZ: 4,
    maxZ: 8,
  },
  {
    id: "home-kitchen",
    label: "Home · kitchen",
    minX: -10,
    maxX: -2,
    minZ: 4,
    maxZ: 8,
  },
  {
    id: "home-living",
    label: "Home · living room",
    minX: 2,
    maxX: 10,
    minZ: 4,
    maxZ: 8,
  },
  {
    id: "home-parent-room",
    label: "Home · parent's room",
    minX: 2,
    maxX: 10,
    minZ: 8,
    maxZ: 12,
  },
  {
    id: "home-bathroom",
    label: "Home · bathroom",
    minX: -10,
    maxX: -6,
    minZ: 8,
    maxZ: 12,
  },
  {
    id: "home-utility",
    label: "Home · utility room",
    minX: -6,
    maxX: -2,
    minZ: 8,
    maxZ: 12,
  },
  {
    id: "county-research",
    label: "County Research · intake room",
    minX: 18,
    maxX: 30,
    minZ: -30,
    maxZ: -18,
  },
];

export const HOME_CLINIC_INTERACTIONS = [
  {
    id: "home-fridge",
    kind: "inspect",
    x: -7.8,
    z: 4.96,
    radius: 1.8,
    label: "Read the note on the fridge",
    title: "LATE SHIFT",
    lines: [
      "Tea in the fridge. Back tomorrow.",
      "Your parent has left dinner, bus fare, and a number for a man who says he is a professor.",
      "The fridge hums. Someone has circled your tenth birthday on the rota.",
    ],
  },
  {
    id: "home-sink",
    kind: "inspect",
    x: -9.06,
    z: 6,
    radius: 1.6,
    label: "Inspect the kitchen sink",
    title: "SCHOOL MORNING",
    lines: [
      "One washed lunchbox. No packed lunch.",
      "Apparently you will be learning self-reliance today.",
    ],
  },
  {
    id: "home-table",
    kind: "inspect",
    x: -5.8,
    z: 6,
    radius: 1.6,
    label: "Read the absence form",
    title: "AUTHORISED ABSENCE",
    lines: [
      "Reason for absence: educational animal combat.",
      "Return date: after regional accreditation.",
      "The school has stamped it APPROVED.",
    ],
  },
  {
    id: "home-photo",
    kind: "inspect",
    x: 4.1,
    z: 4.4,
    radius: 1.6,
    label: "Look at the family photograph",
    title: "ONE SUMMER OFF",
    lines: [
      "A family photograph from before every adult started working shifts.",
      "You were seven. Nobody asked what badge you had.",
    ],
  },
  {
    id: "home-sofa",
    kind: "inspect",
    x: 7.8,
    z: 4.65,
    radius: 1.9,
    label: "Look at the sofa",
    title: "STILL WARM",
    lines: [
      "A blanket and a dent where someone slept before the early shift.",
      "The room smells of instant coffee and a house that is trying its best.",
    ],
  },
  {
    id: "home-television",
    kind: "television",
    x: 9.15,
    z: 6.5,
    radius: 2,
    label: "Watch the county news",
    title: "COUNTY NEWS",
    lines: [
      "The presenter assures parents that ten is an excellent age for independent fieldwork.",
      "A league spokesperson calls the programme character-building.",
      "No children were available for comment. They were outside.",
    ],
  },
  {
    id: "home-bathroom",
    kind: "inspect",
    x: -6.75,
    z: 10.7,
    radius: 1.7,
    label: "Check the bathroom sink",
    title: "MORNING ROUTINE",
    lines: [
      "A toothbrush. A cheap bar of soap. A school tie hanging out to dry.",
      "The usual things you would need for a usual day.",
    ],
  },
  {
    id: "home-parent-bed",
    kind: "inspect",
    x: 7.2,
    z: 10.2,
    radius: 1.8,
    label: "Look around the room",
    title: "ANOTHER SHIFT",
    lines: [
      "The alarm is set for 04:30. The bed has barely been used.",
      "Your journey is described as an opportunity on the official paperwork.",
    ],
  },
  {
    id: "research-records",
    kind: "inspect",
    x: 19.15,
    z: -22.3,
    radius: 2,
    label: "Read the research intake notes",
    title: "COUNTY RESEARCH",
    lines: [
      "Applicant age: ten. Qualifications: none. Guardian present: no.",
      "The final box says SUITABLE FOR UNSUPERVISED ANIMAL HANDLING.",
      "It has already been ticked.",
    ],
  },
  {
    id: "research-kennel-cat",
    kind: "starter-pen",
    species: "cat",
    x: 21,
    z: -24.1,
    radius: 1.8,
    label: "Inspect the cat's pen",
    title: "DOMESTIC CAT",
    lines: [
      "The label says STARTER. The cat says nothing.",
      "It has declined to sign its part of the research agreement.",
    ],
  },
  {
    id: "research-kennel-dog",
    kind: "starter-pen",
    species: "dog",
    x: 24,
    z: -27.1,
    radius: 1.8,
    label: "Inspect the dog's pen",
    title: "DOMESTIC DOG",
    lines: [
      "A clean blanket, a water bowl, and an animal more pleased to meet you than anyone else in the building.",
      "The handling guide is one page. Most of it is a liability waiver.",
    ],
  },
  {
    id: "research-kennel-hamster",
    kind: "starter-pen",
    species: "hamster",
    x: 27,
    z: -24.1,
    radius: 1.8,
    label: "Inspect the hamster's pen",
    title: "DOMESTIC HAMSTER",
    lines: [
      "A very small animal in a very serious government programme.",
      "The label says FIELD READY. Someone has underlined READY twice.",
    ],
  },
];

export const HOME_CLINIC_LIGHTS = [
  { x: 0, z: 6, y: 2.34, power: 38, color: 0xffd5a2 },
  { x: -6, z: 6, y: 2.34, power: 65, color: 0xffdcaf },
  { x: 6, z: 6, y: 2.34, power: 58, color: 0xffcb8e },
  { x: 6, z: 10, y: 2.34, power: 46, color: 0xffd5a2 },
  { x: -8, z: 10, y: 2.34, power: 34, color: 0xd5e1d7 },
  { x: -4, z: 10, y: 2.34, power: 29, color: 0xffd5a2 },
  { x: 21, z: -21, y: 2.34, power: 68, color: 0xd2e1d4 },
  { x: 27, z: -21, y: 2.34, power: 68, color: 0xd2e1d4 },
  { x: 21, z: -27, y: 2.34, power: 68, color: 0xd2e1d4 },
  { x: 27, z: -27, y: 2.34, power: 68, color: 0xd2e1d4 },
];

export const HOME_CLINIC_STARTERS = [
  { species: "cat", x: 21, z: -25 },
  { species: "dog", x: 24, z: -28 },
  { species: "hamster", x: 27, z: -25 },
];

export function buildHomeClinic({ place }) {
  const roofTiles = [];
  const wall = (x, z, rotation = 0, scale = 1, external = false) => {
    place("wall-4m", x, z, 0, rotation, scale);
    if (external)
      place(
        "exterior-wall-4m",
        x - Math.sin(rotation) * 0.15,
        z - Math.cos(rotation) * 0.15,
        0,
        rotation,
        scale,
      );
  };
  const doorway = (x, z, rotation = 0) =>
    place("wall-door-4m", x, z, 0, rotation);
  const window = (x, z, rotation = 0) =>
    place("room-window-4m", x, z, 0, rotation);
  const floor = (x, z, tiled = false) => {
    place(tiled ? "domestic-tile-floor-4m" : "floor-4m", x, z);
    place("ceiling-4m", x, z, 3);
    roofTiles.push([x, z]);
  };

  // Existing bedroom and both interactive doors remain at their original coordinates.
  floor(0, 6);
  doorway(-2, 6, Math.PI / 2);
  doorway(2, 6, -Math.PI / 2);
  doorway(0, 8, Math.PI);
  place("porch-step", 0, 8.55);
  place("porch-canopy", 0, 8.6);
  place("hall-table", -1.4, 7.25, 0, Math.PI / 2);
  for (let z = 10; z < 20; z += 2) place("path-2m", 0, z);

  for (const x of [-8, -4, 4, 8]) for (const z of [6, 10]) floor(x, z, x < 0);
  // The existing bedroom already supplies x[-4,4] at z=4. No coplanar duplicate wall.
  wall(-8, 4, 0, 1, true);
  wall(-5, 4, 0, 0.5, true);
  wall(5, 4, 0, 0.5, true);
  wall(8, 4, 0, 1, true);
  for (const z of [6, 10]) {
    window(-10, z, Math.PI / 2);
    window(10, z, -Math.PI / 2);
  }
  for (const x of [-8, -4, 4, 8]) window(x, 12, Math.PI);
  wall(-2, 10, -Math.PI / 2, 1, true);
  wall(2, 10, Math.PI / 2, 1, true);
  doorway(-8, 8, Math.PI);
  doorway(-4, 8, Math.PI);
  wall(-6, 10, Math.PI / 2);
  doorway(4, 8, Math.PI);
  wall(8, 8, Math.PI);

  // Kitchen, including a clear 1.3 m walkway around the table and all doorways.
  place("kitchen-counter", -9.48, 6, 0, Math.PI / 2);
  place("kitchen-fridge", -7.8, 4.55);
  place("home-dining-table", -5.8, 6);
  place("chair", -5.8, 6.93, 0, Math.PI);
  place("chair", -5.8, 5.06);

  place("family-sofa", 7.8, 4.64);
  const television = place(
    "home-crt-tv",
    9.18,
    6.53,
    0,
    -Math.PI / 2,
    1,
    false,
  );
  place("hall-table", 4.1, 4.48);
  place("family-photo", 4.1, 4.45, 0.82);
  place("rug", 6.8, 6.3, 0.002, 0, 0.6);
  place("radiator", 9.75, 7.25, 0, -Math.PI / 2, 0.6);

  place("bed", 7.35, 10, 0, Math.PI, 1.1);
  place("bedside-table", 5.87, 10.7, 0, Math.PI);
  place("bedside-lamp", 5.87, 10.7, 0.75, 0, 1, false);
  place("wardrobe", 9.32, 9.05, 0, Math.PI);
  place("storage-boxes", 3.0, 11.22, 0, 0, 0.85);

  place("bathroom-tub", -9.28, 10.25);
  place("bathroom-toilet", -7.58, 11.26);
  place("bathroom-basin", -6.69, 10.64, 0, -Math.PI / 2);
  place("radiator", -6.2, 9.1, 0, -Math.PI / 2, 0.5);
  place("storage-boxes", -4.85, 10.4, 0, 0, 0.9);
  place("wardrobe", -2.67, 10.7, 0, Math.PI);
  place("school-shoes", -3.0, 9.45);

  // Small domestic details remain separate sources and can be moved independently.
  for (const [x, z, rotation] of [
    [-10, 6, Math.PI / 2],
    [10, 6, -Math.PI / 2],
    [4, 12, Math.PI],
    [8, 12, Math.PI],
  ])
    place(
      "gathered-curtains-2m",
      x + Math.sin(rotation) * 0.24,
      z + Math.cos(rotation) * 0.24,
      0,
      rotation,
      1,
      false,
    );
  place("hall-coat-rack", 1.8, 6.6, 0, -Math.PI / 2);
  place("school-shoes", 1.55, 7.45, 0, -0.18, 1.35);
  place("sofa-wool-blanket", 7.12, 4.98, 0.707, Math.PI);
  place("unfinished-breakfast", -6.05, 5.76, 0.784, 0, 0.83);
  place("kitchen-pantry-tins", -9.49, 7.04, 0.92, Math.PI / 2);
  place("bathroom-towel-rail", -9.78, 9.03, 0, Math.PI / 2);
  place("socket", 4.45, 4.13, 0.3);
  place("socket", -5.02, 4.13, 1.08);
  place("radiator", 4.8, 11.76, 0, Math.PI, 0.8);

  // County Research has a real floor, perimeter walls, windows and an open entry.
  for (const x of [20, 24, 28])
    for (const z of [-20, -24, -28]) floor(x, z, true);
  for (const z of [-20, -24, -28]) {
    window(18, z, Math.PI / 2);
    window(30, z, -Math.PI / 2);
  }
  for (const x of [20, 24, 28]) wall(x, -30, 0, 1, true);
  window(20, -18, Math.PI);
  window(28, -18, Math.PI);
  doorway(24, -18, Math.PI);
  place("clinic-entry-sign", 24, -17.86);
  place("porch-canopy", 24, -17.45);
  place("porch-step", 24, -17.45);
  for (let z = -17; z <= -14; z += 2) place("path-2m", 24, z);
  place("research-bench", 18.6, -22.3, 0, Math.PI / 2);
  place("research-bench", 29.39, -22.3, 0, -Math.PI / 2);
  place("desk", 20.0, -28.65, 0, Math.PI);
  place("books", 20.25, -28.74, 0.84);
  place("chair", 20.0, -27.4);
  place("storage-boxes", 28.5, -28.45, 0, Math.PI / 2);
  for (const { x, z } of HOME_CLINIC_STARTERS) place("starter-pen", x, z);
  place("notice-board", 18.22, -20.22, 0.1, Math.PI / 2, 0.65, false);
  for (const { x, z } of HOME_CLINIC_LIGHTS)
    place("interior-ceiling-light", x, z, 2.98);
  return {
    rooms: HOME_CLINIC_ROOMS,
    interactions: HOME_CLINIC_INTERACTIONS,
    lights: HOME_CLINIC_LIGHTS,
    starters: HOME_CLINIC_STARTERS,
    researcher: { x: 24, z: -26 },
    television,
    roofTiles,
    entrances: [
      { x: 0, z: 8, width: 1.44 },
      { x: 24, z: -18, width: 1.44 },
    ],
  };
}
