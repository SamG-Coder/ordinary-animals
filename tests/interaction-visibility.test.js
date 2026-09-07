import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Group, Scene } from "three";
import { assembleWorld } from "../src/world.js";
import {
  createInteractionVisibility,
  INTERACTION_OCCLUDER_HEIGHTS,
} from "../src/interaction-visibility.js";
import { exportedBounds, loadCatalog } from "./lib/scene-geometry.js";

const catalog = loadCatalog();
const openDoors = { doorOpen: true, frontOpen: true };
const point = (x, y, z, id) => ({ x, y, z, id });
const placement = (asset, x, z, extra = {}) => ({
  asset,
  x,
  z,
  y: 0,
  ry: 0,
  scale: 1,
  stretchZ: 1,
  ...extra,
});

test("the bedroom wall hides home-photo from the reported diagonal position", () => {
  const sight = createInteractionVisibility(
    [placement("wall-4m", 3, 4, { scale: 0.5, ry: Math.PI })],
    catalog,
  );
  const photo = point(4.1, 0.85, 4.4, "home-photo");
  assert.equal(sight.visible(point(3.3, 1.25, 3.5), photo, openDoors), false);
  assert.equal(sight.visible(point(3.3, 1.25, 4.8), photo, openDoors), true);
  // Half-width partition pieces keep their 3m wall height in world.js.
  assert.equal(
    sight.visible(point(3, 2.5, 3.5), point(3, 2.5, 4.5), openDoors),
    false,
  );
});

test("the actual assembled world blocks the bedroom photo shortcut and retains its normal approach", () => {
  const assets = Object.fromEntries(
    Object.keys(catalog).map((name) => [name, { scene: new Group(), animations: [] }]),
  );
  const bedroom = JSON.parse(
    readFileSync(new URL("../game-assets/bedroom-layout.json", import.meta.url)),
  );
  const world = assembleWorld(new Scene(), assets, catalog, bedroom);
  const sight = createInteractionVisibility(world.placementLog, catalog);
  const photoInfo = world.info.interiors.interactions.find((target) => target.id === "home-photo");
  assert.ok(photoInfo, "Missing actual home-photo interaction");
  // main.js gives inspect interactions a default target height of 0.85m.
  const photo = { ...photoInfo, y: photoInfo.y ?? .85 };
  assert.equal(sight.visible(point(3.3, 1.25, 3.5), photo, openDoors), false);
  assert.equal(sight.visible(point(3.3, 1.25, 4.8), photo, openDoors), true);
});

test("parallel, tangent, vertical and above-wall segments use all three slab axes", () => {
  const sight = createInteractionVisibility(
    [placement("wall-4m", 10, 10)],
    catalog,
  );
  assert.equal(sight.visible(point(7, 1, 9), point(13, 1, 9), openDoors), true);
  assert.equal(
    sight.visible(point(8, 1, 9), point(8, 1, 11), openDoors),
    false,
  );
  assert.equal(
    sight.visible(point(10, 3.2, 9), point(10, 3.2, 11), openDoors),
    true,
  );
  assert.equal(
    sight.visible(point(10, 4, 10), point(10, 2, 10), openDoors),
    false,
  );
  assert.equal(
    sight.visible(point(10, 1, 9), point(10, 1, 9), openDoors),
    true,
  );
  assert.equal(
    sight.visible(point(10, 1, 9), point(NaN, 1, 9), openDoors),
    false,
  );
});

test("wall-mounted targets tolerate only the final 15cm, not an intervening wall", () => {
  const sight = createInteractionVisibility(
    [placement("wall-4m", 10, 10)],
    catalog,
  );
  const from = point(10, 1.25, 8);
  assert.equal(sight.visible(from, point(10, 1, 10), openDoors), true);
  assert.equal(sight.visible(from, point(10, 1, 10.4), openDoors), false);
});

test("both closed door leaves block beyond them but allow their own interaction", () => {
  const sight = createInteractionVisibility(
    [placement("wall-door-4m", 0, 4), placement("wall-door-4m", 0, 8)],
    catalog,
  );
  assert.equal(sight.visible(point(0, 1.25, 3), point(0, 1, 5)), false);
  assert.equal(
    sight.visible(point(0, 1.25, 3), point(0, 1, 5), openDoors),
    true,
  );
  assert.equal(
    sight.visible(point(0, 1.25, 5), point(0, 1.2, 4, "door")),
    true,
  );
  assert.equal(
    sight.visible(point(0, 1.25, 7), point(0, 1, 9), { doorOpen: true }),
    false,
  );
  assert.equal(
    sight.visible(point(0, 1.25, 9), point(0, 1.2, 8, "front-door")),
    true,
  );
  // Exempting the destination door must not exempt an earlier closed door.
  assert.equal(
    sight.visible(point(0, 1.25, 3), point(0, 1.2, 8, "front-door")),
    false,
  );
  assert.equal(
    sight.visible(point(1.3, 1.25, 3), point(1.3, 1, 5), openDoors),
    false,
  );
});

test("scaled, stretched, rotated and raised colliders use world.js conventions", () => {
  const fixture = {
    "wall-door-4m": { colliders: [{ x: 1, z: 0.5, w: 2, d: 0.2 }] },
  };
  const sight = createInteractionVisibility(
    [
      placement("wall-door-4m", 20, 20, {
        y: 5,
        ry: Math.PI / 2,
        scale: 2,
        stretchZ: 3,
      }),
    ],
    fixture,
  );
  // Centre=(23,18), width=1.2, depth=4; top=11 because this asset scales Y.
  assert.equal(
    sight.visible(point(21, 6, 18), point(25, 6, 18), openDoors),
    false,
  );
  assert.equal(
    sight.visible(point(21, 4, 18), point(25, 4, 18), openDoors),
    true,
  );
  assert.equal(
    sight.visible(point(21, 12, 18), point(25, 12, 18), openDoors),
    true,
  );
});

test("furniture, paths, terrain, open railings and the glasshouse remain transparent", () => {
  const names = [
    "wardrobe",
    "desk",
    "path-2m",
    "ground-tile-40m",
    "estate-railing-3m",
    "weathered-glasshouse",
  ];
  const sight = createInteractionVisibility(
    names.map((name) => placement(name, 10, 10)),
    catalog,
  );
  assert.equal(sight.occluderCount, 0);
  assert.equal(
    sight.visible(point(10, 1.25, 8), point(10, 1, 12), openDoors),
    true,
  );
});

test("every selected architectural occluder has real catalog footprints and verified Blender height", () => {
  for (const [name, height] of Object.entries(INTERACTION_OCCLUDER_HEIGHTS)) {
    assert.ok(catalog[name]?.colliders?.length, name);
    const box = exportedBounds(catalog, name);
    assert.ok(
      height + 1e-6 >= box.max.y,
      `${name}: height understates exported bounds`,
    );
    assert.ok(
      height - box.max.y < 0.002,
      `${name}: height no longer matches Blender source`,
    );
  }
});
