import * as THREE from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { buildRouteOne } from "./route-one.js";

// Placement only. All meshes, UVs, surface images and object animation come from Blender files.
export function assembleWorld(scene, assets, catalog, roomLayout) {
  const root = new THREE.Group();
  root.name = "Assembled modular world";
  scene.add(root);
  const collisions = [],
    animated = [],
    placementLog = [],
    batchPlacements = new Map();
  const towns = [
    [-120, 90],
    [-250, -20],
    [-210, -200],
    [-45, -295],
    [155, -245],
    [275, -60],
    [220, 160],
    [45, 250],
  ].map(([x, z], i) => ({
    x,
    z,
    gymX: x + (i === 0 ? 27 : 17),
    gymZ: z - (i === 0 ? 38 : 9),
  }));
  function colliders(name, x, z, ry, sx = 1, sz = sx) {
    for (const c of catalog[name]?.colliders || []) {
      const cos = Math.cos(ry),
        sin = Math.sin(ry);
      collisions.push({
        x: x + c.x * sx * cos + c.z * sz * sin,
        z: z - c.x * sx * sin + c.z * sz * cos,
        w: Math.abs(c.w * sx * cos) + Math.abs(c.d * sz * sin),
        d: Math.abs(c.w * sx * sin) + Math.abs(c.d * sz * cos),
      });
    }
  }
  function place(
    name,
    x = 0,
    z = 0,
    y = 0,
    ry = 0,
    scale = 1,
    batch = true,
    stretchZ = 1,
  ) {
    if (!assets[name]) throw new Error(`Missing Blender asset: ${name}`);
    const transform = { x, y, z, ry, scale, stretchZ };
    placementLog.push({ asset: name, ...transform });
    colliders(name, x, z, ry, scale, scale * stretchZ);
    if (batch && !assets[name].animations.length) {
      if (!batchPlacements.has(name)) batchPlacements.set(name, []);
      batchPlacements.get(name).push(transform);
      return null;
    }
    const obj = clone(assets[name].scene);
    obj.position.set(x, y, z);
    obj.rotation.y = ry;
    obj.scale.set(scale, scale, scale * stretchZ);
    root.add(obj);
    if (assets[name].animations.length) {
      const mixer = new THREE.AnimationMixer(obj);
      assets[name].animations.forEach((c) => mixer.clipAction(c).play());
      animated.push({
        root: obj,
        mixer,
        stationary: true,
        scenery: true,
        actions: {},
      });
    }
    return obj;
  }
  // Four floor modules and matching ceilings make a room; no merged bedroom asset is loaded.
  for (const x of [-2, 2])
    for (const z of [-2, 2]) {
      place("floor-4m", x, z);
      place("ceiling-4m", x, z, 3.0);
      place("roof-4m", x, z, 3.2);
    }
  for (const x of [-4, 4])
    for (const z of [-2, 2]) {
      place("wall-4m", x, z, 0, x < 0 ? Math.PI / 2 : -Math.PI / 2);
      place("exterior-wall-4m", x + (x < 0 ? -0.13 : 0.13), z, 0, Math.PI / 2);
    }
  place("wall-window-4m", 0, -4);
  for (const x of [-3, 3]) place("wall-4m", x, -4, 0, 0, 0.5);
  place("wall-door-4m", 0, 4);
  for (const x of [-3, 3]) place("wall-4m", x, 4, 0, Math.PI, 0.5);
  // Half-width modules need full room height; compensate the instance scale in batching below.
  for (const item of roomLayout)
    place(
      item.asset,
      item.x,
      item.z,
      item.y,
      0,
      1,
      !["bedside-lamp", "desk-lamp", "curtains"].includes(item.asset),
    );
  place("school-backpack", 1.25, 3.12, 0, -0.35);
  place("school-shoes", 0.7, 2.95, 0, 0.2);
  place("notice-board", -3.86, -0.5, 0.3, Math.PI / 2);
  place("radiator", 0.6, -3.78);
  place("socket", -0.5, -3.88, 0.25);
  place("socket", 3.87, 1.8, 0.25, -Math.PI / 2);
  // A hallway between the bedroom and front door, instead of exiting directly onto the lawn.
  place("floor-4m", 0, 6);
  place("ceiling-4m", 0, 6, 3.0);
  place("roof-4m", 0, 6, 3.2);
  place("wall-4m", -2, 6, 0, Math.PI / 2);
  place("wall-4m", 2, 6, 0, -Math.PI / 2);
  place("wall-door-4m", 0, 8, 0, Math.PI);
  place("exterior-wall-4m", -2.13, 6, 0, Math.PI / 2);
  place("exterior-wall-4m", 2.13, 6, 0, Math.PI / 2);
  place("porch-step", 0, 8.55);
  place("porch-canopy", 0, 8.6);
  place("hall-table", -1.74, 6, 0, Math.PI / 2);
  for (let z = 10; z < 20; z += 2) place("path-2m", 0, z);
  place("clinic-building", 24, -23);
  for (const [x, z] of [
    [-22, -7],
    [-36, -7],
    [-50, -7],
    [-65, 38],
    [-49, 38],
    [-33, 38],
    [29, 38],
    [44, 38],
    [59, 38],
    [47, -23],
    [64, -23],
  ])
    place("terrace-house", x, z, 0, z > 20 ? Math.PI : 0);
  for (let z = -16; z <= 18; z += 12) place("road-straight-12m", 12, z);
  for (let x = -84; x <= 84; x += 12)
    place("road-straight-12m", x, 20, 0, Math.PI / 2);
  place("road-junction-12m", 12, 20, 0.05);
  for (let x = -76; x < 78; x += 4) {
    place("pavement-4m", x, 14.8, 0, Math.PI / 2);
    place("pavement-4m", x, 25.2, 0, -Math.PI / 2);
  }
  for (let z = 0; z <= 12; z += 2) place("path-2m", 24, z - 14, 0, 0, 1);
  for (const x of [-6, 6])
    for (let z = 0; z < 10; z += 3) place("fence-3m", x, z, 0, Math.PI / 2);
  for (let x = -75; x <= 80; x += 16) {
    place("utility-pole", x, 26);
    place("wire-span-16m", x, 26, 7.5, Math.PI / 2);
  }
  const lamps = [];
  function lamp(x, z, ry = 0) {
    place("streetlamp", x, z, 0, ry);
    lamps.push({ x, z, y: 5.65 });
  }
  for (const x of [-60, -28, 4, 36, 68]) lamp(x, 14);
  lamp(18, -12, Math.PI / 2);
  place("county-sign", -9, 14, 0, 0.16);
  place("notice-board", 21.3, -17.87, 0.12);
  for (const [x, z, ry] of [
    [-5, 7, 0.15],
    [-25, 0, 0.2],
    [-39, 0, -0.2],
    [31, 32, 3.2],
    [49, 32, 3],
    [29, -17, 0],
  ]) {
    place("wheelie-bin", x, z, 0, ry);
    place("fallen-leaves", x - 0.65, z + 0.2);
  }
  for (const x of [-66, -34, -2, 30, 62]) {
    place("storm-drain", x, 15.75);
    place("puddle", x + 1.3, 16.2, 0, 0.3, 1.7);
    place("fallen-leaves", x - 1, 14.5, 0, 1.1, 1.2);
  }
  for (const [x, z, s] of [
    [0, 11, 0.8],
    [7, 20, 1.8],
    [15, -9, 1.2],
    [24, -12, 1.4],
    [-10, 24, 2.1],
  ])
    place("puddle", x, z, 0, x * 0.3, s);
  // Other sections reuse the same small exported building and road assets.
  for (const [index, t] of towns.entries()) {
    place(
      index === 0 ? "county-school" : "league-building",
      t.gymX,
      t.gymZ - 8,
    );
    for (const [dx, dz] of [
      [-24, 20],
      [-10, 20],
      [4, 20],
      [-24, 36],
      [-10, 36],
      [4, 36],
    ])
      place("terrace-house", t.x + dx, t.z + dz);
    lamp(t.x - 7, t.z - 7);
    lamp(t.x + 8, t.z + 7);
  }
  const route = [[0, 20], ...towns.map((t) => [t.x, t.z]), [0, 20]];
  for (let j = 0; j < route.length - 1; j++) {
    const [ax, az] = route[j],
      [bx, bz] = route[j + 1],
      dx = bx - ax,
      dz = bz - az,
      length = Math.hypot(dx, dz),
      count = Math.ceil(length / 12),
      step = length / count,
      angle = Math.atan2(dx, dz);
    for (let i = 0; i < count; i++)
      place(
        "road-straight-12m",
        ax + (dx * (i + 0.5)) / count,
        az + (dz * (i + 0.5)) / count,
        0.012,
        angle,
        1,
        true,
        step / 12,
      );
    place("road-junction-12m", ax, az, 0.05);
  }
  for (let x = -580; x <= 580; x += 40)
    for (let z = -580; z <= 580; z += 40) place("ground-tile-40m", x, z);
  const random = (() => {
    let seed = 1337;
    return () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  })();
  function roadDistance(x, z) {
    let best = Infinity;
    for (let i = 0; i < route.length - 1; i++) {
      const [ax, az] = route[i],
        [bx, bz] = route[i + 1],
        dx = bx - ax,
        dz = bz - az,
        t = Math.max(
          0,
          Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)),
        );
      best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
    }
    return best;
  }
  const clear = (x, z) =>
    Math.hypot(x, z) < 95 ||
    roadDistance(x, z) < 13 ||
    towns.some((t) => Math.hypot(x - t.x, z - t.z) < 60);
  for (let i = 0; i < 650; i++) {
    const x = random() * 1100 - 550,
      z = random() * 1100 - 550;
    if (clear(x, z)) continue;
    place(
      "pine-" + ((i % 3) + 1),
      x,
      z,
      0,
      random() * 6.28,
      0.8 + random() * 0.8,
    );
  }
  for (const [x, z, s] of [
    [-7, -7, 1.1],
    [6, -7, 1.1],
    [-10, -15, 0.9],
    [9, -14, 1.3],
    [-16, -27, 1.4],
    [4, -28, 1.2],
    [17, -37, 1.6],
    [37, -35, 1.2],
    [-8, 32, 1.3],
    [-14, 40, 1.6],
    [8, 43, 1.3],
    [75, 8, 1.3],
    [-80, 9, 1.4],
  ])
    place("birch", x, z, 0, 0, s);
  for (let i = 0; i < 480; i++) {
    const x = random() * 210 - 105,
      z = random() * 120 - 50;
    if (
      Math.abs(z - 20) < 7 ||
      Math.abs(x - 12) < 6 ||
      collisions.some(
        (c) =>
          Math.abs(x - c.x) < c.w / 2 + 0.5 &&
          Math.abs(z - c.z) < c.d / 2 + 0.5,
      ) ||
      (Math.abs(x) < 5 && Math.abs(z) < 12)
    )
      continue;
    place("grass-clump", x, z, 0, random() * 6.28, 0.6 + random() * 0.8);
  }
  for (let i = 0; i < 45; i++) {
    const x = random() * 1000 - 500,
      z = random() * 1000 - 500;
    if (clear(x, z)) continue;
    place("rock", x, z, 0, random() * 6.28, 0.6 + random());
  }

  buildRouteOne({ place, lamp });
  const chunks = new Map();
  function chunk(x, z) {
    const cx = Math.floor(x / 80),
      cz = Math.floor(z / 80),
      key = `${cx},${cz}`;
    if (!chunks.has(key)) {
      const g = new THREE.Group();
      g.userData.center = { x: cx * 80 + 40, z: cz * 80 + 40 };
      root.add(g);
      chunks.set(key, g);
    }
    return chunks.get(key);
  }
  // Bake source transforms and batch repeated copies by asset/material inside nearby spatial chunks.
  for (const [name, placements] of batchPlacements) {
    const source = assets[name].scene;
    source.updateMatrixWorld(true);
    const groups = new Map();
    source.traverse((o) => {
      if (!o.isMesh) return;
      const geometry = o.geometry.clone();
      geometry.applyMatrix4(o.matrixWorld);
      for (const key of Object.keys(geometry.attributes))
        if (!["position", "normal", "uv"].includes(key))
          geometry.deleteAttribute(key);
      if (!geometry.getAttribute("uv"))
        geometry.setAttribute(
          "uv",
          new THREE.BufferAttribute(
            new Float32Array(geometry.getAttribute("position").count * 2),
            2,
          ),
        );
      const key = o.material.uuid;
      if (!groups.has(key)) groups.set(key, { material: o.material, geo: [] });
      groups
        .get(key)
        .geo.push(geometry.index ? geometry.toNonIndexed() : geometry);
    });
    for (const { material, geo } of groups.values()) {
      const merged = mergeGeometries(geo);
      const placementChunks = new Map();
      for (const p of placements) {
        const group = chunk(p.x, p.z);
        if (!placementChunks.has(group)) placementChunks.set(group, []);
        placementChunks.get(group).push(p);
      }
      for (const [chunkGroup, localPlacements] of placementChunks) {
        const instanced = new THREE.InstancedMesh(
          merged,
          material,
          localPlacements.length,
        );
        instanced.name = name;
        instanced.castShadow = ![
          "ground-tile-40m",
          "grass-clump",
          "road-straight-12m",
          "road-junction-12m",
          "path-2m",
          "pavement-4m",
        ].includes(name);
        instanced.receiveShadow = true;
        const dummy = new THREE.Object3D();
        localPlacements.forEach((p, i) => {
          dummy.position.set(p.x, p.y, p.z);
          dummy.rotation.set(0, p.ry, 0);
          dummy.scale.set(
            p.scale,
            name === "wall-4m" ? 1 : p.scale,
            p.scale * p.stretchZ,
          );
          dummy.updateMatrix();
          instanced.setMatrixAt(i, dummy.matrix);
        });
        instanced.computeBoundingSphere();
        chunkGroup.add(instanced);
      }
      geo.forEach((g) => g.dispose());
    }
  }
  return {
    root,
    animated,
    placementLog,
    updateVisibility(position) {
      for (const g of chunks.values()) {
        const c = g.userData.center;
        g.visible = Math.hypot(c.x - position.x, c.z - position.z) < 170;
      }
    },
    info: {
      size: 1200,
      towns,
      collisions,
      lights: lamps,
      terrain: { size: 1200, segments: 1, heights: [0, 0, 0, 0] },
    },
    place,
  };
}
