import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  STARTERS,
  ENCOUNTERS,
  CHAPTERS,
  SAVE_KEY,
  parseSave,
  startEncounter,
  takeTurn,
} from './game.js';
import './style.css';
import { findPath } from './navigation.js';

const $ = (id) => document.getElementById(id);
const base = import.meta.env.BASE_URL;
const portrait = (name) => `${base}portraits/${name}.png`;
let saved = null;
try {
  saved = parseSave(localStorage.getItem(SAVE_KEY));
} catch {
  /* Private browsing remains playable. */
}
let state = saved || { starter: null, stamps: [], chapter: 0, completed: false };
let playing = false,
  modal = null,
  battle = null,
  activeTarget = null,
  moving = false;
let dialogueQueue = [],
  dialogueCallback = null,
  toastTimer;
let companion,
  player,
  world,
  staticWorld,
  dynamicWorld,
  markers = [],
  collisions = [],
  mixers = [];
let destination = null,
  route = [],
  footstepTimer = 0,
  renderTime = 0;
const keys = new Set();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf2efe4);
scene.fog = new THREE.Fog(0xf2efe4, 45, 100);
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 150);
const cameraTarget = new THREE.Vector3(0, 0, 0);
const introPosition = new THREE.Vector3(24, 27, 32);
camera.position.copy(introPosition);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  $('world').appendChild(renderer.domElement);
} catch (e) {
  showError(
    'This little world needs WebGL. Please enable hardware acceleration or try a current browser.',
  );
  throw e;
}
scene.add(new THREE.HemisphereLight(0xfff7dd, 0x8a9e73, 1.8));
const sun = new THREE.DirectionalLight(0xffe7bb, 2.8);
sun.position.set(-13, 25, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 70 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.045;
sun.shadow.radius = 3;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xcce4ff, 0.9);
fill.position.set(10, 9, -12);
scene.add(fill);
const assets = {};
const materials = new Map();
function mat(color, roughness = 0.85) {
  const key = `${color}-${roughness}`;
  if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness }));
  return materials.get(key);
}
function mesh(geo, color, x, y, z, parent = staticWorld) {
  const o = new THREE.Mesh(geo, mat(color));
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  parent.add(o);
  return o;
}
function box(x, y, z, w, h, d, color, parent = staticWorld) {
  return mesh(new THREE.BoxGeometry(w, h, d), color, x, y, z, parent);
}
function sphere(x, y, z, sx, sy, sz, color, parent = staticWorld) {
  const o = mesh(new THREE.SphereGeometry(1, 14, 10), color, x, y, z, parent);
  o.scale.set(sx, sy, sz);
  return o;
}
function cylinder(x, y, z, r, h, color, parent = staticWorld) {
  return mesh(new THREE.CylinderGeometry(r, r, h, 40), color, x, y, z, parent);
}
function model(name, x = 0, z = 0, scale = 1, rotation = 0, animated = false) {
  const obj = assets[name].scene.clone(true);
  obj.position.set(x, 0.12, z);
  obj.scale.setScalar(scale);
  obj.rotation.y = rotation;
  obj.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  (animated ? dynamicWorld : staticWorld).add(obj);
  if (animated && assets[name].animations.length) {
    const mixer = new THREE.AnimationMixer(obj);
    for (const clip of assets[name].animations) mixer.clipAction(clip).play();
    mixers.push(mixer);
  }
  return obj;
}
function label(text, x, y, z, width = 3.2, color = '#2d493b', paper = '#f8f1d9') {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = paper;
  ctx.beginPath();
  ctx.roundRect(4, 4, 504, 120, 15);
  ctx.fill();
  ctx.strokeStyle = '#c9cdb6';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = 'bold 29px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true }));
  sprite.position.set(x, y, z);
  sprite.scale.set(width, width / 4, 1);
  dynamicWorld.add(sprite);
  return sprite;
}
function patch(x, z, w, d, color) {
  const o = cylinder(x, 0.095, z, 1, 0.09, color);
  o.scale.set(w / 2, 1, d / 2);
  return o;
}
function lamp(x, z) {
  cylinder(x, 1.1, z, 0.055, 2.2, 0x435449);
  box(x, 2.17, z, 0.28, 0.35, 0.28, 0xffe5a0);
  box(x, 2.38, z, 0.42, 0.08, 0.42, 0x435449);
}
function mergeStatic() {
  staticWorld.updateMatrixWorld(true);
  const buckets = new Map();
  staticWorld.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    for (const key of Object.keys(g.attributes))
      if (!['position', 'normal', 'uv'].includes(key)) g.deleteAttribute(key);
    if (!g.getAttribute('uv'))
      g.setAttribute(
        'uv',
        new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2),
      );
    const key = o.material.uuid;
    if (!buckets.has(key)) buckets.set(key, { material: o.material, geometries: [] });
    buckets.get(key).geometries.push(g);
  });
  const batch = new THREE.Group();
  for (const { material, geometries } of buckets.values()) {
    const combined = mergeGeometries(geometries.map((g) => (g.index ? g.toNonIndexed() : g)));
    if (combined) {
      const o = new THREE.Mesh(combined, material);
      o.castShadow = true;
      o.receiveShadow = true;
      batch.add(o);
    }
    geometries.forEach((g) => g.dispose());
  }
  world.remove(staticWorld);
  staticWorld = batch;
  world.add(batch);
}
function disposeWorld() {
  if (!world) return;
  scene.remove(world);
  staticWorld.traverse((o) => {
    if (o.isMesh) o.geometry.dispose();
  });
  dynamicWorld.traverse((o) => {
    if (o.isSprite) {
      o.material.map?.dispose();
      o.material.dispose();
    }
  });
  mixers.forEach((m) => m.stopAllAction());
  mixers = [];
}
function buildWorld(chapter = 0) {
  disposeWorld();
  world = new THREE.Group();
  staticWorld = new THREE.Group();
  dynamicWorld = new THREE.Group();
  world.add(staticWorld, dynamicWorld);
  scene.add(world);
  collisions = [];
  markers = [];
  const forest = chapter === 1,
    coast = chapter === 2;
  const grass = CHAPTERS[chapter].color;
  const ground = cylinder(0, -0.7, 0, 17.4, 1.4, 0xc4b48d);
  ground.scale.z = 0.81;
  const top = cylinder(0, 0.015, 0, 17.5, 0.12, grass);
  top.scale.z = 0.81;
  const baseShadow = cylinder(0, -1.44, 0, 17.3, 0.05, 0xaaa788);
  baseShadow.scale.z = 0.81;
  box(0, 0.105, 0, 3.2, 0.08, 25.5, 0xe1ce9f);
  box(0, 0.109, 3.2, 29, 0.08, 2.6, 0xe1ce9f);
  box(0, 0.11, -6.5, 25, 0.08, 2.1, 0xe1ce9f);
  for (let z = -12; z < 13; z += 1.3) {
    box(-1.75, 0.15, z, 0.21, 0.12, 0.9, 0xf0dfb6);
    box(1.75, 0.15, z, 0.21, 0.12, 0.9, 0xf0dfb6);
  }
  // An actual little pond, framed by stones and a timber bridge.
  patch(7, 0, 10, 4.9, coast ? 0x86c5c7 : 0x78b7b1);
  patch(7, -0.2, 8.9, 3.7, 0x8bc3bd).position.y += 0.014;
  for (let i = 0; i < 16; i++) {
    let a = (i / 16) * Math.PI * 2;
    sphere(7 + Math.cos(a) * 4.8, 0.14, Math.sin(a) * 2.3, 0.32, 0.17, 0.23, 0xd9d3b5);
  }
  for (let i = 0; i < 11; i++) box(7, 0.26, -2 + i * 0.39, 2, 0.16, 0.32, 0xb38b57);
  for (let x of [6, 8]) {
    for (let z of [-2, 0, 2]) box(x, 0.65, z, 0.09, 1, 0.09, 0xe6d8b5);
    box(x, 1.02, 0, 0.09, 0.09, 4.2, 0xe6d8b5);
  }
  collisions.push({ x: 7, z: 0, w: 9.2, d: 4.3, bridge: true });
  const houses = forest
    ? [
        [-5, -5.4, 'garage', 0.86],
        [10, -8, 'house', 0.65],
      ]
    : [
        [-5, -5.4, 'garage', 1],
        [-10, -0.8, 'house', 0.85],
        [-3, 9.7, 'house', 0.87],
        [1.5, 9.3, 'house', 0.82],
        ...(coast ? [] : [[10, -8.6, 'house', 0.9]]),
      ];
  for (const [x, z, name, s] of houses) {
    model(name, x, z, s);
    collisions.push({ x, z, w: 3.8 * s, d: 3.15 * s });
  }
  label(
    forest ? 'GARY’S FIELD STATION' : coast ? 'GARY’S “MARINE LAB”' : 'GARY’S “LAB”',
    -5,
    3.9,
    -4,
    3.2,
  );
  const professor = model('professor', -3.0, -2.1, 0.9, Math.PI * 0.12);
  markers.push({ id: 'gary', x: -3, z: -2.1, obj: professor, label: 'Talk to Gary' });
  const trees = [
    [-13, -6],
    [-12, -9],
    [-9, -10],
    [-1, -11],
    [3, -10],
    [6, -11],
    [12, -5],
    [14, 0],
    [12, 7],
    [10, 10],
    [6, 11],
    [-2, 11],
    [-11, 7],
    [-13, 3],
    [-14, -1],
  ];
  if (forest)
    trees.push(
      [-8, -8],
      [-9, -6],
      [-11, 0],
      [-11, 5],
      [-5, 8],
      [2, 8],
      [4, -8],
      [11, 4],
      [1, -10],
      [-4, -10],
    );
  trees.forEach(([x, z], i) => {
    const s = (forest ? 1.22 : 1) * (0.8 + (i % 4) * 0.12);
    model('tree', x, z, s, i);
    collisions.push({ x, z, w: 0.6, d: 0.6 });
  });
  for (let i = 0; i < 30; i++) {
    let a = i * 2.399;
    let r = 6 + ((i * 7) % 10);
    let x = Math.cos(a) * r,
      z = Math.sin(a) * r * 0.76;
    if (Math.abs(x) > 2.7 && Math.abs(z - 3.2) > 1.9 && !(x > 2 && Math.abs(z) < 3))
      model('flowers', x, z, 1.4, i);
  }
  for (let i = 0; i < 9; i++) {
    model('fence', -13 + i * 1.85, -3.2, 0.9);
  }
  for (let i = 0; i < 4; i++) model('fence', -9.5 + i * 1.65, 7.1, 0.85);
  model('bench', 8.5, 5.2, 1.1, 0.1);
  model('bench', -3.5, 5.4, 1.1, Math.PI / 2);
  for (const [x, z] of [
    [-2.2, 5.2],
    [2.3, -5],
    [-11, 4.8],
    [11, 4.5],
  ])
    lamp(x, z);
  // Small environmental stories: a garage desk, lost ball, mailboxes, recycling bins.
  box(-2.7, 0.68, -4.2, 1.1, 0.13, 0.7, 0x9a794f);
  for (const x of [-3.12, -2.28]) box(x, 0.36, -4.2, 0.08, 0.6, 0.6, 0x6e795f);
  cylinder(-2.9, 0.84, -4.2, 0.12, 0.22, 0xf1e6c7);
  box(-2.45, 0.8, -4.2, 0.25, 0.05, 0.36, 0x6e9288);
  sphere(-6.8, 0.34, 4.8, 0.23, 0.23, 0.23, 0xd88a59);
  for (const x of [9.5, 10.3]) {
    box(x, 0.53, -4.7, 0.62, 0.85, 0.68, coast ? 0x738f91 : 0x52766b);
    box(x, 0.99, -4.7, 0.69, 0.08, 0.75, 0x355e52);
  }
  for (const [x, z] of [
    [-8.4, 1.8],
    [-4.1, 7],
    [3, 7.3],
  ]) {
    box(x, 0.55, z, 0.07, 0.9, 0.07, 0x93734d);
    box(x, 1.05, z, 0.42, 0.28, 0.29, 0xd4835f);
  }
  if (forest) {
    for (let i = 0; i < 9; i++) {
      const x = -8 + i * 0.5,
        z = -1 + Math.sin(i) * 0.6;
      cylinder(x, 0.25, z, 0.06, 0.3, 0xe9ddbb);
      sphere(x, 0.4, z, 0.17, 0.08, 0.17, 0xba6142);
    }
  }
  if (coast) {
    // Lighthouse and shoreline palette make the third chapter its own place.
    cylinder(11, 1.9, -9, 0.66, 3.6, 0xf6e5bf);
    cylinder(11, 2.5, -9, 0.69, 0.44, 0xc96e48);
    cylinder(11, 3.85, -9, 0.9, 0.24, 0x365751);
    cylinder(11, 4.15, -9, 0.58, 0.42, 0xf5cc6c);
    cylinder(11, 4.45, -9, 0.85, 0.18, 0x365751);
    for (let i = 0; i < 8; i++) patch(11 - i * 0.6, 9 + i * 0.15, 2.4, 1.5, 0xe3d4a9);
  }
  for (const e of ENCOUNTERS.filter((e) => e.chapter === chapter)) {
    const animal = model(e.model, e.x, e.z, e.model === 'pigeon' ? 1.3 : 1, Math.PI * 0.15, true);
    const ring = mesh(
      new THREE.TorusGeometry(0.75, 0.035, 8, 48),
      state.stamps.includes(e.id) ? 0x6b9360 : 0xffcf67,
      e.x,
      0.18,
      e.z,
      dynamicWorld,
    );
    ring.rotation.x = -Math.PI / 2;
    ring.castShadow = false;
    const flag = label(
      state.stamps.includes(e.id) ? '✓  FRIEND' : `✦  ${e.title.toUpperCase()}`,
      e.x,
      2.15,
      e.z,
      3.4,
    );
    markers.push({
      ...e,
      obj: animal,
      ring,
      flag,
      label: state.stamps.includes(e.id) ? `Visit ${e.name}` : `Meet ${e.name}`,
    });
  }
  player = model('player', 0, 3.3, 0.8, 0, true);
  if (state.starter) companion = model(state.starter, 1.1, 4, 0.72, 0, true);
  else companion = null;
  if (!playing) {
    for (const [i, name] of ['cat', 'dog', 'hamster'].entries())
      model(name, -2 + i * 1.15, 0.2, 0.75, 0, true);
  }
  // Soft tufts and stepping stones break the straight paths.
  for (let i = 0; i < 65; i++) {
    let a = i * 2.399,
      r = 4 + ((i * 11) % 12),
      x = Math.cos(a) * r,
      z = Math.sin(a) * r * 0.78;
    if (
      Math.abs(x) > 2.7 &&
      Math.abs(z - 3.2) > 1.7 &&
      Math.abs(z + 6.5) > 1.5 &&
      !(x > 2 && Math.abs(z) < 3)
    )
      sphere(x, 0.15, z, 0.18, 0.13, 0.14, forest ? 0x5f8653 : 0x849c59);
  }
  mergeStatic();
  destination = null;
  route = [];
  activeTarget = null;
  if (playing) updateHUD();
}

function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    toast('Progress could not be saved in this browser. You can keep playing.');
  }
}
function showError(text) {
  $('loading-error').hidden = false;
  $('loading-error').textContent = text;
}
function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3800);
}
let priorFocus = null;
function openModal(id) {
  if (!modal) priorFocus = document.activeElement;
  else $(modal).hidden = true;
  modal = id;
  $(id).hidden = false;
  destination = null;
  route = [];
  keys.clear();
  setTimeout(() => $(id).querySelector('button:not([disabled])')?.focus(), 50);
}
function closeModal() {
  if (modal) $(modal).hidden = true;
  modal = null;
  priorFocus?.focus();
}
function speak(lines, callback) {
  dialogueQueue = [...lines];
  dialogueCallback = callback;
  openModal('dialogue');
  nextDialogue();
}
function nextDialogue() {
  if (dialogueQueue.length) {
    $('dialogue-text').textContent = dialogueQueue.shift();
    $('dialogue-next').innerHTML = dialogueQueue.length
      ? 'Go on… <span>→</span>'
      : 'Understood. Probably. <span>→</span>';
    sfx('talk');
  } else {
    closeModal();
    const cb = dialogueCallback;
    dialogueCallback = null;
    cb?.();
  }
}
$('dialogue-next').onclick = nextDialogue;
function updateHUD() {
  const count = ENCOUNTERS.filter(
    (e) => e.chapter === state.chapter && state.stamps.includes(e.id),
  ).length;
  $('quest-title').textContent = state.completed
    ? 'Ordinary Animal Master'
    : count === 3
      ? 'Report back to Gary'
      : CHAPTERS[state.chapter].goal;
  $('quest-copy').textContent = state.completed
    ? 'A lifetime qualification. Printed on a napkin.'
    : count === 3
      ? state.chapter === 2
        ? 'The grand final awaits. Bring your confidence.'
        : 'Three stamps! Gary has more questionable plans.'
      : `Chapter ${state.chapter + 1} of 3 · ${count}/3 stamps · Follow the gold markers.`;
  document.querySelectorAll('#stamps>span').forEach((el, i) => {
    el.classList.toggle('earned', i < count);
    el.textContent = i < count ? '✦' : String(i + 1).padStart(2, '0');
  });
  document.querySelector('.location-label').innerHTML =
    `<span class="dot"></span> ${CHAPTERS[state.chapter].name.toUpperCase()} <small>${CHAPTERS[state.chapter].subtitle.toUpperCase()}</small>`;
  $('companion-name').textContent = STARTERS[state.starter]?.name || 'No colleague yet';
  $('companion-description').textContent =
    STARTERS[state.starter]?.perk || 'Talk to the man in the lab coat.';
  $('companion-img').src = portrait(state.starter || 'hamster');
  updateJournal();
}
function beginGame() {
  playing = true;
  document.body.classList.add('playing');
  $('hud').hidden = false;
  if (state.starter) {
    buildWorld(state.chapter);
    toast(
      state.completed
        ? 'Welcome back, Master. The animals still have no idea.'
        : `Welcome back to ${CHAPTERS[state.chapter].name}.`,
    );
    return;
  }
  speak(
    [
      'Ah! A ten-year-old. Finally, someone with the life experience this project needs. I’m Professor Gary. The “professor” part is more of a mindset.',
      'Welcome to my laboratory. Please do not touch the lawn mower. It is also my car.',
      'Your mission: become an Ordinary Animal Master. Your equipment: one animal, unlimited snack crumbs, and the confidence of someone who has never paid rent.',
    ],
    chooseStarter,
  );
}
function chooseStarter() {
  $('starter-cards').replaceChildren();
  Object.entries(STARTERS).forEach(([id, pet], i) => {
    const button = document.createElement('button');
    button.className = 'starter-card';
    button.dataset.starter = id;
    button.innerHTML = `<span class="number">NO. 00${i + 1} / ${pet.kind.toUpperCase()}</span><img src="${portrait(id)}" alt="${pet.kind} modeled in Blender"/><h3>${pet.name}</h3><p>${pet.description}</p><div class="trait">${pet.trait}<span>↗</span></div>`;
    button.onclick = () => {
      state.starter = id;
      save();
      closeModal();
      buildWorld(0);
      sfx('win');
      speak([
        `${pet.name}! Excellent choice. ${pet.perk} Take this field guide. I made it while the kettle was boiling.`,
        CHAPTERS[0].intro,
      ]);
    };
    $('starter-cards').appendChild(button);
  });
  openModal('starter');
}
$('begin').onclick = beginGame;
function interact() {
  if (!playing || modal || !activeTarget) return;
  if (activeTarget.id === 'gary') {
    talkGary();
    return;
  }
  if (state.stamps.includes(activeTarget.id)) {
    toast(`${activeTarget.name} remembers you. This is friendship. No paperwork needed.`);
    sfx('win');
    return;
  }
  launchEncounter(activeTarget.id);
}
function talkGary() {
  if (!state.starter) {
    chooseStarter();
    return;
  }
  const count = ENCOUNTERS.filter(
    (e) => e.chapter === state.chapter && state.stamps.includes(e.id),
  ).length;
  if (state.completed) {
    showEnding();
    return;
  }
  if (count < 3) {
    speak([
      `${3 - count} more stamp${3 - count === 1 ? '' : 's'} to go. Look for the gold markers. A nervous animal needs reassurance, a hungry one wants a snack, and a restless one needs play.`,
      'If it goes badly, take a breath and try again. Your confidence refills. My insurance does not.',
    ]);
    return;
  }
  if (state.chapter < 2) {
    const next = state.chapter + 1;
    speak(
      [
        `Three stamps! You are now qualified to go slightly farther away. I have informed absolutely nobody.`,
        CHAPTERS[next].intro,
      ],
      () => {
        state.chapter = next;
        save();
        buildWorld(next);
        sfx('win');
        toast(`Chapter ${next + 1} · ${CHAPTERS[next].name}`);
      },
    );
  } else
    speak(
      [
        'Nine stamps. Three regions. One incredibly flexible definition of education. There is only one challenge left.',
        'Behold: Municipal Bond. My undefeated champion hamster. Undefeated because, until today, we have been using “champion” decoratively.',
        'Five good approaches should do it. Watch the mood every turn. Municipal Bond takes friendship surprisingly seriously.',
      ],
      () => launchEncounter('champion'),
    );
}
function launchEncounter(id) {
  battle = startEncounter(id);
  const e = ENCOUNTERS.find((e) => e.id === id);
  $('battle-companion').src = portrait(state.starter);
  $('battle-wild').src = portrait(e.model);
  $('encounter-name').textContent = e.name;
  $('encounter-story').textContent = e.story;
  $('battle-log').textContent = 'Watch their mood. A little understanding goes a long way.';
  $('moves').hidden = false;
  $('encounter-done').hidden = true;
  renderBattle();
  openModal('encounter');
  sfx('meet');
}
function renderBattle() {
  const e = ENCOUNTERS.find((e) => e.id === battle.id);
  $('encounter-mood').textContent =
    battle.outcome === 'won'
      ? 'New friend!'
      : battle.outcome === 'lost'
        ? 'Needs a moment'
        : `Feeling ${e.moods[battle.turn % e.moods.length]}`;
  $('trust-value').textContent = `${battle.trust} / 100`;
  $('confidence-value').textContent = `${battle.confidence} / 100`;
  $('trust-meter').style.width = `${battle.trust}%`;
  $('confidence-meter').style.width = `${battle.confidence}%`;
}
let turnBusy = false;
for (const button of document.querySelectorAll('#moves button'))
  button.onclick = () => {
    if (turnBusy || !battle || battle.outcome) return;
    turnBusy = true;
    setTimeout(() => (turnBusy = false), 400);
    battle = takeTurn(battle, button.dataset.move);
    renderBattle();
    const lines = {
      reassure: 'You explain that nobody here has qualifications. Oddly reassuring.',
      snack: 'A carefully negotiated crumb changes paws. Diplomacy works.',
      play: `${STARTERS[state.starter].name} demonstrates a deeply unserious little dance.`,
    };
    $('battle-log').textContent = battle.match
      ? lines[button.dataset.move]
      : 'Not quite what they needed. Check the new mood and try a different approach.';
    sfx(battle.match ? 'good' : 'miss');
    if (battle.outcome) {
      $('moves').hidden = true;
      $('encounter-done').hidden = false;
      if (battle.outcome === 'won') {
        if (!state.stamps.includes(battle.id)) state.stamps.push(battle.id);
        if (battle.id === 'champion') state.completed = true;
        save();
        updateHUD();
        const e = ENCOUNTERS.find((e) => e.id === battle.id);
        $('battle-log').textContent =
          `Friendship established. “${e.stamp}” stamp earned. ${battle.id === 'champion' ? 'Gary looks suspiciously emotional.' : 'Your field journal has been updated.'}`;
        const marker = markers.find((m) => m.id === battle.id);
        if (marker) {
          marker.ring.material = mat(0x6b9360);
          marker.flag.material.map.dispose();
          dynamicWorld.remove(marker.flag);
          marker.flag = label('✓  FRIEND', marker.x, 2.15, marker.z, 3.4);
        }
        sfx('win');
      } else
        $('battle-log').textContent =
          'You need a breather. No animals were harmed, and Gary has learned nothing. Your confidence will refill when you try again.';
    }
  };
$('leave-encounter').onclick = () => {
  closeModal();
  battle = null;
  toast('A respectful retreat. You can try again whenever you like.');
};
$('encounter-done').onclick = () => {
  const ending = battle?.id === 'champion' && battle.outcome === 'won';
  closeModal();
  battle = null;
  if (ending) showEnding();
};
function showEnding() {
  speak(
    [
      'You did it. You understood ten ordinary animals. You listened, shared, and only briefly panicked. That is genuinely quite good for a Tuesday.',
      'By the power vested in me by an online lab-coat retailer, I declare you an ORDINARY ANIMAL MASTER.',
      'Your prize is a certificate, a lifelong friend, and being home before dinner. Your parents have been calling for twenty minutes.',
    ],
    () => {
      showCertificate();
      sfx('win');
    },
  );
}
function showCertificate() {
  let el = $('certificate');
  if (!el) {
    el = document.createElement('div');
    el.id = 'certificate';
    el.className = 'modal-backdrop';
    el.hidden = true;
    el.innerHTML = `<section class="certificate-panel"><span class="certificate-seal">✳</span><span class="eyebrow">DEPARTMENT OF UNNECESSARY ADVENTURES</span><h2>Ordinary Animal<br/><em>Master.</em></h2><p>This certifies that a ten-year-old and their very normal animal<br/>made the world a little friendlier.</p><div class="certificate-stamps">✦ ✦ ✦ &nbsp; ✦ ✦ ✦ &nbsp; ✦ ✦ ✦</div><span class="eyebrow">THREE REGIONS · TEN NEW FRIENDS · ZERO QUALIFICATIONS</span><p class="signature">Professor Gary <small>ACCREDITATION STILL PENDING</small></p><button class="primary" id="keep-exploring">Keep exploring <span>→</span></button><p class="credits">An original adventure by SamGCoder<br/>Models & animation made in Blender · Powered by Three.js<br/>Code and original assets released under the MIT license.</p></section>`;
    document.body.appendChild(el);
    $('keep-exploring').onclick = closeModal;
  }
  openModal('certificate');
}
function updateJournal() {
  let journal = $('journal');
  if (!journal) {
    journal = document.createElement('div');
    journal.id = 'journal';
    journal.innerHTML =
      '<h3>Friends along the way</h3><div class="journal-grid"></div><div class="travel"></div>';
    $('guide').querySelector('.guide-controls').before(journal);
  }
  journal.querySelector('.journal-grid').innerHTML = ENCOUNTERS.map(
    (e) =>
      `<div class="journal-entry ${state.stamps.includes(e.id) ? 'found' : ''}"><img src="${portrait(e.model)}" alt="${e.model}"/><span>${state.stamps.includes(e.id) ? e.name : '???'}<small>${state.stamps.includes(e.id) ? e.stamp : 'Not yet acquainted'}</small></span></div>`,
  ).join('');
  const travel = journal.querySelector('.travel');
  travel.replaceChildren();
  if (!playing || !state.starter) return;
  CHAPTERS.forEach((c, i) => {
    const unlocked =
      i === 0 ||
      ENCOUNTERS.filter((e) => e.chapter === i - 1).every((e) => state.stamps.includes(e.id));
    if (!unlocked) return;
    const b = document.createElement('button');
    b.className = 'text-button';
    b.textContent = `${i === state.chapter ? '●' : '↗'} ${c.name}`;
    b.onclick = () => {
      state.chapter = i;
      save();
      closeModal();
      buildWorld(i);
    };
    travel.appendChild(b);
  });
}
$('guide-btn').onclick = () => {
  if (modal && modal !== 'guide') return;
  updateJournal();
  openModal('guide');
};
$('close-guide').onclick = closeModal;
$('reset-btn').onclick = () => ($('reset-message').hidden = false);
$('confirm-reset').onclick = () => {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {}
  location.reload();
};
$('home-btn').onclick = () => {
  if (modal) return;
  player.position.set(0, 0.12, 1);
  if (companion) companion.position.set(1, 0.12, 1);
  destination = new THREE.Vector3(-2, 0.12, -1);
  toast('Returning to the nearest questionable adult.');
};
$('interact').onclick = interact;

// Small synthesized soundtrack. Nothing downloads, and audio starts only on request.
let audioContext,
  soundOn = false,
  musicInterval,
  noteIndex = 0;
function tone(freq, duration = 0.12, volume = 0.04, delay = 0) {
  if (!soundOn || !audioContext) return;
  const start = audioContext.currentTime + delay;
  const o = audioContext.createOscillator(),
    g = audioContext.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(volume, start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  o.connect(g);
  g.connect(audioContext.destination);
  o.start(start);
  o.stop(start + duration + 0.01);
}
function sfx(kind) {
  if (kind === 'win') {
    [523, 659, 784, 1047].forEach((n, i) => tone(n, 0.3, 0.035, i * 0.1));
  } else if (kind === 'good') tone(659, 0.19);
  else if (kind === 'miss') tone(220, 0.15, 0.025);
  else if (kind === 'meet') {
    tone(392, 0.15);
    tone(523, 0.23, 0.03, 0.15);
  } else tone(420, 0.045, 0.012);
}
$('sound-btn').onclick = async () => {
  soundOn = !soundOn;
  if (soundOn) {
    audioContext ||= new AudioContext();
    await audioContext.resume();
    musicInterval = setInterval(() => {
      const notes = [
        261.63, 329.63, 392, 329.63, 293.66, 349.23, 440, 349.23, 261.63, 329.63, 392, 523.25,
        293.66, 349.23, 392, 329.63,
      ];
      tone(notes[noteIndex++ % notes.length], 0.8, 0.018);
    }, 480);
    sfx('win');
  } else clearInterval(musicInterval);
  $('sound-btn').setAttribute('aria-label', soundOn ? 'Mute sound' : 'Enable sound');
  $('sound-btn').title = soundOn ? 'Mute sound' : 'Enable sound';
  document.querySelector('.sound-slash').hidden = soundOn;
};
document.addEventListener('visibilitychange', () => {
  if (audioContext) {
    if (document.hidden) audioContext.suspend();
    else if (soundOn) audioContext.resume();
  }
  keys.clear();
});
function blocked(x, z) {
  if ((x / 16.3) ** 2 + (z / 12.8) ** 2 > 1) return true;
  return collisions.some((c) => {
    if (c.bridge && Math.abs(x - 7) < 0.8) return false;
    return Math.abs(x - c.x) < c.w / 2 + 0.22 && Math.abs(z - c.z) < c.d / 2 + 0.22;
  });
}
function movePlayer(dx, dz) {
  const p = player.position;
  const oldx = p.x,
    oldz = p.z;
  if (!blocked(p.x + dx, p.z)) p.x += dx;
  if (!blocked(p.x, p.z + dz)) p.z += dz;
  moving = Math.hypot(p.x - oldx, p.z - oldz) > 0.0001;
  if (moving) {
    const angle = Math.atan2(dx, dz);
    player.rotation.y +=
      Math.atan2(Math.sin(angle - player.rotation.y), Math.cos(angle - player.rotation.y)) * 0.2;
  }
}
window.addEventListener('keydown', (e) => {
  if (e.key === 'Tab' && modal) {
    const list = [
      ...$(modal).querySelectorAll('button:not([hidden]):not([disabled]),a[href]'),
    ].filter((el) => el.offsetParent !== null);
    const first = list[0],
      last = list.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
    return;
  }
  if (e.key === 'Escape') {
    if (['guide', 'encounter', 'certificate'].includes(modal)) {
      if (modal === 'encounter' && battle?.id === 'champion' && battle?.outcome === 'won') {
        closeModal();
        showEnding();
      } else closeModal();
    }
    return;
  }
  if (modal) {
    if (
      (e.key === 'e' || e.key === 'Enter') &&
      modal === 'dialogue' &&
      e.target.tagName !== 'BUTTON'
    )
      nextDialogue();
    return;
  }
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  keys.add(e.key.toLowerCase());
  if (e.key.toLowerCase() === 'e' && !e.repeat) interact();
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());
const moveMap = { up: 'w', left: 'a', down: 's', right: 'd' };
for (const b of document.querySelectorAll('#touch-controls button')) {
  b.onpointerdown = (e) => {
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    keys.add(moveMap[b.dataset.move]);
  };
  b.onpointerup = b.onpointercancel = () => keys.delete(moveMap[b.dataset.move]);
}
const raycaster = new THREE.Raycaster(),
  pointer = new THREE.Vector2(),
  groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.12);
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (!playing || modal || !state.starter) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    (-(e.clientY - rect.top) / rect.height) * 2 + 1,
  );
  raycaster.setFromCamera(pointer, camera);
  const target = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(groundPlane, target) && !blocked(target.x, target.z)) {
    route = findPath(player.position, target, blocked);
    const p = route.shift();
    destination = p ? new THREE.Vector3(p.x, 0.12, p.z) : null;
    if (!destination) toast('No clear route. Try a nearby patch of ground.');
  }
});
function resize() {
  const { width, height } = $('world').getBoundingClientRect();
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe($('world'));
let last = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - last) / 1000, 0.04);
  last = now;
  renderTime += dt;
  if (!world) return;
  for (const m of mixers) m.update(reducedMotion ? 0 : dt);
  moving = false;
  if (playing && state.starter && !modal) {
    let sx =
        (keys.has('d') || keys.has('arrowright') ? 1 : 0) -
        (keys.has('a') || keys.has('arrowleft') ? 1 : 0),
      sz =
        (keys.has('s') || keys.has('arrowdown') ? 1 : 0) -
        (keys.has('w') || keys.has('arrowup') ? 1 : 0);
    let dx = 0,
      dz = 0;
    if (sx || sz) {
      destination = null;
      route = [];
      dx = sx * 0.8 + sz * 0.6;
      dz = -sx * 0.6 + sz * 0.8;
      const len = Math.hypot(dx, dz);
      dx /= len;
      dz /= len;
    } else if (destination) {
      dx = destination.x - player.position.x;
      dz = destination.z - player.position.z;
      const len = Math.hypot(dx, dz);
      if (len < 0.15) {
        const p = route.shift();
        destination = p ? new THREE.Vector3(p.x, 0.12, p.z) : null;
        dx = dz = 0;
      } else {
        dx /= len;
        dz /= len;
      }
    }
    if (dx || dz) {
      movePlayer(dx * dt * 4.3, dz * dt * 4.3);
      if (!moving) destination = null;
    }
    player.position.y =
      0.12 + (moving && !reducedMotion ? Math.abs(Math.sin(renderTime * 13)) * 0.09 : 0);
    if (companion) {
      const diff = player.position.clone().sub(companion.position);
      diff.y = 0;
      const distance = diff.length();
      if (distance > 1.15) {
        companion.position.addScaledVector(diff, Math.min(1, dt * 4));
        companion.rotation.y = Math.atan2(diff.x, diff.z);
      }
      companion.position.y =
        0.12 + (moving && !reducedMotion ? Math.abs(Math.sin(renderTime * 16)) * 0.07 : 0);
    }
    footstepTimer += dt;
    if (moving && footstepTimer > 0.32) {
      footstepTimer = 0;
      tone(95 + Math.random() * 25, 0.035, 0.008);
    }
    activeTarget = markers.reduce((best, m) => {
      const d = Math.hypot(player.position.x - m.x, player.position.z - m.z);
      return d < 2.35 && (!best || d < best.distance) ? { ...m, distance: d } : best;
    }, null);
    $('interact').hidden = !activeTarget;
    $('interact').textContent = activeTarget ? `E  ·  ${activeTarget.label}` : '';
  } else $('interact').hidden = true;
  for (const m of markers) {
    if (m.ring && !reducedMotion) {
      const s = 1 + Math.sin(renderTime * 2.5) * 0.045;
      m.ring.scale.set(s, s, s);
    }
    if (m.flag) m.flag.position.y = 2.15 + (reducedMotion ? 0 : Math.sin(renderTime * 1.7) * 0.06);
  }
  const follow = innerWidth < 800 ? 1 : 0.28;
  const desired = playing
    ? new THREE.Vector3(player.position.x * follow, 0, player.position.z * follow)
    : new THREE.Vector3(0, 0.3, 0.2);
  cameraTarget.lerp(desired, 1 - Math.exp(-dt * 3));
  const zoom = playing ? (innerWidth < 800 ? 1.08 : 0.79) : innerWidth < 800 ? 1.42 : 1.05;
  const wanted = cameraTarget.clone().addScaledVector(introPosition, zoom);
  camera.position.lerp(wanted, 1 - Math.exp(-dt * 2));
  camera.lookAt(cameraTarget);
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);

async function load() {
  const names = [
    'cat',
    'dog',
    'hamster',
    'pigeon',
    'raccoon',
    'rabbit',
    'fox',
    'tortoise',
    'duck',
    'sheep',
    'goat',
    'player',
    'professor',
    'house',
    'garage',
    'tree',
    'fence',
    'bench',
    'flowers',
  ];
  const loader = new GLTFLoader();
  let loaded = 0;
  await Promise.all(
    names.map(async (name) => {
      assets[name] = await loader.loadAsync(`${base}models/${name}.glb`);
      loaded++;
      $('begin').innerHTML =
        `Growing the neighborhood… ${Math.round((loaded / names.length) * 100)}%`;
    }),
  );
  buildWorld(0);
  resize();
  $('begin').disabled = false;
  $('begin').innerHTML =
    `${state.starter ? 'Continue your adventure' : 'Begin your adventure'} <span>↗</span>`;
}
load().catch((error) => {
  console.error(error);
  showError(
    'The moving truck lost an asset. Please reload to try again. If this persists, check your connection.',
  );
  $('begin').textContent = 'Reload the neighborhood';
  $('begin').disabled = false;
  $('begin').onclick = () => location.reload();
});

// Development-only read access for browser smoke tests; absent from production builds.
if (import.meta.env.DEV)
  window.__animalDebug = {
    position: () => (player ? { x: player.position.x, z: player.position.z } : null),
    project: (x, z) => {
      const p = new THREE.Vector3(x, 0.12, z).project(camera),
        r = renderer.domElement.getBoundingClientRect();
      return { x: r.left + ((p.x + 1) * r.width) / 2, y: r.top + ((1 - p.y) * r.height) / 2 };
    },
    stats: () => ({
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      animations: mixers.length,
    }),
  };
