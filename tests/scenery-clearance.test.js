import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Group, Scene } from "three";
import { assembleWorld } from "../src/world.js";
import {
  buildPavedSurfaceFilter,
  PAVED_FOOTPRINTS,
} from "../src/scenery-clearance.js";
import { exportedBounds, loadCatalog } from "./lib/scene-geometry.js";

const placement = (asset, x = 0, z = 0, extra = {}) => ({
  asset,
  x,
  z,
  y: 0,
  scale: 1,
  ry: 0,
  stretchZ: 1,
  ...extra,
});

test("all paved footprint constants match their actual Blender exports", () => {
  const catalog = loadCatalog();
  for (const [name, footprint] of Object.entries(PAVED_FOOTPRINTS)) {
    const box = exportedBounds(catalog, name);
    for (const [key, expected] of Object.entries({
      minX: box.min.x,
      maxX: box.max.x,
      minZ: box.min.z,
      maxZ: box.max.z,
    }))
      assert.ok(
        Math.abs(footprint[key] - expected) < 1e-6,
        `${name} ${key} changed in Blender`,
      );
  }
});

test("the actual village road catches the reported asphalt grass location", () => {
  const catalog = loadCatalog();
  const assets = Object.fromEntries(
    Object.keys(catalog).map((name) => [
      name,
      { scene: new Group(), animations: [] },
    ]),
  );
  const bedroom = JSON.parse(
    readFileSync(
      new URL("../game-assets/bedroom-layout.json", import.meta.url),
    ),
  );
  const world = assembleWorld(new Scene(), assets, catalog, bedroom);
  const filter = buildPavedSurfaceFilter(world.placementLog);
  assert.ok(filter.surfaceCount > 0);
  assert.equal(filter.isPaved(19, -12), true);
  assert.equal(filter.isPaved(19, -12, 0.45), true);
  const grass = world.placementLog.filter(p => p.asset === "grass-clump");
  assert.ok(grass.length > 100, "the world keeps its unpaved vegetation");
  const bounds = exportedBounds(catalog, "grass-clump");
  const sourceRadius = Math.hypot(Math.max(Math.abs(bounds.min.x),Math.abs(bounds.max.x)),
    Math.max(Math.abs(bounds.min.z),Math.abs(bounds.max.z)));
  for (const p of grass)
    assert.equal(filter.isPaved(p.x,p.z,sourceRadius*p.scale),false,
      `grass overlaps the finished road/path at ${p.x},${p.z}`);
});

test("road edges and circular plant radii include contact but preserve nearby soil", () => {
  const filter = buildPavedSurfaceFilter([
    placement("road-straight-12m", 16, -6),
  ]);
  assert.equal(filter.isPaved(20, -6), true);
  assert.equal(filter.isPaved(20.01, -6), false);
  assert.equal(filter.isPaved(20.4, -6, 0.4), true);
  assert.equal(filter.isPaved(20.41, -6, 0.4), false);
  assert.equal(filter.isPaved(20.3, 0.3, 0.4), false);
  assert.equal(filter.isPaved(20.3, 0.3, 0.43), true);
});

test("uniform scaling, quarter-turn rotation and stretched path length preserve metre-based radius", () => {
  const filter = buildPavedSurfaceFilter([
    placement("path-2m", 10, 20, { scale: 2, stretchZ: 3, ry: Math.PI / 2 }),
  ]);
  assert.equal(filter.isPaved(15.9, 20), true);
  assert.equal(filter.isPaved(16.2, 20), false);
  assert.equal(filter.isPaved(16.2, 20, 0.2), true);
  assert.equal(filter.isPaved(10, 21.6), true);
  assert.equal(filter.isPaved(10, 21.81, 0.2), false);
});

test("diagonal slabs do not mistake an enclosing world AABB for paved ground", () => {
  const filter = buildPavedSurfaceFilter([
    placement("path-2m", 10, 20, { stretchZ: 6, ry: Math.PI / 4 }),
  ]);
  assert.equal(filter.isPaved(14, 24), true);
  assert.equal(filter.isPaved(14, 16), false);
  assert.equal(filter.isPaved(14, 16, 0.5), false);
});

test("asymmetric kerbs, flipped scales and zero-size surfaces are handled explicitly", () => {
  const normal = buildPavedSurfaceFilter([placement("pavement-4m")]);
  assert.equal(normal.isPaved(-1.04, 0), true);
  assert.equal(normal.isPaved(1.04, 0), false);
  const flipped = buildPavedSurfaceFilter([
    placement("pavement-4m", 0, 0, { scale: -1 }),
  ]);
  assert.equal(flipped.isPaved(1.04, 0), true);
  assert.equal(flipped.isPaved(-1.04, 0), false);
  assert.equal(
    buildPavedSurfaceFilter([placement("path-2m", 0, 0, { stretchZ: 0 })])
      .surfaceCount,
    0,
  );
});

test("unrelated scenery is ignored and invalid queries cannot silently pass", () => {
  const filter = buildPavedSurfaceFilter([
    placement("ground-tile-40m"),
    placement("terrace-house-v2"),
    placement("grass-clump"),
  ]);
  assert.equal(filter.surfaceCount, 0);
  assert.equal(filter.isPaved(0, 0, 3), false);
  assert.throws(() => filter.isPaved(0, 0, -1), TypeError);
  assert.throws(() => filter.isPaved(NaN, 0), TypeError);
  assert.throws(
    () => buildPavedSurfaceFilter([placement("path-2m", 0, 0, { scale: NaN })]),
    TypeError,
  );
});
