// Reviewed world-space placements for the separate Blender terrace-house asset.
// Each generic district keeps six houses, with the full carriageway and leader
// approach reserved. The school district and Ash End's bespoke estate stay put.
export const DISTRICT_HOUSES = [
  // Wickmere: preserve the existing rows south of the county school.
  [
    [-144, 110],
    [-130, 110],
    [-116, 110],
    [-144, 126],
    [-130, 126],
    [-116, 126],
  ],
  // Ash End is authored by buildAshEnd and has no generic terrace rows.
  [],
  // Briarfield: the western rows clear the incoming road and the leader to the east.
  [
    [-253, -208],
    [-239, -208],
    [-225, -208],
    [-253, -224],
    [-239, -224],
    [-225, -224],
  ],
  // North Drain: set back inside the county from the fork's northern boundary.
  [
    [-69, -259],
    [-55, -259],
    [-41, -259],
    [-69, -243],
    [-55, -243],
    [-41, -243],
  ],
  // Blackwood: keep the eastern side of the outgoing road free.
  [
    [123, -221],
    [137, -221],
    [151, -221],
    [123, -205],
    [137, -205],
    [151, -205],
  ],
  // Morrow Quay: both rows stand east of the incoming and outgoing carriageways.
  [
    [293, -38],
    [307, -38],
    [321, -38],
    [293, -22],
    [307, -22],
    [321, -22],
  ],
  // St. Marrow: place the homes inside the bend, clear of its westbound road.
  [
    [215, 186],
    [229, 186],
    [243, 186],
    [215, 202],
    [229, 202],
    [243, 202],
  ],
  // Hollow Crown: preserve the existing rows beyond the southern junction.
  [
    [21, 270],
    [35, 270],
    [49, 270],
    [21, 286],
    [35, 286],
    [49, 286],
  ],
];

export function placeDistrictHousing(index, place) {
  const houses = DISTRICT_HOUSES[index];
  if (!houses) throw new Error(`Unknown housing district ${index}`);
  for (const [x, z] of houses) place("terrace-house-v2", x, z);
}
