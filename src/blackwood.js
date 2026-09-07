import { WILD_SITES } from "./field-notes.js";

export const BLACKWOOD = {
  junction: [155, -245], leader: [172, -254], lodge: [172, -262],
  incoming: [-45, -295], outgoing: [275, -60],
};
export const BLACKWOOD_INTERACTIONS = [
  {
    id: "blackwood-trail-register", x: 166, z: -246.2, radius: 2.2,
    label: "Read the woodland register", title: "VISITOR RESPONSIBILITY REGISTER",
    lines: ["The trail map marks the ranger station, the way back, and a large area labelled ON YOUR OWN.", "A training waiver says anyone aged ten is well prepared by definition.", "If lost, you are instructed to describe it as fieldwork."],
  },
  {
    id: "blackwood-culvert", x: 162, z: -256.9, radius: 2,
    label: "Inspect the old culvert", title: "WATER UNDER THE TRAIL",
    lines: ["Water threads through an old stone culvert. The masonry has lasted longer than the visitor safety programme.", "The official route continues into the trees. The unofficial route is to go home."],
  },
];

export function buildBlackwood({ place, lamp }) {
  place("ranger-lodge", ...BLACKWOOD.lodge);
  place("timber-trail-gate", 172, -248);
  place("forest-trailboard", 166, -246.2, 0, .07, 1, false);
  place("mossy-stone-culvert", 162, -258.6);
  for (let x = 159; x <= 171; x += 2)
    place("path-2m", x, -245, 0, Math.PI / 2, 1.2, true, 1 / 1.2);
  for (let z = -247; z >= -257; z -= 2)
    place("path-2m", 172, z, 0, 0, 1.45, true, 1 / 1.45);
  for (const x of [170, 174])
    for (const z of [-253, -257]) place("court-paving-4m", x, z);
  for (let x = 164; x <= 168; x += 2)
    place("path-2m", x, -255.5, 0, Math.PI / 2, .9, true, 1 / .9);
  for (const [x, z, angle] of [[164, -250, 0], [182, -249, 0], [186, -249, 0], [188, -260, Math.PI / 2], [188, -264, Math.PI / 2]])
    place("stone-wall-4m", x, z, 0, angle);
  for (const [x, z] of [[164.5, -249], [178.3, -256.6]]) lamp(x, z);

  // Repeated independent trees form three forest edges. Keep a legible open
  // clearing around the gate, lodge, drainage landmark and encounter sites.
  const clusters = [
    [[148, -257], [151, -264], [147, -272], [154, -278], [158, -272], [142, -267]],
    [[164, -278], [169, -274], [175, -280], [181, -275], [186, -282], [174, -289], [163, -288]],
    [[190, -253], [197, -248], [202, -256], [194, -262], [202, -269], [194, -276], [208, -278]],
  ];
  let index = 0;
  for (const cluster of clusters)
    for (const [x, z] of cluster) {
      if (WILD_SITES.some(([wx, wz]) => Math.hypot(x - wx, z - wz) < 7)) continue;
      place(`pine-natural-${(index % 3) + 1}`, x, z, 0, index * .73, 1.15 + (index % 4) * .09);
      if (index % 3 === 0) place("oak-tree", x + 3.6, z - 3.0, 0, index * .31, .9, false);
      if (index % 2 === 0) place("bramble-patch", x + 1.1, z + 1.3, 0, index * .45, 1.12);
      index++;
    }
  for (const [x, z, angle] of [[167, -250.6, .3], [176.8, -250.6, -.2], [160.5, -254, .6], [178.1, -266, 1.1]])
    place("fallen-leaves", x, z, 0, angle, 1.8);
  for (const [x, z] of [[166, -256], [178.5, -258.5], [159.5, -263], [183, -269]])
    place("verge-grass-2m", x, z, 0, x * .02, .95, false);
  return { interactions: BLACKWOOD_INTERACTIONS, ...BLACKWOOD };
}
