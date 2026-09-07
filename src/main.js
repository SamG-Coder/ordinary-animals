import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import {
  SPECIES,
  MOVES,
  DISTRICTS,
  SAVE_KEY,
  makeAnimal,
  restore,
  attack,
  captureChance,
  initialSave,
  parseSave,
  terrainHeight,
  RESERVE_LIMIT,
  recordSpecies,
  collectAnimal,
  storeAnimal,
  retrieveAnimal,
} from "./rules.js";
import "./style.css";
import "./game-ui.css";
import { assembleWorld } from "./world.js";
import { FIELD_NOTES, WILD_SITES } from "./field-notes.js";
import {
  createWander,
  updateWander,
  followTrail,
  clearSegment,
} from "./animal-motion.js";
const $ = (id) => document.getElementById(id),
  base = import.meta.env.BASE_URL;
const settingsKey = "ordinary-animals-settings";
let settings = {};
try {
  settings = JSON.parse(localStorage.getItem(settingsKey)) || {};
} catch {}
if (typeof settings !== "object" || Array.isArray(settings)) settings = {};
function rememberSettings() {
  try {
    localStorage.setItem(settingsKey, JSON.stringify(settings));
  } catch {}
}
let state;
try {
  state = parseSave(localStorage.getItem(SAVE_KEY)) || initialSave();
} catch {
  state = initialSave();
}
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x18262e);
scene.fog = new THREE.FogExp2(0x233138, 0.0045);
const camera = new THREE.PerspectiveCamera(
  68,
  innerWidth / innerHeight,
  0.1,
  800,
);
camera.rotation.order = "YXZ";
const position = new THREE.Vector3(
  state.position.x ?? 0,
  1.35,
  state.position.z ?? 1.8,
);
let yaw = state.starter ? state.yaw : 0.34,
  pitch = state.starter ? state.pitch : -0.045;
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
} catch (e) {
  $("error").hidden = false;
  $("error").textContent =
    "This game needs WebGL. Enable hardware acceleration and reload.";
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.info.autoReset = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
$("viewport").appendChild(renderer.domElement);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const contactShadows = new GTAOPass(scene, camera, innerWidth, innerHeight);
contactShadows.updateGtaoMaterial({ radius: 0.6, thickness: 0.8, samples: 8 });
contactShadows.blendIntensity = 0.75;
composer.addPass(contactShadows);
const bloom = new UnrealBloomPass(
  new THREE.Vector2(innerWidth, innerHeight),
  0.19,
  0.65,
  0.95,
);
composer.addPass(bloom);
composer.addPass(new SMAAPass());
composer.addPass(new OutputPass());
const ambient = new THREE.HemisphereLight(0xa6bfd1, 0x181e17, 0.6);
scene.add(ambient);
const moon = new THREE.DirectionalLight(0xb4d2e8, 0.8);
moon.position.set(20, 30, -25);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
Object.assign(moon.shadow.camera, {
  left: -45,
  right: 45,
  top: 45,
  bottom: -45,
  near: 0.5,
  far: 130,
});
moon.shadow.bias = -0.0002;
moon.shadow.normalBias = 0.018;
scene.add(moon, moon.target);
const flashlight = new THREE.SpotLight(0xe2e8d2, 30, 45, Math.PI / 7, 0.6, 1.3);
flashlight.castShadow = true;
flashlight.shadow.mapSize.set(1024, 1024);
flashlight.shadow.bias = -0.0002;
flashlight.visible = false;
scene.add(flashlight, flashlight.target);
const battleLight = new THREE.PointLight(0xd6d9cd, 16, 16, 1.6);
battleLight.visible = false;
scene.add(battleLight);
const streetLights = Array.from({ length: 4 }, () => {
  const l = new THREE.PointLight(0xf5c18b, 38, 18, 1.65);
  scene.add(l);
  return l;
});
const assets = {},
  actors = [],
  targets = [],
  keys = new Set();
let worldInfo,
  room,
  region,
  door,
  frontDoor,
  modularWorld,
  frontOpen = false,
  frontAngle = 0,
  torch,
  carrier,
  companion,
  playing = false,
  modal = null,
  battle = null,
  activeTarget = null,
  doorOpen = false,
  doorAngle = 0,
  time = 0,
  stamina = 100,
  toastTimer,
  lookDrag = false,
  lookSensitivity = Math.max(
    0.001,
    Math.min(0.006, Number(settings.sensitivity) || 0.0025),
  ),
  cameraMotion =
    settings.motion ?? !matchMedia("(prefers-reduced-motion: reduce)").matches,
  saveTimer = 0;
let introDone = false,
  dialogueLines = [],
  dialogueCallback = null,
  currentTab = "map",
  soundOn = false,
  audioContext,
  noiseSource,
  noiseGain,
  footTimer = 0,
  partySelection = false;
const animalGroup = new THREE.Group();
scene.add(animalGroup);
function showError(error) {
  console.error(error);
  $("error").hidden = false;
  $("error").textContent =
    "An asset could not load. Reload to try again. " + error.message;
}
function save() {
  state.position = { x: position.x, z: position.z };
  state.yaw = yaw;
  state.pitch = pitch;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    toast("Saving is unavailable in this browser session.");
  }
}
function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 4000);
}
function setupMesh(root) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (m.normalScale) m.normalScale.set(0.22, 0.22);
          if (m.map)
            m.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
        }
      }
    }
    if (o.isLight) {
      o.intensity = Math.min(6, o.intensity * 0.0035);
      o.distance = 7;
      o.decay = 1.6;
      o.castShadow = false;
      if (o.isSpotLight) {
        o.castShadow = true;
        o.shadow.mapSize.set(1024, 1024);
        o.shadow.bias = -0.00015;
        o.shadow.normalBias = 0.008;
      }
    }
  });
  return root;
}
function asset(name, x = 0, z = 0, scale = 1, parent = scene) {
  const root = setupMesh(clone(assets[name].scene));
  root.position.set(x, 0, z);
  root.scale.setScalar(scale);
  parent.add(root);
  return root;
}
function actor(species, x, z, level = 5, hostile = false) {
  const root = asset(species, x, z, SPECIES[species]?.scale || 1, animalGroup);
  const mixer = new THREE.AnimationMixer(root),
    actions = {};
  for (const clip of assets[species].animations) {
    let name =
      ["Idle", "Walk", "Attack", "Hit", "Faint"].find((n) =>
        clip.name.toLowerCase().includes(n.toLowerCase()),
      ) || "Idle";
    actions[name] = mixer.clipAction(clip);
  }
  const a = {
    root,
    mixer,
    actions,
    species,
    home: new THREE.Vector3(x, 0, z),
    phase: Math.random() * 6,
    clip: null,
    level,
    hostile,
    wander: hostile
      ? createWander(species, x, z, Math.floor(Math.random() * 100000) + 1)
      : null,
    trail: [],
  };
  actors.push(a);
  play(a, "Idle");
  return a;
}
function person(name, x, z) {
  const root = asset(name, x, z);
  const mixer = new THREE.AnimationMixer(root);
  for (const clip of assets[name].animations) mixer.clipAction(clip).play();
  actors.push({
    root,
    mixer,
    clip: "Idle",
    actions: {},
    stationary: true,
    person: true,
  });
  return root;
}
function play(a, name, once = false) {
  if (!a) return;
  const action = a.actions[name] || a.actions.Idle;
  if (!action) return;
  if (a.clip === name && !once) return;
  for (const other of Object.values(a.actions))
    if (other !== action) other.fadeOut(0.15);
  action
    .reset()
    .setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
  action.clampWhenFinished = once;
  action.fadeIn(0.15).play();
  a.clip = name;
}
function floor(x, z) {
  return 0;
}
function collision(x, z) {
  if (Math.abs(x) > 580 || Math.abs(z) > 580) return true;
  if (!frontOpen && Math.abs(x) < 0.97 && Math.abs(z - 8) < 0.25) return true;
  if (!doorOpen && Math.abs(x) < 0.97 && Math.abs(z - 4) < 0.25) return true;
  return worldInfo.collisions.some(
    (c) =>
      Math.abs(x - c.x) < c.w / 2 + 0.22 && Math.abs(z - c.z) < c.d / 2 + 0.22,
  );
}
function addTarget(id, x, z, name, fn, radius = 2.5, y = 0.8) {
  const target = { id, x, z, name, fn, radius, y };
  targets.push(target);
  return target;
}
function setObjective() {
  let message, goal;
  if (!state.note) {
    message = "Read the letter on your desk.";
    goal = { x: -1.35, z: -2.6, name: "THE LETTER" };
  } else if (!state.starter) {
    message = "Leave your room. Meet Gary at the research clinic.";
    goal = { x: 24, z: -15, name: "GARY’S CLINIC" };
  } else if (!state.wins.includes("rival")) {
    message =
      "Your neighbour has challenged you. Defeat your rival outside the clinic.";
    goal = { x: 13, z: -9, name: "YOUR RIVAL" };
  } else if (state.badges.length < 8) {
    const i = DISTRICTS.findIndex((_, i) => !state.badges.includes(i)),
      t = worldInfo.towns[i];
    message = `Earn the ${DISTRICTS[i].badge} Badge in ${DISTRICTS[i].name}.`;
    goal = { x: t.gymX, z: t.gymZ, name: DISTRICTS[i].name.toUpperCase() };
  } else if (!state.completed) {
    message = `Return to Gary. County championship: ${state.league}/4 rounds complete.`;
    goal = { x: 24, z: -15, name: "COUNTY CHAMPIONSHIP" };
  } else {
    message = "You are an Animal Master. Your mother still expects you home.";
    goal = { x: 0, z: 2, name: "HOME" };
  }
  $("objective-text").textContent = message;
  return goal;
}
function updateHUD() {
  const pet = state.party.find((p) => p.hp > 0) || state.party[0];
  $("party-hud").innerHTML = pet
    ? `${pet.nickname.toUpperCase()} <small>LV ${pet.level} · ${pet.hp}/${pet.maxHp} HP &nbsp; / &nbsp; ${state.party.length} IN PARTY</small>`
    : "AGE 10 <small>NO ANIMALS · NO SUPERVISION</small>";
  setObjective();
}
function open(id) {
  modal = id;
  $(id).hidden = false;
  keys.clear();
  document.exitPointerLock?.();
  lookDrag = false;
  setTimeout(() => $(id).querySelector("button:not([disabled])")?.focus(), 20);
}
function close() {
  if (modal) $(modal).hidden = true;
  modal = null;
  partySelection = false;
}
function speak(speaker, lines, callback) {
  if (dialogueTimer !== null) {
    clearInterval(dialogueTimer);
    dialogueTimer = null;
  }
  dialogueLines = [...lines];
  dialogueCallback = callback;
  $("speaker").textContent = speaker;
  open("dialogue");
  advanceDialogue();
}
let dialogueTimer = null,
  dialogueFullText = "";
function advanceDialogue() {
  if (dialogueTimer !== null) {
    clearInterval(dialogueTimer);
    dialogueTimer = null;
    $("dialogue-text").textContent = dialogueFullText;
    return;
  }
  if (dialogueLines.length) {
    dialogueFullText = dialogueLines.shift();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches)
      $("dialogue-text").textContent = dialogueFullText;
    else {
      let characters = 1;
      $("dialogue-text").textContent = dialogueFullText.slice(0, characters);
      dialogueTimer = setInterval(() => {
        characters += 2;
        $("dialogue-text").textContent = dialogueFullText.slice(0, characters);
        if (characters >= dialogueFullText.length) {
          clearInterval(dialogueTimer);
          dialogueTimer = null;
        }
      }, 25);
    }
  } else {
    close();
    const cb = dialogueCallback;
    dialogueCallback = null;
    cb?.();
  }
}
$("next").onclick = advanceDialogue;
function readLetter() {
  speak(
    "A LETTER FROM HOME",
    [
      "Happy tenth birthday. Gary says you are old enough to begin your animal journey. Your bag is packed. Please remember to look both ways.",
      "He says the league counts as education. I could not find it on the school website, but he does own a white coat.",
      "Come home if it gets too much. Your room will be here. — Mum",
    ],
    () => {
      state.note = true;
      save();
      updateHUD();
    },
  );
}
function talkGary() {
  if (!state.note) {
    speak("GARY / LOCAL RESEARCHER", [
      "Your mother left a letter. You should probably read it before accepting responsibility for a living creature.",
    ]);
    return;
  }
  if (!state.starter) {
    speak(
      "GARY / LOCAL RESEARCHER",
      [
        "Ten years old. No income, no licence, no impulse control. The league considers this the ideal demographic.",
        "I study animals. Ordinary ones. The council stopped funding me, so now children collect the specimens. It is apparently called field experience.",
        "Choose a cat, a dog, or a hamster. Then battle the district leaders, capture wild animals, and come back with eight badges. There are forms. You cannot legally sign them, but sign them anyway.",
      ],
      () => {
        open("choose");
      },
    );
    return;
  }
  if (state.badges.length === 8 && !state.completed) {
    const names = [
      "The Welfare Board",
      "The Insurance Adjuster",
      "The Education Department",
      "Professor Gary",
    ];
    speak(
      names[state.league].toUpperCase(),
      [
        state.league === 3
          ? "You have defeated everyone who was supposed to protect you. I suppose that leaves me."
          : "The county championship. We have reviewed the paperwork and found that nobody is technically responsible.",
      ],
      () =>
        startBattle({
          id: "league" + state.league,
          name: names[state.league],
          roster:
            state.league === 3 ? ["cat", "dog", "hamster"] : ["fox", "raccoon"],
          level: 20 + state.league,
          kind: "league",
        }),
    );
    return;
  }
  state.party = state.party.map(restore);
  state.medkits = Math.max(state.medkits, 3);
  state.carriers = Math.max(state.carriers, 5);
  syncCompanion();
  save();
  updateHUD();
  speak("GARY / LOCAL RESEARCHER", [
    state.completed
      ? "A Master. Incredible. Your mother has phoned six times."
      : "I have treated your animals and replenished your supplies. It is the least I can do, according to my solicitor.",
  ]);
}
for (const button of document.querySelectorAll("[data-starter]"))
  button.onclick = () => {
    state.starter = button.dataset.starter;
    state.party = [makeAnimal(state.starter, 5)];
    recordSpecies(state, state.starter, true);
    close();
    syncCompanion();
    save();
    updateHUD();
    speak("GARY / LOCAL RESEARCHER", [
      "Your neighbour is waiting outside. He has also been entrusted with an animal. You should fight. That is how the league says children make friends.",
      "Your field journal records the species you meet and capture. Weaken a wild animal, then throw a carrier. If you are already carrying six animals, our courier brings the next one here. Apparently that is where the supervision budget went.",
    ]);
  };
function syncCompanion() {
  if (companion) {
    animalGroup.remove(companion.root);
    actors.splice(actors.indexOf(companion), 1);
  }
  const p = state.party.find((a) => a.hp > 0) || state.party[0];
  companion = p ? actor(p.species, position.x, position.z, p.level) : null;
  if (companion) {
    for (const [dx, dz] of [
      [0.8, 0.5],
      [-0.8, 0.5],
      [0.5, -0.8],
      [-0.5, -0.8],
    ]) {
      const spot = { x: position.x + dx, z: position.z + dz };
      if (clearSegment(position, spot, collision)) {
        companion.root.position.set(spot.x, floor(spot.x, spot.z), spot.z);
        break;
      }
    }
    companion.trail.push({ x: position.x, z: position.z });
  }
}
function rest() {
  state.party = state.party.map(restore);
  syncCompanion();
  save();
  updateHUD();
  toast("Your animals are rested. The room is still yours.");
}
function enterGym(i) {
  if (!state.starter) {
    toast("You need an animal. Gary is at the clinic.");
    return;
  }
  if (!state.wins.includes("rival")) {
    toast("Your rival is waiting outside Gary’s clinic.");
    return;
  }
  if (i > 0 && !state.badges.includes(i - 1)) {
    toast(
      `A ${DISTRICTS[i - 1].badge} Badge is required. Even this league has a queue.`,
    );
    return;
  }
  if (state.badges.includes(i)) {
    toast("You already earned this badge. Your animals have been healed.");
    state.party = state.party.map(restore);
    save();
    updateHUD();
    return;
  }
  const d = DISTRICTS[i];
  speak(d.leader.toUpperCase(), [d.quote], () =>
    startBattle({
      id: "gym" + i,
      name: d.leader,
      kind: "gym",
      gym: i,
      roster: d.roster,
      level: 5 + i * 2,
    }),
  );
}
function selectActive() {
  return state.party.findIndex((a) => a.hp > 0);
}
function startBattle(config) {
  if (!state.party.length) {
    toast("You need to choose your first animal.");
    return;
  }
  const active = selectActive();
  if (active < 0) {
    blackout();
    return;
  }
  close();
  document.exitPointerLock?.();
  keys.clear();
  battle = {
    config,
    active,
    enemyIndex: 0,
    enemy: makeAnimal(config.roster[0], config.level),
    busy: false,
    turn: 1,
    finished: false,
    menu: "root",
  };
  // Keep the battle at the child's eye height. Choose clear ground in front or to either side.
  let forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  for (const angle of [
    yaw,
    yaw + Math.PI / 2,
    yaw - Math.PI / 2,
    yaw + Math.PI,
  ]) {
    const candidate = new THREE.Vector3(-Math.sin(angle), 0, -Math.cos(angle));
    const right = new THREE.Vector3(-candidate.z, 0, candidate.x);
    if (
      [1, 2, 3, 4, 5].every((d) =>
        [-1, 0, 1].every((w) => {
          const x = position.x + candidate.x * d + right.x * w,
            z = position.z + candidate.z * d + right.z * w;
          return (
            !collision(x, z) &&
            !actors.some(
              (a) =>
                a.person &&
                Math.hypot(a.root.position.x - x, a.root.position.z - z) < 0.85,
            ) &&
            !worldInfo.lights.some((l) => Math.hypot(l.x - x, l.z - z) < 0.5)
          );
        }),
      )
    ) {
      forward = candidate;
      break;
    }
  }
  const right = new THREE.Vector3(-forward.z, 0, forward.x);
  const anchor = position.clone().addScaledVector(forward, 3.1);
  battle.anchor = anchor;
  battle.cameraPosition = position.clone();
  battle.leftPosition = position
    .clone()
    .addScaledVector(forward, 2.0)
    .addScaledVector(right, -0.65);
  battle.rightPosition = position
    .clone()
    .addScaledVector(forward, 4.1)
    .addScaledVector(right, 0.45);
  battle.left = actor(
    state.party[active].species,
    battle.leftPosition.x,
    battle.leftPosition.z,
  );
  battle.right = actor(
    battle.enemy.species,
    battle.rightPosition.x,
    battle.rightPosition.z,
  );
  faceBattleAnimals();
  battle.left.root.position.y = floor(anchor.x, anchor.z);
  battle.right.root.position.y = battle.left.root.position.y;
  if (companion) companion.root.visible = false;
  $("hud").hidden = true;
  $("battle").hidden = false;
  $("battle-continue").hidden = true;
  $("move-buttons").hidden = false;
  $("battle-actions").hidden = false;
  $("battle-kind").textContent =
    config.kind === "wild"
      ? "WILD ANIMAL"
      : config.kind === "gym"
        ? `DISTRICT LEADER / ${config.name.toUpperCase()}`
        : config.name.toUpperCase();
  $("battle-log").textContent =
    config.kind === "wild"
      ? `A wild ${battle.enemy.nickname} blocks your path.`
      : `${config.name} sends out ${battle.enemy.nickname}.`;
  renderBattle();
  sound("encounter");
  $("fight-btn").focus();
}
function faceBattleAnimals() {
  battle.left.root.lookAt(
    battle.right.root.position.x,
    battle.left.root.position.y,
    battle.right.root.position.z,
  );
  battle.right.root.lookAt(
    battle.left.root.position.x,
    battle.right.root.position.y,
    battle.left.root.position.z,
  );
}
function renderBattle() {
  if (!battle) return;
  const p = state.party[battle.active],
    e = battle.enemy;
  if (!state.seen.includes(e.species)) {
    recordSpecies(state, e.species);
    save();
  }
  $("enemy-name").textContent = e.nickname;
  $("enemy-level").textContent =
    `LV ${e.level} / ${SPECIES[e.species].type.toUpperCase()}`;
  $("enemy-hp").style.width = `${(100 * e.hp) / e.maxHp}%`;
  $("enemy-status").textContent =
    `${e.hp}/${e.maxHp} HP${e.status ? " · " + e.status.toUpperCase() : ""}`;
  $("ally-name").textContent = p.nickname;
  $("ally-level").textContent =
    `LV ${p.level} / ${SPECIES[p.species].type.toUpperCase()}`;
  $("ally-hp").style.width = `${(100 * p.hp) / p.maxHp}%`;
  $("ally-status").textContent =
    `${p.hp}/${p.maxHp} HP${p.status ? " · " + p.status.toUpperCase() : ""}`;
  $("battle-round").textContent = `TURN ${battle.turn}`;
  $("carrier-count").textContent = state.carriers;
  $("medkit-count").textContent = state.medkits;
  $("battle-root").hidden = battle.finished || battle.menu !== "root";
  $("move-buttons").hidden = battle.finished || battle.menu !== "fight";
  $("battle-actions").hidden = battle.finished || battle.menu !== "bag";
  $("battle-back").hidden = battle.finished || battle.menu === "root";
  for (const id of ["fight-btn", "bag-btn", "battle-back"])
    $(id).disabled = battle.busy || battle.finished;
  $("capture-help").hidden = battle.finished;
  $("capture-help").textContent =
    battle.config.kind === "wild"
      ? `CAPTURE ${Math.round(captureChance(e) * 100)}% · Lower HP and status effects improve the odds. ${state.party.length >= 6 ? "New captures go to clinic storage." : "Leave it conscious to capture it."}`
      : "LEAGUE RULES · You cannot capture another trainer’s animal.";
  $("move-buttons").replaceChildren();
  for (const id of SPECIES[p.species].moves) {
    const m = MOVES[id],
      button = document.createElement("button");
    button.innerHTML = `<b>${m.name}</b><small>${m.type.toUpperCase()} · ${m.power ? `POWER ${m.power}` : m.effect.toUpperCase()}</small>`;
    button.title = m.desc;
    button.disabled = battle.busy || battle.finished;
    button.onclick = () => turn(id);
    $("move-buttons").appendChild(button);
  }
  for (const id of ["capture-btn", "heal-btn", "switch-btn", "run-btn"])
    $(id).disabled = battle.busy || battle.finished;
  $("capture-btn").disabled ||=
    battle.config.kind !== "wild" ||
    state.carriers < 1 ||
    (state.party.length >= 6 && state.reserve.length >= RESERVE_LIMIT);
  $("heal-btn").disabled ||= state.medkits < 1;
  for (const [id, animal] of [
    ["enemy-hp", e],
    ["ally-hp", p],
  ])
    $(id).style.background =
      animal.hp / animal.maxHp < 0.2
        ? "#9d4634"
        : animal.hp / animal.maxHp < 0.5
          ? "#b18b3f"
          : "#4c743c";
  if (
    !battle.busy &&
    !battle.finished &&
    document.activeElement === document.body
  ) {
    const panel = $(
      battle.menu === "root"
        ? "battle-root"
        : battle.menu === "fight"
          ? "move-buttons"
          : "battle-actions",
    );
    panel.querySelector("button:not([disabled])")?.focus();
  }
}
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
for (const [id, menu] of [
  ["fight-btn", "fight"],
  ["bag-btn", "bag"],
  ["battle-back", "root"],
]) {
  $(id).onclick = () => {
    if (!battle || battle.busy || battle.finished) return;
    battle.menu = menu;
    renderBattle();
    if (menu === "root") $("fight-btn").focus();
    else
      $(menu === "fight" ? "move-buttons" : "battle-actions")
        .querySelector("button:not([disabled])")
        ?.focus();
  };
}
$("battle").addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    battle &&
    !battle.busy &&
    !battle.finished &&
    battle.menu !== "root"
  ) {
    $("battle-back").click();
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  if (
    !battle ||
    battle.busy ||
    !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
  )
    return;
  const panel = $(
    battle.menu === "root"
      ? "battle-root"
      : battle.menu === "fight"
        ? "move-buttons"
        : "battle-actions",
  );
  const buttons = [...panel.querySelectorAll("button:not([disabled])")];
  if (!buttons.length || !buttons.includes(document.activeElement)) return;
  const step =
    event.key === "ArrowUp"
      ? -2
      : event.key === "ArrowDown"
        ? 2
        : event.key === "ArrowLeft"
          ? -1
          : 1;
  const index = buttons.indexOf(document.activeElement);
  buttons[(index + step + buttons.length) % buttons.length].focus();
  event.preventDefault();
  event.stopPropagation();
});
async function perform(isPlayer, move) {
  if (!battle) return;
  const p = state.party[battle.active],
    e = battle.enemy;
  const result = attack(isPlayer ? p : e, isPlayer ? e : p, move);
  if (isPlayer) {
    state.party[battle.active] = result.a;
    battle.enemy = result.d;
  } else {
    battle.enemy = result.a;
    state.party[battle.active] = result.d;
  }
  const source = isPlayer ? battle.left : battle.right,
    target = isPlayer ? battle.right : battle.left;
  play(source, "Attack", true);
  $("battle-log").textContent = result.message;
  sound(result.amount ? "hit" : "status");
  await delay(350);
  if (result.amount) play(target, "Hit", true);
  renderBattle();
  await delay(550);
  play(source, "Idle");
  if ((isPlayer ? battle.enemy : state.party[battle.active]).hp > 0)
    play(target, "Idle");
}
function enemyMove() {
  const moves = SPECIES[battle.enemy.species].moves;
  const attacks = moves.filter((m) => MOVES[m].power);
  if (
    battle.enemy.hp < battle.enemy.maxHp * 0.25 &&
    moves.includes("hoard") &&
    Math.random() < 0.3
  )
    return "hoard";
  return attacks[Math.floor(Math.random() * attacks.length)];
}
async function turn(move) {
  if (!battle || battle.busy || battle.finished) return;
  battle.busy = true;
  renderBattle();
  const p = state.party[battle.active],
    e = battle.enemy;
  const playerFirst =
    SPECIES[p.species].speed + p.level >= SPECIES[e.species].speed + e.level;
  if (playerFirst) {
    await perform(true, move);
    if (battle.enemy.hp > 0) await perform(false, enemyMove());
  } else {
    await perform(false, enemyMove());
    if (state.party[battle.active].hp > 0) await perform(true, move);
  }
  await resolveRound();
}
async function resolveRound() {
  if (!battle) return;
  if (battle.enemy.hp <= 0) {
    play(battle.right, "Faint", true);
    await delay(650);
    battle.enemyIndex++;
    if (battle.enemyIndex < battle.config.roster.length) {
      removeActor(battle.right);
      battle.enemy = makeAnimal(
        battle.config.roster[battle.enemyIndex],
        battle.config.level,
      );
      battle.right = actor(
        battle.enemy.species,
        battle.rightPosition.x,
        battle.rightPosition.z,
      );
      battle.right.root.position.y = floor(battle.anchor.x, battle.anchor.z);
      faceBattleAnimals();
      $("battle-log").textContent =
        `${battle.config.name} sends out ${battle.enemy.nickname}.`;
    } else {
      winBattle();
      return;
    }
  }
  if (state.party[battle.active].hp <= 0) {
    play(battle.left, "Faint", true);
    await delay(650);
    const next = selectActive();
    if (next < 0) {
      battle.finished = true;
      $("battle-log").textContent =
        "Your entire party has fainted. Someone finally calls your mother.";
      $("move-buttons").hidden = true;
      $("battle-actions").hidden = true;
      $("battle-continue").hidden = false;
      $("battle-continue").onclick = () => {
        endBattle();
        blackout();
      };
      return;
    }
    swapAnimal(next);
    $("battle-log").textContent = `${state.party[next].nickname} takes over.`;
  }
  battle.busy = false;
  battle.turn++;
  save();
  renderBattle();
}
function winBattle(captured = false) {
  const c = battle.config;
  if (c.kind === "wild") {
    const roaming = actors.find((a) => a.hostile && a.target?.id === c.id);
    if (roaming) {
      roaming.respawnAt = time + 90;
      roaming.target.unavailable = true;
    }
  }
  if (captured) {
    const destination = collectAnimal(state, battle.enemy);
    $("battle-log").textContent =
      `Captured ${battle.enemy.nickname}. ${destination === "reserve" ? "Your party is full. The league courier took it to Gary’s clinic." : "It is now legally your problem."} ${state.caught.length}/${Object.keys(SPECIES).length} species registered.`;
  } else {
    state.money += c.kind === "wild" ? 25 : 120;
    state.party = state.party.map((p) => {
      const old = p.maxHp;
      p.level = Math.min(50, p.level + (c.kind === "wild" ? 1 : 2));
      p.maxHp = SPECIES[p.species].hp + p.level * 4;
      p.hp = p.hp > 0 ? Math.min(p.maxHp, p.hp + p.maxHp - old) : 0;
      p.status = null;
      p.attackStage = 0;
      return p;
    });
    if (c.kind === "gym") {
      state.badges.push(c.gym);
      state.party = state.party.map(restore);
      state.carriers += 3;
      state.medkits += 2;
      $("battle-log").textContent =
        `${DISTRICTS[c.gym].badge} Badge earned. Your animals gained two levels. The league permits you to continue.`;
    } else if (c.kind === "league") {
      state.league++;
      state.party = state.party.map(restore);
      state.completed = state.league === 4;
      $("battle-log").textContent = state.completed
        ? "County champion. Nobody questions the ethics of this."
        : "League round cleared. Your animals have been treated. Speak to Gary to continue.";
    } else
      $("battle-log").textContent =
        "Victory. Your animals gained experience. The adults remain untroubled.";
  }
  if (!state.wins.includes(c.id)) state.wins.push(c.id);
  battle.finished = true;
  battle.busy = false;
  $("move-buttons").hidden = true;
  $("battle-actions").hidden = true;
  $("battle-continue").hidden = false;
  $("battle-continue").onclick = () => {
    const ending = state.completed && c.kind === "league";
    endBattle();
    if (ending) open("ending");
  };
  save();
  sound("win");
  renderBattle();
}
function removeActor(a) {
  animalGroup.remove(a.root);
  a.mixer.stopAllAction();
  const i = actors.indexOf(a);
  if (i >= 0) actors.splice(i, 1);
}
function endBattle() {
  if (!battle) return;
  removeActor(battle.left);
  removeActor(battle.right);
  battle = null;
  $("battle").hidden = true;
  $("hud").hidden = false;
  syncCompanion();
  updateHUD();
  save();
}
function blackout() {
  state.party = state.party.map(restore);
  state.money = Math.max(0, state.money - 30);
  position.set(0, 1.35, 1.8);
  yaw = 0.34;
  pitch = -0.045;
  syncCompanion();
  save();
  updateHUD();
  toast(
    "You wake at home. Your animals are treated. Try a different move or train on wild animals.",
  );
}
function swapAnimal(index) {
  if (!battle || state.party[index].hp <= 0) return;
  battle.active = index;
  removeActor(battle.left);
  battle.left = actor(
    state.party[index].species,
    battle.leftPosition.x,
    battle.leftPosition.z,
  );
  battle.left.root.rotation.y = Math.PI;
  battle.left.root.position.y = floor(battle.anchor.x, battle.anchor.z);
  faceBattleAnimals();
  renderBattle();
}
$("capture-btn").onclick = async () => {
  if (
    !battle ||
    battle.busy ||
    battle.config.kind !== "wild" ||
    !state.carriers ||
    (state.party.length >= 6 && state.reserve.length >= RESERVE_LIMIT)
  )
    return;
  battle.busy = true;
  state.carriers--;
  renderBattle();
  $("battle-log").textContent =
    "You throw a pet carrier. Somehow, this is a recognised technique.";
  carrier.visible = true;
  carrier.position
    .copy(battle.left.root.position)
    .add(new THREE.Vector3(0, 0.5, 0));
  await delay(900);
  carrier.visible = false;
  if (Math.random() < captureChance(battle.enemy)) {
    play(battle.right, "Faint", true);
    winBattle(true);
  } else {
    $("battle-log").textContent =
      "It breaks free. Weaken it further before trying again.";
    await delay(700);
    await perform(false, enemyMove());
    await resolveRound();
  }
};
$("heal-btn").onclick = async () => {
  if (!battle || battle.busy || !state.medkits) return;
  battle.busy = true;
  state.medkits--;
  const p = state.party[battle.active];
  p.hp = Math.min(p.maxHp, p.hp + Math.ceil(p.maxHp * 0.6));
  $("battle-log").textContent =
    `Treated ${p.nickname}. The opponent does not pause for paperwork.`;
  renderBattle();
  await delay(750);
  await perform(false, enemyMove());
  await resolveRound();
};
$("run-btn").onclick = () => {
  if (!battle || battle.busy) return;
  if (battle.config.kind !== "wild") {
    toast("Trainer and league battles must be finished.");
    return;
  }
  endBattle();
  toast("You retreat. Sensible.");
};
$("switch-btn").onclick = () => {
  if (!battle || battle.busy) return;
  partySelection = true;
  showJournal("party");
};

function buildInteractions() {
  addTarget(
    "front-door",
    0,
    7.9,
    "Front door",
    () => {
      frontOpen = !frontOpen;
      toast(frontOpen ? "Front door opened." : "Front door closed.");
    },
    2,
    1.2,
  );
  addTarget("letter", -1.35, -2.6, "Letter from Mum", readLetter, 2, 1);
  addTarget(
    "radio",
    -2.78,
    -2.82,
    "County morning broadcast",
    () =>
      speak("WICKMERE RADIO / 88.1 FM", [
        "Good morning, Wickmere. It is five seventeen. Rain will continue until further notice. The council says this is character building.",
        "Today's league intake begins at County Research. Applicants must be ten or older. Parents are reminded that a white coat is not a qualification.",
        "In school news: attendance exemptions are available to children carrying a live animal and a sufficiently confident letter.",
      ]),
    1.5,
    1.05,
  );
  addTarget(
    "hall-bills",
    -1.74,
    6,
    "Unopened bills",
    () =>
      speak("FINAL REMINDER", [
        "Council tax. Electricity. School contributions. Your mother has underlined the dates twice.",
        "Underneath is a league brochure: A BRIGHTER FUTURE FOR YOUR CHILD. The entry fee has been circled.",
      ]),
    1.35,
    0.82,
  );
  addTarget(
    "door",
    0,
    3.9,
    "Bedroom door",
    () => {
      doorOpen = !doorOpen;
      toast(doorOpen ? "Door opened." : "Door closed.");
    },
    2,
    1.2,
  );
  addTarget("bed", 2, 0.6, "Rest your animals", rest, 2, 0.7);
  addTarget(
    "school-timetable",
    -71,
    67,
    "School bus timetable",
    () =>
      speak("COUNTY TRANSPORT", [
        "School service suspended. Children enrolled in the Animal League are considered independent travellers.",
        "Wickmere County School: follow the road to the crossing, then take the path through the gap in the stone wall. The crossing guard is accepting challengers outside.",
      ]),
    2.5,
    1.5,
  );
  addTarget(
    "school-notice",
    -99,
    50.1,
    "School notice board",
    () =>
      speak("NOTICE TO PARENTS", [
        "Lessons have been suspended during league intake. The school considers competitive animal handling equivalent to mathematics, geography and pastoral care.",
        "Please collect your child at the end of the championship. No date has been supplied.",
      ]),
    2,
    1.3,
  );
  addTarget("gary", 24, -15, "Gary, apparently a professor", talkGary, 3, 1.5);
  const gary = person("gary", 24, -15);
  gary.rotation.y = 0;
  person("rival", 13, -9);
  addTarget(
    "rival",
    13,
    -9,
    "Your neighbour",
    () => {
      if (!state.starter) {
        toast("Gary is waiting at the clinic.");
        return;
      }
      if (state.wins.includes("rival")) {
        speak("YOUR NEIGHBOUR", [
          "My dad says this builds character. He has not left the house all week.",
        ]);
        return;
      }
      speak(
        "YOUR NEIGHBOUR",
        [
          "Gary gave you an animal too? Good. We should battle. That is what everyone keeps telling us.",
        ],
        () =>
          startBattle({
            id: "rival",
            name: "Your neighbour",
            kind: "rival",
            roster: [
              state.starter === "dog"
                ? "cat"
                : state.starter === "cat"
                  ? "hamster"
                  : "dog",
            ],
            level: 4,
          }),
      );
    },
    3,
    1.3,
  );
  for (let i = 0; i < 8; i++) {
    const t = worldInfo.towns[i];
    person(i === 0 ? "crossing-guard" : "gary", t.gymX, t.gymZ);
    addTarget(
      "gym" + i,
      t.gymX,
      t.gymZ,
      DISTRICTS[i].leader,
      () => enterGym(i),
      3,
      1.5,
    );
  }
  // Fixed encounter sites plus patrol paths give the large map purposeful destinations.

  WILD_SITES.forEach(([x, z, species], i) => {
    const a = actor(species, x, z, 3 + Math.floor(i / 2), true);
    const target = addTarget(
      "wild" + i,
      x,
      z,
      `Wild ${SPECIES[species].name}`,
      () => {
        if (!state.starter) {
          toast("Choose a starter before approaching wild animals.");
          return;
        }
        startBattle({
          id: "wild" + i,
          name: `Wild ${SPECIES[species].name}`,
          kind: "wild",
          roster: [species],
          level: Math.max(2, Math.min(20, 3 + Math.floor(i / 2))),
        });
      },
      3,
      0.5,
    );
    a.target = target;
  });
  // The three actual animated starter models stand outside Gary's clinic.
  ["cat", "dog", "hamster"].forEach((s, i) => {
    const a = actor(s, 21 + i * 1.5, -16);
    a.stationary = true;
  });
}

function showJournal(tab = "map") {
  currentTab = tab;
  open("journal");
  renderJournal();
}
function renderJournal() {
  for (const t of ["map", "party", "register", "guide"])
    $("tab-" + t).hidden = t !== currentTab;
  document
    .querySelectorAll("[data-tab]")
    .forEach((b) =>
      b.classList.toggle("selected", b.dataset.tab === currentTab),
    );
  if (currentTab === "map") drawMap();
  if (currentTab === "register") {
    const panel = $("tab-register");
    panel.replaceChildren();
    const summary = document.createElement("p");
    summary.className = "register-summary";
    summary.textContent = `${state.seen.length}/${Object.keys(SPECIES).length} SEEN · ${state.caught.length}/${Object.keys(SPECIES).length} REGISTERED. Fieldworker age: 10. Supervising adult: not assigned.`;
    panel.appendChild(summary);
    const grid = document.createElement("div");
    grid.className = "species-grid";
    Object.entries(SPECIES).forEach(([id, species], index) => {
      const seen = state.seen.includes(id),
        caught = state.caught.includes(id);
      const card = document.createElement("article");
      card.className = `species-entry ${caught ? "registered" : ""}`;
      card.dataset.species = id;
      const number = document.createElement("small");
      number.textContent = `FILE ${String(index + 1).padStart(2, "0")} / ${caught ? "REGISTERED" : seen ? "SEEN" : "UNFILED"}`;
      const heading = document.createElement("h3");
      heading.textContent = seen ? species.name : "Unidentified animal";
      const location = document.createElement("p");
      location.textContent = seen
        ? `${species.type.toUpperCase()} CLASS · ${FIELD_NOTES[id][0]}`
        : "Encounter this species to open its file.";
      const note = document.createElement("p");
      note.textContent = caught
        ? FIELD_NOTES[id][1]
        : seen
          ? "Seen in the field. Capture one to complete this record."
          : "Observation pending.";
      card.append(number, heading, location, note);
      grid.appendChild(card);
    });
    panel.appendChild(grid);
  }
  if (currentTab === "party") {
    $("tab-party").replaceChildren();
    if (!state.party.length) {
      $("tab-party").textContent =
        "No animals. Gary has three starters at the clinic.";
      return;
    }
    state.party.forEach((a, i) => {
      const row = document.createElement("div");
      row.className = "party-row";
      row.innerHTML = `<div><h3>${a.nickname}</h3><p>LV ${a.level} · ${SPECIES[a.species].type.toUpperCase()} · ${a.hp}/${a.maxHp} HP</p></div>`;
      const b = document.createElement("button");
      b.textContent = partySelection ? "SEND OUT" : "MAKE LEAD";
      b.disabled = a.hp <= 0 || (battle && i === battle.active);
      b.onclick = async () => {
        if (battle) {
          close();
          swapAnimal(i);
          battle.busy = true;
          renderBattle();
          await delay(500);
          await perform(false, enemyMove());
          await resolveRound();
        } else {
          [state.party[0], state.party[i]] = [state.party[i], state.party[0]];
          syncCompanion();
          save();
          renderJournal();
          updateHUD();
        }
      };
      row.appendChild(b);
      if (!battle) {
        const store = document.createElement("button");
        store.textContent = "LEAVE AT CLINIC";
        store.disabled =
          !atAnimalStorage() ||
          state.party.length < 2 ||
          state.reserve.length >= RESERVE_LIMIT ||
          !state.party.some((p, j) => j !== i && p.hp > 0);
        store.onclick = () => {
          if (!atAnimalStorage() || !storeAnimal(state, i)) return;
          syncCompanion();
          save();
          renderJournal();
          updateHUD();
        };
        row.appendChild(store);
      }
      $("tab-party").appendChild(row);
    });
    const supplies = document.createElement("p");
    supplies.textContent = `£${state.money} · ${state.carriers} carriers · ${state.medkits} medkits. Treatment is free at home and at Gary’s clinic.`;
    $("tab-party").appendChild(supplies);
    for (const [kind, cost] of [
      ["carriers", 20],
      ["medkits", 30],
    ]) {
      const b = document.createElement("button");
      b.textContent = `BUY ${kind === "carriers" ? "CARRIER" : "MEDKIT"} · £${cost}`;
      b.disabled = Boolean(battle) || state.money < cost;
      b.onclick = () => {
        state.money -= cost;
        state[kind]++;
        save();
        renderJournal();
      };
      $("tab-party").appendChild(b);
    }
    if (!partySelection) {
      const heading = document.createElement("h3");
      heading.textContent = `CLINIC STORAGE · ${state.reserve.length}/${RESERVE_LIMIT}`;
      const explanation = document.createElement("p");
      explanation.textContent = atAnimalStorage()
        ? "Gary’s courier is available here. Keep at least one conscious animal with you."
        : "Visit home or Gary’s clinic to transfer animals. Further captures are collected by the league courier.";
      $("tab-party").append(heading, explanation);
      state.reserve.forEach((a, i) => {
        const row = document.createElement("div");
        row.className = "party-row";
        const label = document.createElement("div");
        label.textContent = `${a.nickname} · LV ${a.level} · IN CLINIC CARE`;
        const take = document.createElement("button");
        take.textContent = "TAKE ALONG";
        take.disabled =
          Boolean(battle) || !atAnimalStorage() || state.party.length >= 6;
        take.onclick = () => {
          if (battle || !atAnimalStorage() || !retrieveAnimal(state, i)) return;
          syncCompanion();
          save();
          renderJournal();
          updateHUD();
        };
        row.append(label, take);
        $("tab-party").appendChild(row);
      });
    }
  }
}
function atAnimalStorage() {
  return (
    !battle &&
    (Math.hypot(position.x - 24, position.z + 15) < 6 ||
      (Math.abs(position.x) < 4 && position.z > -4 && position.z < 8))
  );
}
const mapCoordinates = (x, z) => ({ x: 450 + x * 0.95, y: 300 + z * 0.8 });
function drawMap() {
  const c = $("map").getContext("2d");
  c.clearRect(0, 0, 900, 600);
  c.fillStyle = "#142126";
  c.fillRect(0, 0, 900, 600);
  c.strokeStyle = "#a2b6a311";
  c.lineWidth = 1;
  for (let i = 0; i < 900; i += 45) {
    c.beginPath();
    c.moveTo(i, 0);
    c.lineTo(i, 600);
    c.stroke();
  }
  for (let i = 0; i < 600; i += 40) {
    c.beginPath();
    c.moveTo(0, i);
    c.lineTo(900, i);
    c.stroke();
  }
  c.strokeStyle = "#71826a";
  c.lineWidth = 5;
  c.beginPath();
  const route = [[0, 20], ...worldInfo.towns.map((t) => [t.x, t.z]), [0, 20]];
  route.forEach(([x, z], i) => {
    const p = mapCoordinates(x, z);
    i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y);
  });
  c.stroke();
  c.font = "12px monospace";
  worldInfo.towns.forEach((t, i) => {
    const p = mapCoordinates(t.x, t.z);
    c.fillStyle = state.badges.includes(i) ? "#ceb37c" : "#718481";
    c.beginPath();
    c.arc(p.x, p.y, 7, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#c7d1c2";
    c.fillText(`${i + 1}. ${DISTRICTS[i].name}`, p.x + 12, p.y - 8);
  });
  for (const [x, z, name] of [
    [0, 0, "HOME"],
    [24, -23, "CLINIC"],
  ]) {
    const p = mapCoordinates(x, z);
    c.fillStyle = "#adba9a";
    c.fillRect(p.x - 3, p.y - 3, 6, 6);
    c.fillText(name, p.x + 10, p.y + 12);
  }
  const p = mapCoordinates(position.x, position.z);
  c.fillStyle = "#ecceb0";
  c.beginPath();
  c.arc(p.x, p.y, 5, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "#ecceb0";
  c.beginPath();
  c.moveTo(p.x, p.y);
  c.lineTo(p.x - Math.sin(yaw) * 15, p.y - Math.cos(yaw) * 15);
  c.stroke();
  $("map-caption").textContent =
    "WICKMERE COUNTY · 1.2 × 1.2 KM · Follow the ring road. Click an earned badge location to take the league bus. Home and clinic travel unlocks after the first badge.";
  $("badge-list").innerHTML = DISTRICTS.map(
    (d, i) =>
      `<span class="${state.badges.includes(i) ? "won" : ""}">${i + 1}. ${d.badge}</span>`,
  ).join("");
}
$("map").onclick = (e) => {
  if (battle) return;
  const r = $("map").getBoundingClientRect(),
    x = ((e.clientX - r.left) * 900) / r.width,
    y = ((e.clientY - r.top) * 600) / r.height;
  for (let i = 0; i < 8; i++) {
    const t = worldInfo.towns[i],
      p = mapCoordinates(t.x, t.z);
    if (Math.hypot(x - p.x, y - p.y) < 25 && state.badges.includes(i)) {
      position.set(t.x, 1.35, t.z);
      close();
      syncCompanion();
      save();
      toast(`League bus: ${DISTRICTS[i].name}. Children travel unaccompanied.`);
      return;
    }
  }
  const p = mapCoordinates(0, 0);
  if (Math.hypot(x - p.x, y - p.y) < 40 && state.badges.length) {
    position.set(0, 1.35, 8);
    close();
    syncCompanion();
    save();
  }
};
for (const b of document.querySelectorAll("[data-tab]"))
  b.onclick = () => {
    currentTab = b.dataset.tab;
    renderJournal();
  };
$("menu-btn").onclick = () => {
  if (!modal && !battle) showJournal();
};
$("close-journal").onclick = close;
$("motion").checked = cameraMotion;
$("motion").checked = cameraMotion;
$("motion").onchange = (e) => {
  cameraMotion = e.target.checked;
  settings.motion = cameraMotion;
  rememberSettings();
};
$("sensitivity").value = lookSensitivity;
$("sensitivity").oninput = (e) => {
  lookSensitivity = Number(e.target.value);
  settings.sensitivity = lookSensitivity;
  rememberSettings();
};
function applyGraphics(quality) {
  quality = ["high", "balanced", "performance"].includes(quality)
    ? quality
    : "high";
  settings.quality = quality;
  $("graphics").value = quality;
  renderer.setPixelRatio(
    Math.min(
      devicePixelRatio,
      quality === "high" ? 1.6 : quality === "balanced" ? 1.2 : 1,
    ),
  );
  composer.setPixelRatio(renderer.getPixelRatio());
  contactShadows.enabled = quality !== "performance";
  bloom.enabled = quality !== "performance";
  renderer.shadowMap.enabled = quality !== "performance";
  rememberSettings();
}
$("graphics").onchange = (e) => applyGraphics(e.target.value);
applyGraphics(settings.quality || (innerWidth < 760 ? "performance" : "high"));
renderer.toneMappingExposure = Math.max(
  0.8,
  Math.min(2, Number(settings.brightness) || 1.35),
);
$("brightness").value = renderer.toneMappingExposure;
$("brightness").oninput = (e) => {
  renderer.toneMappingExposure = Number(e.target.value);
  settings.brightness = renderer.toneMappingExposure;
  rememberSettings();
};
$("reset").onclick = () => ($("reset-confirm").hidden = false);
$("reset-yes").onclick = () => {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {}
  location.reload();
};
$("ending-close").onclick = () => {
  close();
  position.set(0, 1.35, 1.8);
  yaw = 0.34;
  pitch = -0.045;
  syncCompanion();
  save();
  updateHUD();
};

function interact() {
  if (modal || battle || !playing) return;
  activeTarget?.fn();
}
$("interact-btn").onclick = interact;
function requestLook() {
  if (!playing || modal || battle) return;
  const result = renderer.domElement.requestPointerLock?.();
  result?.catch(() => {
    $("look-hint").textContent = "DRAG TO LOOK · ARROW KEYS ALSO TURN";
  });
}
renderer.domElement.addEventListener("pointerdown", (e) => {
  if (!playing || modal || battle) return;
  if (e.pointerType === "touch") {
    if (e.clientX > innerWidth * 0.4) lookDrag = true;
  } else {
    lookDrag = true;
    requestLook();
  }
});
window.addEventListener("pointerup", () => (lookDrag = false));
window.addEventListener("pointercancel", () => (lookDrag = false));
let previousTouch = null;
window.addEventListener("pointermove", (e) => {
  if (!playing || modal || battle) return;
  if (document.pointerLockElement === renderer.domElement || lookDrag) {
    let dx = e.movementX,
      dy = e.movementY;
    if (e.pointerType === "touch") {
      dx = previousTouch ? e.clientX - previousTouch.x : 0;
      dy = previousTouch ? e.clientY - previousTouch.y : 0;
      previousTouch = { x: e.clientX, y: e.clientY };
    }
    yaw -= dx * lookSensitivity;
    pitch = Math.max(-1.3, Math.min(1.3, pitch - dy * lookSensitivity));
  }
});
window.addEventListener("pointerup", () => (previousTouch = null));
document.addEventListener("pointerlockerror", () => {
  $("look-hint").textContent = "DRAG TO LOOK · ARROW KEYS ALSO TURN";
});
window.addEventListener("keydown", (e) => {
  if (modal) {
    if (e.key === "Escape" && modal === "journal") close();
    if (e.key === "Tab") {
      const nodes = [
        ...$(modal).querySelectorAll("button:not([disabled]),input,select"),
      ].filter((n) => n.offsetParent !== null);
      if (!e.shiftKey && document.activeElement === nodes.at(-1)) {
        e.preventDefault();
        nodes[0]?.focus();
      } else if (e.shiftKey && document.activeElement === nodes[0]) {
        e.preventDefault();
        nodes.at(-1)?.focus();
      }
    }
    return;
  }
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key))
    e.preventDefault();
  keys.add(e.key.toLowerCase());
  if (e.repeat) return;
  if (e.key.toLowerCase() === "e") interact();
  if (e.key.toLowerCase() === "f") {
    flashlight.visible = !flashlight.visible;
    if (torch) torch.visible = flashlight.visible;
  }
  if (e.key.toLowerCase() === "j" && !battle && playing) showJournal();
  if (battle && ["1", "2", "3", "4"].includes(e.key))
    turn(SPECIES[state.party[battle.active].species].moves[Number(e.key) - 1]);
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener("blur", () => {
  keys.clear();
  lookDrag = false;
  save();
});
for (const b of document.querySelectorAll("#pad button")) {
  b.onpointerdown = (e) => {
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    keys.add(b.dataset.key);
  };
  b.onpointerup = b.onpointercancel = () => keys.delete(b.dataset.key);
}

function tone(f, duration = 0.1, volume = 0.05, delay = 0) {
  if (!soundOn) return;
  const o = audioContext.createOscillator(),
    g = audioContext.createGain(),
    t = audioContext.currentTime + delay;
  o.type = "triangle";
  o.frequency.value = f;
  g.gain.setValueAtTime(volume, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  o.connect(g);
  g.connect(audioContext.destination);
  o.start(t);
  o.stop(t + duration + 0.01);
}
function sound(kind) {
  if (kind === "win")
    [196, 246.94, 293.66, 392].forEach((f, i) => tone(f, 0.4, 0.025, i * 0.12));
  else if (kind === "hit") {
    tone(70, 0.17, 0.07);
    tone(43, 0.12, 0.04, 0.03);
  } else if (kind === "encounter") {
    tone(110, 0.35, 0.025);
    tone(116, 0.35, 0.02, 0.08);
  } else tone(300, 0.12, 0.025);
}
$("audio-btn").onclick = async () => {
  soundOn = !soundOn;
  if (soundOn) {
    audioContext ||= new AudioContext();
    await audioContext.resume();
    if (!noiseSource) {
      const buffer = audioContext.createBuffer(
          1,
          audioContext.sampleRate * 3,
          audioContext.sampleRate,
        ),
        data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++)
        data[i] = (Math.random() * 2 - 1) * 0.3;
      noiseSource = audioContext.createBufferSource();
      noiseSource.buffer = buffer;
      noiseSource.loop = true;
      const filter = audioContext.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 850;
      noiseGain = audioContext.createGain();
      noiseGain.gain.value = 0.07;
      noiseSource.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(audioContext.destination);
      noiseSource.start();
    }
    noiseGain.gain.value = 0.07;
  } else if (noiseGain) noiseGain.gain.value = 0;
  $("audio-btn").textContent = soundOn ? "SOUND ON" : "SOUND OFF";
};
document.addEventListener("visibilitychange", () => {
  keys.clear();
  if (audioContext) {
    if (document.hidden) audioContext.suspend();
    else if (soundOn) audioContext.resume();
  }
  if (playing) save();
});

// Rain reuses the Blender-authored raindrop mesh through instancing.
let rainMesh,
  rainData = [];
const dummy = new THREE.Object3D();
function buildRain() {
  let source;
  assets.rain.scene.traverse((o) => {
    if (o.isMesh && !source) source = o;
  });
  rainMesh = new THREE.InstancedMesh(source.geometry, source.material, 650);
  rainMesh.frustumCulled = false;
  scene.add(rainMesh);
  for (let i = 0; i < 650; i++)
    rainData.push({
      x: Math.random() * 80 - 40,
      z: Math.random() * 80 - 40,
      y: Math.random() * 25,
    });
}
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.045);
  last = now;
  time += dt;
  if (!worldInfo) return;
  for (const a of actors) {
    if (a.scenery) {
      a.root.visible = a.root.position.distanceToSquared(position) < 170 * 170;
      if (!a.root.visible) continue;
    }
    a.mixer.update(dt);
    if (a.stationary || (battle && (a === battle.left || a === battle.right)))
      continue;
    if (a === companion) {
      a.root.visible = !battle;
      if (battle) continue;
      const previous = a.root.position.clone();
      const walking =
        playing &&
        !modal &&
        followTrail(a.root.position, a.trail, position, dt, collision);
      if (walking) {
        a.root.rotation.y = Math.atan2(
          a.root.position.x - previous.x,
          a.root.position.z - previous.z,
        );
        play(a, "Walk");
      } else play(a, "Idle");
      a.root.position.y = floor(a.root.position.x, a.root.position.z);
    } else if (a.hostile) {
      const distance = a.root.position.distanceTo(position);
      const recovering = (a.respawnAt ?? 0) > time;
      a.target.unavailable = recovering;
      a.root.visible =
        distance < 100 && !recovering && a.target.id !== battle?.config.id;
      if (recovering) continue;
      if (distance > 100) continue;
      const walking = updateWander(
        a.wander,
        dt,
        position,
        collision,
        Boolean(battle || modal || !playing),
      );
      a.root.position.set(
        a.wander.x,
        floor(a.wander.x, a.wander.z),
        a.wander.z,
      );
      const turn = Math.atan2(
        Math.sin(a.wander.heading - a.root.rotation.y),
        Math.cos(a.wander.heading - a.root.rotation.y),
      );
      a.root.rotation.y += turn * Math.min(1, dt * 4);
      play(a, walking ? "Walk" : "Idle");
      if (a.target) {
        a.target.x = a.root.position.x;
        a.target.z = a.root.position.z;
      }
    }
  }
  doorAngle = THREE.MathUtils.damp(
    doorAngle,
    doorOpen ? -Math.PI * 0.48 : 0,
    5,
    dt,
  );
  if (door) door.rotation.y = doorAngle;
  frontAngle = THREE.MathUtils.damp(
    frontAngle,
    frontOpen ? -Math.PI * 0.48 : 0,
    5,
    dt,
  );
  if (frontDoor) frontDoor.rotation.y = frontAngle;
  let moving = false;
  if (playing && !modal && !battle) {
    if (keys.has("arrowleft")) yaw += dt * 1.4;
    if (keys.has("arrowright")) yaw -= dt * 1.4;
    if (keys.has("arrowup")) pitch = Math.min(1.3, pitch + dt);
    if (keys.has("arrowdown")) pitch = Math.max(-1.3, pitch - dt);
    let x = (keys.has("d") ? 1 : 0) - (keys.has("a") ? 1 : 0),
      z = (keys.has("s") ? 1 : 0) - (keys.has("w") ? 1 : 0);
    if (x || z) {
      const l = Math.hypot(x, z);
      x /= l;
      z /= l;
      const running = keys.has("shift") && stamina > 2,
        speed = running ? 6.6 : 3.2;
      const dx = (x * Math.cos(yaw) + z * Math.sin(yaw)) * speed * dt,
        dz = (-x * Math.sin(yaw) + z * Math.cos(yaw)) * speed * dt;
      if (!collision(position.x + dx, position.z)) position.x += dx;
      if (!collision(position.x, position.z + dz)) position.z += dz;
      moving = true;
      if (running) stamina = Math.max(0, stamina - dt * 15);
      else stamina = Math.min(100, stamina + dt * 8);
    } else stamina = Math.min(100, stamina + dt * 15);
    const ground = floor(position.x, position.z);
    position.y = THREE.MathUtils.damp(position.y, ground + 1.35, 15, dt);
    footTimer += dt;
    if (moving && footTimer > 0.4) {
      footTimer = 0;
      tone(55 + Math.random() * 15, 0.07, 0.028);
    }
    const direction = new THREE.Vector3(
      -Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch),
    );
    activeTarget = null;
    for (const t of targets) {
      if (t.unavailable) continue;
      const v = new THREE.Vector3(
          t.x - position.x,
          t.y + floor(t.x, t.z) - position.y,
          t.z - position.z,
        ),
        dist = v.length();
      if (
        dist < t.radius &&
        v.normalize().dot(direction) > 0.45 &&
        (!activeTarget || dist < activeTarget.distance)
      )
        activeTarget = { ...t, distance: dist };
    }
    $("interact").hidden = !activeTarget;
    $("interact-label").textContent = activeTarget?.name || "";
    saveTimer += dt;
    if (saveTimer > 8) {
      saveTimer = 0;
      save();
    }
  } else $("interact").hidden = true;
  if (battle) {
    const h = floor(battle.anchor.x, battle.anchor.z);
    camera.position.copy(battle.cameraPosition);
    camera.lookAt(battle.anchor.x, h + 0.28, battle.anchor.z);
    if (carrier.visible) {
      carrier.position.lerp(
        battle.right.root.position.clone().add(new THREE.Vector3(0, 0.35, 0)),
        dt * 4,
      );
      carrier.rotation.x += dt * 7;
    }
  } else {
    camera.position.copy(position);
    if (cameraMotion && moving)
      camera.position.y += Math.sin(time * 11) * 0.023;
    camera.rotation.set(pitch, yaw, 0, "YXZ");
    if (!playing) {
      camera.position.set(0.15, 1.28, 1.9);
      camera.rotation.set(-0.035, 0.34, 0, "YXZ");
    }
  }
  const targetFov = battle ? 52 : 68;
  if (Math.abs(camera.fov - targetFov) > 0.01) {
    camera.fov = cameraMotion
      ? THREE.MathUtils.damp(camera.fov, targetFov, 6, dt)
      : targetFov;
    camera.updateProjectionMatrix();
  }
  if (torch) {
    torch.position
      .copy(camera.position)
      .add(
        new THREE.Vector3(0.2, -0.2, -0.38).applyQuaternion(camera.quaternion),
      );
    torch.quaternion.copy(camera.quaternion);
    torch.rotateX(Math.PI / 2);
    torch.visible = flashlight.visible && !battle;
  }
  flashlight.position
    .copy(camera.position)
    .add(
      new THREE.Vector3(0.15, -0.15, -0.08).applyQuaternion(camera.quaternion),
    );
  flashlight.target.position
    .copy(camera.position)
    .add(new THREE.Vector3(0, 0, -12).applyQuaternion(camera.quaternion));
  moon.position.set(position.x + 20, 35, position.z - 25);
  moon.target.position.set(position.x, 0, position.z);
  const inside = Math.abs(position.x) < 4.2 && Math.abs(position.z) < 4.2;
  ambient.intensity = THREE.MathUtils.damp(
    ambient.intensity,
    inside ? 0.6 : battle ? 1.15 : 0.95,
    3,
    dt,
  );
  battleLight.visible = Boolean(battle);
  if (battle)
    battleLight.position.set(battle.anchor.x - 1, 3, battle.anchor.z + 2);
  const nearestLamps = [...worldInfo.lights]
    .sort(
      (a, b) =>
        Math.hypot(a.x - position.x, a.z - position.z) -
        Math.hypot(b.x - position.x, b.z - position.z),
    )
    .slice(0, 4);
  streetLights.forEach((l, i) => {
    const p = nearestLamps[i];
    l.visible =
      Boolean(p) && Math.hypot(p.x - position.x, p.z - position.z) < 45;
    if (p) l.position.set(p.x, p.y, p.z);
  });
  if (rainMesh) {
    for (let i = 0; i < rainData.length; i++) {
      const r = rainData[i];
      r.y -= dt * 12;
      if (r.y < 0) r.y = 25;
      const rx = position.x + r.x,
        rz = position.z + r.z;
      dummy.position.set(rx, r.y + floor(rx, rz), rz);
      dummy.rotation.z = 0.1;
      dummy.scale.setScalar(Math.abs(rx) < 4.3 && Math.abs(rz) < 4.3 ? 0 : 1);
      dummy.updateMatrix();
      rainMesh.setMatrixAt(i, dummy.matrix);
    }
    rainMesh.instanceMatrix.needsUpdate = true;
  }
  if (playing && !battle) {
    $("location").textContent = inside ? "YOUR BEDROOM" : regionName();
    const goal = setObjective(),
      dist = Math.hypot(goal.x - position.x, goal.z - position.z);
    $("waypoint").innerHTML =
      `${Math.round(dist)} M<small>${goal.name}</small>`;
    $("stamina").firstElementChild.style.width = stamina + "%";
  }
  modularWorld?.updateVisibility(position);
  renderer.info.reset();
  composer.render();
}
function regionName() {
  if (Math.abs(position.x + 93) < 17 && position.z > 36 && position.z < 64)
    return "WICKMERE / COUNTY SCHOOL";
  const routeProgress = (-120 * position.x + 70 * (position.z - 20)) / 19300;
  const routeDistance =
    Math.abs(70 * position.x + 120 * (position.z - 20)) / Math.sqrt(19300);
  if (routeProgress > 0.18 && routeProgress < 0.96 && routeDistance < 19)
    return "WICKMERE / OLD SCHOOL ROAD";
  let nearest = -1,
    distance = Infinity;
  worldInfo.towns.forEach((t, i) => {
    const d = Math.hypot(t.x - position.x, t.z - position.z);
    if (d < distance) {
      distance = d;
      nearest = i;
    }
  });
  if (Math.hypot(position.x, position.z) < 60)
    return "WICKMERE / HOME DISTRICT";
  return distance < 65
    ? DISTRICTS[nearest].name.toUpperCase()
    : "COUNTY RING ROAD";
}
requestAnimationFrame(frame);
window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});
$("begin").onclick = () => {
  playing = true;
  $("title").hidden = true;
  $("hud").hidden = false;
  if (state.starter) {
    doorOpen = true;
    frontOpen = true;
    syncCompanion();
  } else position.set(0, 1.35, 1.8);
  updateHUD();
  requestLook();
};
async function load() {
  const loader = new GLTFLoader();
  const [catalog, layout, lighting] = await Promise.all(
    ["asset-catalog.json", "bedroom-layout.json", "world-lighting.json"].map(
      async (file) => {
        const response = await fetch(base + file);
        if (!response.ok) throw new Error(file + " missing");
        return response.json();
      },
    ),
  );
  const names = Object.keys(catalog);
  const sky = await new HDRLoader().loadAsync(base + lighting.environment);
  sky.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = sky;
  scene.environmentIntensity = 0.7;
  scene.background = sky;
  scene.backgroundIntensity = 0.8;
  let loaded = 0;
  await Promise.all(
    names.map(async (name) => {
      assets[name] = await loader.loadAsync(`${base}models/${name}.glb`);
      loaded++;
      $("progress").textContent =
        Math.round((loaded / names.length) * 100) + "%";
    }),
  );
  for (const a of Object.values(assets)) setupMesh(a.scene);
  modularWorld = assembleWorld(scene, assets, catalog, layout);
  worldInfo = modularWorld.info;
  region = modularWorld.root;
  actors.push(...modularWorld.animated);
  door = asset("door", -0.7, 4);
  frontDoor = asset("door", -0.7, 8);
  torch = asset("torch");
  torch.visible = false;
  carrier = asset("carrier");
  carrier.visible = false;
  buildInteractions();
  buildRain();
  if (state.starter) syncCompanion();
  $("begin").disabled = false;
  $("begin").innerHTML = state.starter
    ? "CONTINUE YOUR JOURNEY <span>→</span>"
    : "WAKE UP <span>→</span>";
}
load().catch(showError);
if (import.meta.env.DEV)
  window.__debug = {
    position: () => ({
      x: position.x,
      y: position.y,
      z: position.z,
      yaw,
      pitch,
    }),
    stats: () => ({
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      actors: actors.length,
      placements: modularWorld?.placementLog.length,
    }),
    assets: () =>
      Object.fromEntries(
        Object.entries(assets).map(([k, v]) => [
          k,
          v.animations.map((c) => c.name),
        ]),
      ),
    target: () => activeTarget?.id,
    animals: () =>
      actors
        .filter((a) => a.hostile || a === companion)
        .map((a) => ({
          species: a.species,
          companion: a === companion,
          target: a.target?.id,
          x: a.root.position.x,
          z: a.root.position.z,
          animation: a.clip,
          blocked: collision(a.root.position.x, a.root.position.z),
          visible: a.root.visible,
        })),
  };
