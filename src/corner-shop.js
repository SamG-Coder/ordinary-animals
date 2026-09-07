// Reusable Blender fixtures and existing wall/floor/roof pieces form the shop.
export const CORNER_SHOP_ROOM = {
  id: "mercy-general-stores", label: "Mercy General Stores",
  minX: -46, maxX: -38, minZ: 3, maxZ: 11,
};
export const CORNER_SHOP_ENTRANCE = { x: -42, z: 11, width: 1.44 };
export const CORNER_SHOP_INTERACTIONS = [
  {
    id: "mercy-shop-counter", kind: "shop", x: -42, z: 5.3, radius: 1.55,
    label: "Use the supply counter", title: "MERCY GENERAL STORES",
    lines: ["The counter is unattended. The terminal is open.", "County policy considers ten old enough to make binding purchases.", "Carriers and field medkits are sold here. Your balance is the only supervision provided."],
  },
  {
    id: "mercy-shop-shelves", kind: "inspect", x: -45.05, z: 8.2, radius: 1.35,
    label: "Inspect the league supplies", title: "APPROVED STOCK",
    lines: ["Feed tins. Folded carriers. Field medkits in school-lunch colours.", "The price labels say LEAGUE APPROVED. None of the packaging says CHILD SAFE.", "Purchases are handled at the unattended counter at the back."],
  },
  {
    id: "mercy-pharmacy", kind: "inspect", x: -44.5, z: 3.8, radius: 1.25,
    label: "Read the pharmacy notice", title: "ANIMALS ONLY",
    lines: ["The locked cabinet holds dressings and small animal first-aid supplies.", "The sign directs injured children to their school office.", "Your absence form has already been approved for the rest of term."],
  },
  {
    id: "mercy-shop-notice", kind: "inspect", x: -44.1, z: 11.25, radius: 1.45,
    label: "Read the shop notice", title: "SELF SERVICE",
    lines: ["TEN IS OLD ENOUGH TO MAKE A PURCHASE. APPARENTLY.", "Open all hours. Staffed none of them.", "The shop has replaced safeguarding with a payment terminal."],
  },
];

export function buildCornerShop({ place }) {
  for (const x of [-44, -40]) for (const z of [5, 9]) {
    place("domestic-tile-floor-4m", x, z);
    place("ceiling-4m", x, z, 3);
  }
  // The existing roof export is 4.3m wide including its eaves; align those
  // actual edges instead of overlapping the metal skins on a 4m floor grid.
  for (const x of [-44.15, -39.85]) for (const z of [4.85, 9.15])
    place("roof-4m", x, z, 3.2);
  for (const x of [-44, -40]) {
    place("wall-4m", x, 3);
    place("exterior-wall-4m", x, 2.85);
  }
  for (const z of [5, 9]) {
    place("wall-4m", -46, z, 0, Math.PI / 2);
    place("exterior-wall-4m", -46.15, z, 0, Math.PI / 2);
    place("wall-4m", -38, z, 0, -Math.PI / 2);
    place("exterior-wall-4m", -37.85, z, 0, -Math.PI / 2);
  }
  place("corner-shopfront8m", -42, 11);
  place("corner-shop-sign", -44.1, 11.13, 1.05);
  place("corner-shop-counter", -42, 4.4);
  place("corner-shop-pharmacy", -44.5, 3.22, 1.22);
  for (const z of [5.8, 8.2]) {
    place("corner-shop-shelf", -45.58, z, 0, Math.PI / 2);
    place("corner-shop-shelf", -38.42, z, 0, -Math.PI / 2);
  }
  // The same two-metre path modules meet edge-to-edge, never overlapping.
  place("path-2m", -42, 12, .003);
  place("path-2m", -42, 14, .003);
  place("interior-ceiling-light", -42, 6, 2.98);
  place("interior-ceiling-light", -42, 9, 2.98);
  return {
    rooms: [{ ...CORNER_SHOP_ROOM }],
    lights: [
      { x: -42, z: 6, y: 2.36, color: 0xd6dfb9, power: 60 },
      { x: -42, z: 9, y: 2.36, color: 0xd6dfb9, power: 54 },
    ],
    interactions: CORNER_SHOP_INTERACTIONS.map((item) => ({ ...item, lines: [...item.lines] })),
    entrance: { ...CORNER_SHOP_ENTRANCE },
    counterApproach: { x: -42, z: 6.3 },
    floorHeight: 0,
  };
}
