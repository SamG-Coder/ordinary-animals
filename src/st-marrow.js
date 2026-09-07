export const ST_MARROW = {
  junction: [220, 160],
  leader: [237, 151],
  school: [237, 143],
  incoming: [275, -60],
  outgoing: [86, 268],
};
export const ST_MARROW_INTERACTIONS = [
  {
    id: "st-marrow-notice",
    x: 231.1,
    z: 158,
    radius: 2.2,
    title: "PARENT INFORMATION",
    label: "Read the school circulars",
    lines: [
      "Thirty days absent? Please report for animal assessment.",
      "The safeguarding notice says all concerns have been referred to the child.",
      "You are standing next to a hopscotch grid. There is no lesson today.",
    ],
  },
  {
    id: "st-marrow-bikes",
    x: 250.2,
    z: 139.0,
    radius: 2.3,
    title: "PLEASE COLLECT YOUR CHILD",
    label: "Inspect the abandoned bicycles",
    lines: [
      "Two bicycles have been locked here since term started.",
      "The sign asks parents to collect their children. The League has issued contradictory guidance.",
    ],
  },
  {
    id: "st-marrow-clock",
    x: 237,
    y: 5.66,
    z: 147.292,
    radius: 6,
    title: "THE LAST BELL",
    label: "Look up at the school clock",
    lines: [
      "The school clock is stopped at five past three.",
      "The Headteacher still counts every day you were absent. Apparently wandering the county does not count until you win the badge.",
    ],
  },
];

export function buildStMarrow({ place, lamp }) {
  place("st-marrow-school-block", ...ST_MARROW.school);
  place("school-entrance-gates", 237, 156.8);
  place("school-play-court", 237, 152);
  place("school-play-court", 253.4, 147.0, 0, Math.PI / 2);
  place("school-bike-shelter", 250.2, 137.2);
  place("st-marrow-notice", 231.1, 158, 0, 0.02, 1, false);
  for (let x = 225; x <= 237; x += 2)
    place("path-2m", x, 160, 0, Math.PI / 2, 1.3, true, 1 / 1.3);
  place("path-2m", 237, 158, 0, 0, 1.45, true, 1 / 1.45);
  for (let x = 244; x <= 250; x += 2)
    place("path-2m", x, 151, 0, Math.PI / 2, 1.1, true, 1 / 1.1);
  for (const x of [228, 231]) place("estate-railing-3m", x, 156.8);
  for (const x of [243, 246, 249, 252, 255, 258])
    place("estate-railing-3m", x, 156.8);
  for (const z of [153.8, 150.8, 147.8, 144.8, 141.8, 138.8, 135.8])
    place("estate-railing-3m", 260, z, 0, Math.PI / 2);
  for (const x of [246, 249, 252, 255, 258])
    place("estate-railing-3m", x, 133.8);
  for (const [x, z] of [
    [228.8, 153.8],
    [243.4, 154.5],
    [258.3, 142.0],
  ])
    lamp(x, z);
  place("wheelie-bin", 245.5, 140.0, 0, Math.PI / 2);
  place("wheelie-bin", 245.5, 139.2, 0, Math.PI / 2);
  place("storm-drain", 246.8, 152.7);
  place("storm-drain", 242.8, 149.0);
  place("puddle", 245.8, 151.8, 0.011, 0.6, 1.4);
  for (const [x, z, scale] of [
    [246.5, 129.5, 1.2],
    [257.5, 129.0, 1.13],
    [266.0, 135.0, 1.08],
    [269.0, 155.0, 1.15],
    [251.5, 167.5, 1.12],
  ])
    place("oak-tree", x, z, 0, z * 0.03, scale, false);
  for (const [x, z] of [
    [233, 157],
    [248, 138],
    [259, 153],
  ])
    place("fallen-leaves", x, z, 0, x * 0.1, 1.6);
  return { interactions: ST_MARROW_INTERACTIONS, ...ST_MARROW };
}
