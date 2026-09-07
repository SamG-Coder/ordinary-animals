// Individual Blender modules around the county grounds and third badge encounter.
// Keep the gate, leader and office aligned with the pedestrian route from the junction.
export const BRIARFIELD_ROAD_DETOUR = [[-210, -228], [-175, -242]];

// Use between the Briarfield junction and North Drain, so traffic bypasses the yard.
export function insertBriarfieldRoadDetour(route) {
  return route.flatMap((point, index) =>
    point[0] === -210 && point[1] === -200 && route[index + 1]?.[0] === -45
      ? [point, ...BRIARFIELD_ROAD_DETOUR.map((p) => [...p])]
      : [point],
  );
}

export function buildBriarfield({ place, lamp }) {
  place("groundskeeper-lodge", -193, -217);
  place("weathered-glasshouse", -176, -221, 0, 0, 1, false);
  place("iron-estate-gate", -193, -202.7);
  place("briarfield-grounds-notice", -199.3, -201.8, 0, 0, 1, false);

  // The entrance leaves a 6.3 metre opening. Paths end at the office threshold.
  for (let x = -207; x <= -193; x += 2)
    place("path-2m", x, -200, 0, Math.PI / 2, 1.25, true, 1 / 1.25);
  for (let z = -202; z >= -212; z -= 2)
    place("path-2m", -193, z, 0, 0, 1.45, true, 1 / 1.45);
  for (const x of [-195, -191])
    for (const z of [-207, -211]) place("court-paving-4m", x, z);

  // Separate reusable bed modules make the eastern work garden, leaving the yard open.
  for (const x of [-183, -178, -173])
    for (const z of [-207, -211])
      place("raised-growing-bed", x, z, 0, Math.PI / 2, 1, false);
  // The west edge stops outside the diverted road's full eight-metre width.
  place("stone-wall-4m", -201, -202.7);
  for (const x of [-185, -181, -177, -173])
    place("stone-wall-4m", x, -202.7);
  for (const z of [-206.7, -210.7, -214.7, -218.7, -222.7])
    place("stone-wall-4m", -169, z, 0, Math.PI / 2);
  for (const [x, z, rotation] of [
    [-199.1, -220.5, 0],
    [-170.9, -225.5, 0.1],
  ]) {
    place("wheelie-bin", x, z, 0, rotation);
    place("fallen-leaves", x + .5, z + .5, 0, .3, 1.2);
  }
  place("storm-drain", -188.5, -210.8);
  place("puddle", -189.2, -209.5, .014, .7, 1.6);
  for (const [x, z, scale] of [
    [-205, -188, 1.15],
    [-185, -190, 1.12],
    [-168, -194, 1.25],
    [-162, -210, 1.28],
    [-164, -228, 1.08],
    [-190, -228, 1.05],
  ]) place("oak-tree", x, z, 0, x * .08, scale, false);
  for (const [x, z] of [[-200.5, -206], [-184.5, -212], [-170.5, -204.5]])
    lamp(x, z);
  return {interactions:[{
    id:"briarfield-notice",x:-199.3,z:-201.8,radius:2.2,label:"Read the grounds notice",title:"COUNTY GROUNDS",
    lines:["Children may enter for accredited animal assessment.","The greenhouse is insured. The applicant must make their own arrangements.","Please keep animals away from the beds. The Groundskeeper's goat appears to have an exemption."]
  }]};
}
