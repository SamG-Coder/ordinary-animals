import test from "node:test";
import assert from "node:assert/strict";
import { Box3, Ray, Vector3 } from "three";
import {
  loadCatalog,
  exportedBounds,
  collectScene,
  overlapsRoad,
} from "../tests/lib/scene-geometry.js";
import {
  buildStMarrow,
  ST_MARROW,
  ST_MARROW_INTERACTIONS,
} from "../src/st-marrow.js";
import { placeDistrictHousing } from "../src/district-housing.js";

const catalog = loadCatalog();

test("St Marrow's gates, court and Headteacher approach remain walkable", () => {
  const { blocked, placements } = collectScene(buildStMarrow, catalog);
  const clear = (x, z) =>
    assert.ok(!blocked(x, z), `${blocked(x, z)?.name} blocks ${x}, ${z}`);
  for (let x = 220; x <= 237; x += 0.1) clear(x, 160);
  for (let z = 160; z >= 148; z -= 0.1) clear(237, z);
  for (let x = 234; x <= 240; x += 0.2)
    for (let z = 148; z <= 154; z += 0.2) clear(x, z);
  for (const item of ST_MARROW_INTERACTIONS) clear(item.x, item.z + 1.4);
  for (const [a, b] of [
    [ST_MARROW.incoming, ST_MARROW.junction],
    [ST_MARROW.junction, ST_MARROW.outgoing],
  ]) {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz);
    for (let i = 0; i <= Math.ceil(length * 3); i++)
      for (const side of [-3.8, 0, 3.8]) {
        const t = i / Math.ceil(length * 3);
        clear(
          a[0] + dx * t - (dz / length) * side,
          a[1] + dz * t + (dx / length) * side,
        );
      }
  }
  assert.equal(
    placements.filter((p) => p.name === "school-play-court").length,
    2,
  );
});

test("St Marrow exported buildings and schoolyard landmarks avoid roads, junction and homes", () => {
  const { placements } = collectScene(buildStMarrow, catalog);
  const architecture = new Set([
    "st-marrow-school-block",
    "school-entrance-gates",
    "school-play-court",
    "school-bike-shelter",
    "st-marrow-notice",
  ]);
  const houses = [];
  placeDistrictHousing(6, (name, x, z) =>
    houses.push(exportedBounds(catalog, name).translate(new Vector3(x, 0, z))),
  );
  const junction = new Box3(
    new Vector3(214, -100, 154),
    new Vector3(226, 100, 166),
  );
  for (const p of placements.filter((p) => architecture.has(p.name))) {
    const box = exportedBounds(catalog, p.name).applyMatrix4(p.matrix);
    assert.equal(
      overlapsRoad(box, ST_MARROW.incoming, ST_MARROW.junction),
      false,
      `${p.name} overhangs incoming road`,
    );
    assert.equal(
      overlapsRoad(box, ST_MARROW.junction, ST_MARROW.outgoing),
      false,
      `${p.name} overhangs outgoing road`,
    );
    assert.equal(
      box.intersectsBox(junction),
      false,
      `${p.name} occupies the road junction`,
    );
    for (const house of houses)
      assert.equal(
        box.intersectsBox(house),
        false,
        `${p.name} overlaps an existing house`,
      );
  }
});

test("The school court's exported paint stays at the flat walking grade", () => {
  const court = exportedBounds(catalog, "school-play-court");
  assert.ok(court.min.y >= -0.001, "The court base sinks below the terrain");
  assert.ok(
    court.max.y <= 0.025,
    `Raised court geometry would clip grounded feet at ${court.max.y}m`,
  );
  assert.equal(catalog["school-play-court"].colliders?.length ?? 0, 0);
});

test("looking up at the exported school clock finds its target from the open courtyard", () => {
  const { placements, blocked } = collectScene(buildStMarrow, catalog);
  const school = placements.find((p) => p.name === "st-marrow-school-block");
  const clock = exportedBounds(
    catalog,
    school.name,
    (node) => node.name === "School clock dial",
  ).applyMatrix4(school.matrix);
  const canopy = exportedBounds(
    catalog,
    school.name,
    (node) => node.name === "Concrete entrance canopy",
  ).applyMatrix4(school.matrix);
  const face = clock.getCenter(new Vector3());
  const item = ST_MARROW_INTERACTIONS.find(
    (target) => target.id === "st-marrow-clock",
  );
  const target = new Vector3(item.x, item.y, item.z);
  assert.ok(
    Number.isFinite(item.y),
    "The clock needs its own interaction height",
  );
  assert.ok(
    target.distanceTo(face) < 0.01,
    "Clock target must remain on its actual Blender-exported dial",
  );

  // These standing positions are inside the six-metre battle apron. Check the
  // real view direction and three-dimensional reach, not just ground distance.
  for (const z of [149.5, 150.2, 151]) {
    const eye = new Vector3(237, 1.25, z);
    assert.ok(
      !blocked(eye.x, eye.z),
      `Clock reading position ${z} is obstructed`,
    );
    const direction = face.clone().sub(eye).normalize();
    const toTarget = target.clone().sub(eye);
    assert.ok(
      Math.asin(direction.y) <= 1.3,
      "The clock is above the player's look limit",
    );
    assert.ok(
      toTarget.length() < item.radius,
      `Clock target is out of three-dimensional reach from ${z}`,
    );
    assert.ok(
      toTarget.normalize().dot(direction) > 0.45,
      "Looking at the clock does not select its interaction",
    );
    const canopyHit = new Ray(eye, direction).intersectBox(
      canopy,
      new Vector3(),
    );
    assert.ok(
      !canopyHit || eye.distanceTo(canopyHit) >= eye.distanceTo(face),
      "The entrance canopy hides the clock from its reading position",
    );
  }
});
