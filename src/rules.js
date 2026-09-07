import { cleanMessages } from "./phone-messages.js";
export const SAVE_KEY = "ordinary-animals-dark-v2";
export const RESERVE_LIMIT = 120;
export const SPECIES = {
  cat: {
    name: "Cat",
    type: "feline",
    hp: 46,
    attack: 15,
    defense: 10,
    speed: 18,
    moves: ["scratch", "bite", "hiss", "pounce"],
    scale: 1,
  },
  dog: {
    name: "Dog",
    type: "canine",
    hp: 58,
    attack: 17,
    defense: 13,
    speed: 13,
    moves: ["bite", "tackle", "growl", "howl"],
    scale: 1,
  },
  hamster: {
    name: "Hamster",
    type: "rodent",
    hp: 42,
    attack: 14,
    defense: 11,
    speed: 20,
    moves: ["nibble", "rush", "sand", "hoard"],
    scale: 1.6,
  },
  rat: {
    name: "Rat",
    type: "rodent",
    hp: 40,
    attack: 14,
    defense: 8,
    speed: 21,
    moves: ["nibble", "bite", "sand", "rush"],
    scale: 1.4,
  },
  rabbit: {
    name: "Rabbit",
    type: "rodent",
    hp: 48,
    attack: 13,
    defense: 12,
    speed: 20,
    moves: ["tackle", "rush", "sand", "hoard"],
    scale: 1,
  },
  fox: {
    name: "Fox",
    type: "canine",
    hp: 55,
    attack: 19,
    defense: 11,
    speed: 19,
    moves: ["bite", "pounce", "growl", "howl"],
    scale: 1,
  },
  raccoon: {
    name: "Raccoon",
    type: "feline",
    hp: 56,
    attack: 16,
    defense: 15,
    speed: 12,
    moves: ["scratch", "bite", "sand", "hoard"],
    scale: 1,
  },
  goat: {
    name: "Goat",
    type: "canine",
    hp: 70,
    attack: 20,
    defense: 17,
    speed: 9,
    moves: ["tackle", "rush", "growl", "howl"],
    scale: 1,
  },
};
export const MOVES = {
  scratch: {
    name: "Scratch",
    power: 19,
    type: "feline",
    desc: "Claws. Exactly what you think.",
  },
  bite: {
    name: "Bite",
    power: 20,
    type: "canine",
    desc: "A concerningly normal attack.",
  },
  hiss: {
    name: "Hiss",
    power: 0,
    effect: "weaken",
    type: "feline",
    desc: "Lowers the opponent’s attack.",
  },
  pounce: {
    name: "Pounce",
    power: 30,
    accuracy: 0.85,
    type: "feline",
    desc: "Strong, but can miss.",
  },
  tackle: {
    name: "Body Check",
    power: 24,
    accuracy: 0.95,
    type: "canine",
    desc: "Settles a territorial dispute.",
  },
  growl: {
    name: "Growl",
    power: 0,
    effect: "weaken",
    type: "canine",
    desc: "Lowers the opponent’s attack.",
  },
  howl: {
    name: "Howl",
    power: 0,
    effect: "boost",
    type: "canine",
    desc: "Raises your attack.",
  },
  nibble: {
    name: "Nibble",
    power: 18,
    type: "rodent",
    desc: "Small teeth. Real consequences.",
  },
  rush: {
    name: "Wheel Rush",
    power: 27,
    accuracy: 0.9,
    type: "rodent",
    desc: "Years of cardio, finally useful.",
  },
  sand: {
    name: "Pocket Sand",
    power: 9,
    effect: "daze",
    type: "rodent",
    desc: "May interrupt their next turn.",
  },
  hoard: {
    name: "Emergency Rations",
    power: 0,
    effect: "heal",
    type: "rodent",
    desc: "Recovers a little HP. Counts as a turn.",
  },
  focus: {
    name: "Patient Stalk",
    power: 0,
    effect: "boost",
    type: "feline",
    desc: "Raises attack. The opponent still gets its turn.",
  },
  brace: {
    name: "Dig In",
    power: 0,
    effect: "guard",
    type: "rodent",
    desc: "Raises defence until switched out or this battle ends. Uses a turn.",
  },
  rake: {
    name: "Raking Claws",
    power: 32,
    accuracy: 0.95,
    type: "feline",
    desc: "A practised claw attack. More reliable than Pounce.",
  },
  charge: {
    name: "Shoulder Charge",
    power: 37,
    accuracy: 0.85,
    type: "canine",
    desc: "A forceful charge with a real chance of missing.",
  },
  scurry: {
    name: "Scramble",
    power: 30,
    accuracy: 1,
    type: "rodent",
    desc: "A reliable flurry from an experienced small animal.",
  },
  ambush: {
    name: "Ambush",
    power: 34,
    accuracy: 0.95,
    type: "canine",
    desc: "A veteran fox picks its opening.",
  },
};
export const TYPE_EDGE = {
  feline: "rodent",
  rodent: "canine",
  canine: "feline",
};
// League classes are the game's intentionally dubious taxonomy. Advantage follows
// the move's class, not the species using it; Bite gives a cat canine coverage.
export const TYPE_MATRIX = {
  feline: { feline: 1, rodent: 1.3, canine: 0.8 },
  rodent: { feline: 0.8, rodent: 1, canine: 1.3 },
  canine: { feline: 1.3, rodent: 0.8, canine: 1 },
};
const LEARNSET_IDS = {
  cat: ["scratch", "bite", "hiss", "pounce", "focus", "rake"],
  dog: ["tackle", "bite", "growl", "howl", "brace", "charge"],
  hamster: ["nibble", "hoard", "sand", "rush", "brace", "scurry"],
  rat: ["nibble", "bite", "sand", "rush", "focus", "scurry"],
  rabbit: ["tackle", "hoard", "sand", "rush", "brace", "scurry"],
  fox: ["bite", "pounce", "growl", "howl", "focus", "ambush"],
  raccoon: ["scratch", "hoard", "sand", "bite", "brace", "rake"],
  goat: ["tackle", "rush", "growl", "howl", "brace", "charge"],
};
const ROLES = {
  cat: "Fast feline attacker with Bite for coverage and Hiss for longer fights.",
  dog: "Sturdy canine bruiser; slower than a cat, with stronger defence.",
  hamster: "Quick rodent with early recovery and disruptive Pocket Sand.",
  rat: "Fragile, very fast rodent; learns a second attack class early.",
  rabbit: "Quick and resilient; recovery comes early, Wheel Rush at level 10.",
  fox: "Fast canine hunter with high attack and lighter defence.",
  raccoon: "Defensive feline with recovery and disruptive attacks.",
  goat: "Slow, durable and strong. Rodent moves threaten it.",
};
for (const [id, ids] of Object.entries(LEARNSET_IDS)) {
  SPECIES[id].moves = ids;
  SPECIES[id].learnset = ids.map((move, i) => ({
    move,
    level: [1, 3, 5, 10, 18, 28][i],
  }));
  SPECIES[id].role = ROLES[id];
}
export const GROWTH_STAGES = [
  {
    id: "juvenile",
    label: "Juvenile",
    level: 1,
    scale: 0.8,
    statMultiplier: 0.95,
    speedBonus: 0,
  },
  {
    id: "adult",
    label: "Adult",
    level: 10,
    scale: 1,
    statMultiplier: 1,
    speedBonus: 1,
  },
  {
    id: "veteran",
    label: "Veteran",
    level: 20,
    scale: 1.05,
    statMultiplier: 1.08,
    speedBonus: 2,
  },
];
export function growthFor(animal) {
  const stage =
    GROWTH_STAGES.findLast((s) => animal.level >= s.level) ?? GROWTH_STAGES[0];
  return {
    ...stage,
    nextLevel: GROWTH_STAGES.find((s) => s.level > animal.level)?.level ?? null,
  };
}
export function battleStats(animal) {
  const species = SPECIES[animal.species];
  if (!Object.hasOwn(SPECIES, animal.species))
    throw new Error("Unknown species");
  const growth = growthFor(animal);
  return {
    maxHp: Math.round((species.hp + animal.level * 4) * growth.statMultiplier),
    attack: (species.attack + animal.level * 2) * growth.statMultiplier,
    defense: (species.defense + animal.level) * growth.statMultiplier,
    speed: species.speed + animal.level + growth.speedBonus,
  };
}
export function learnedMoves(animal) {
  if (!Object.hasOwn(SPECIES, animal.species)) return [];
  return SPECIES[animal.species].learnset
    .filter((s) => s.level <= animal.level)
    .map((s) => s.move);
}
export function unlockedMoves(animal) {
  const learned = learnedMoves(animal);
  const selected = Array.isArray(animal.moves)
    ? [...new Set(animal.moves.filter((id) => learned.includes(id)))].slice(
        0,
        4,
      )
    : [];
  return selected.length ? selected : learned.slice(-4);
}
export function setMoveLoadout(animal, ids) {
  const learned = learnedMoves(animal);
  if (
    !Array.isArray(ids) ||
    ids.length < 1 ||
    ids.length > 4 ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !learned.includes(id))
  )
    throw new Error("Choose one to four distinct learned moves");
  if (!ids.some((id) => MOVES[id].power))
    throw new Error("Keep at least one damaging move");
  return { ...animal, moves: [...ids] };
}
export function sanitizeName(value, fallback = "Alex") {
  if (typeof value !== "string") return fallback;
  const name = [
    ...value
      .normalize("NFKC")
      .replace(/[^\p{L}\p{N} .'-]/gu, "")
      .replace(/\s+/g, " ")
      .trim(),
  ]
    .slice(0, 18)
    .join("")
    .trim();
  return name || fallback;
}
export const DISTRICTS = [
  {
    name: "Wickmere",
    leader: "The Crossing Guard",
    badge: "Permission",
    roster: ["rat", "dog"],
    quote:
      "You are ten? Fine. Look both ways before commanding the dog to bite.",
  },
  {
    name: "Ash End",
    leader: "The Landlord",
    badge: "Deposit",
    roster: ["cat", "raccoon"],
    quote: "Pets are prohibited. Mine are a business expense.",
  },
  {
    name: "Briarfield",
    leader: "The Groundskeeper",
    badge: "Trespass",
    roster: ["rabbit", "goat"],
    quote:
      "The waiver says your parents consented. That is a surprisingly small signature.",
  },
  {
    name: "North Drain",
    leader: "The Sanitation Officer",
    badge: "Hygiene",
    roster: ["rat", "raccoon"],
    quote:
      "A child with a box of rats. Finally, the council initiative has arrived.",
  },
  {
    name: "Blackwood",
    leader: "The Ranger",
    badge: "Wilderness",
    roster: ["fox", "dog"],
    quote:
      "Never approach a wild animal. Unless you are collecting these badges, apparently.",
  },
  {
    name: "Morrow Quay",
    leader: "The Harbourmaster",
    badge: "Liability",
    roster: ["raccoon", "goat"],
    quote: "We have strict safety regulations. Children are somehow exempt.",
  },
  {
    name: "St. Marrow",
    leader: "The Headteacher",
    badge: "Attendance",
    roster: ["cat", "fox"],
    quote: "You have missed thirty days of school. This is your assessment.",
  },
  {
    name: "Hollow Crown",
    leader: "The League Inspector",
    badge: "Negligence",
    roster: ["goat", "dog"],
    quote: "Eight adults could have stopped this. I intend to be consistent.",
  },
];
export function makeAnimal(species, level = 5, nickname) {
  if (!Object.hasOwn(SPECIES, species)) throw new Error("Unknown species");
  level = Number.isFinite(level)
    ? Math.max(1, Math.min(50, Math.floor(level)))
    : 5;
  const maxHp = battleStats({ species, level }).maxHp;
  return {
    species,
    level,
    nickname: sanitizeName(nickname, SPECIES[species].name),
    hp: maxHp,
    maxHp,
    status: null,
    attackStage: 0,
    defenseStage: 0,
    moves: learnedMoves({ species, level }).slice(-4),
  };
}
export function restore(a) {
  return { ...a, hp: a.maxHp, status: null, attackStage: 0, defenseStage: 0 };
}
export function clearBattleStages(animal) {
  return { ...animal, attackStage: 0, defenseStage: 0 };
}
export function canSelectPartyAnimal(party, index, battle = null) {
  return Number.isInteger(index) && index >= 0 && party[index]?.hp > 0 &&
    index !== (battle ? battle.active : 0) &&
    (!battle || (!battle.busy && !battle.finished));
}
export function medkitRecovery(animal) {
  if (
    !animal || !Number.isFinite(animal.hp) || !Number.isFinite(animal.maxHp) ||
    animal.hp <= 0 || animal.hp >= animal.maxHp
  ) return 0;
  return Math.min(animal.maxHp - animal.hp, Math.ceil(animal.maxHp * 0.6));
}
export function useMedkit(state, index) {
  if (
    !state.bagTaken || !Number.isInteger(state.medkits) || state.medkits < 1 ||
    !Number.isInteger(index) || index < 0 || index >= state.party.length
  ) return 0;
  const animal = state.party[index], recovered = medkitRecovery(animal);
  if (!recovered) return 0;
  animal.hp += recovered;
  state.medkits--;
  return recovered;
}
export function battleStatusText(animal) {
  const parts = [`${animal.hp}/${animal.maxHp} HP`];
  if (animal.status) parts.push(animal.status.toUpperCase());
  for (const [label, stage] of [["ATK", animal.attackStage], ["DEF", animal.defenseStage]]) {
    if (stage) parts.push(`${label} ${stage > 0 ? "+" : "−"}${Math.abs(stage)}`);
  }
  return parts.join(" · ");
}
export function gainLevels(animal, amount = 1) {
  const level = Math.max(
    1,
    Math.min(
      50,
      animal.level +
        (Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0),
    ),
  );
  const previousStage = growthFor(animal).id;
  const next = makeAnimal(animal.species, level, animal.nickname);
  const learned = learnedMoves(next).filter(
    (id) => !learnedMoves(animal).includes(id),
  );
  next.moves = [...new Set([...unlockedMoves(animal), ...learned])].slice(0, 4);
  next.hp =
    animal.hp > 0
      ? Math.min(next.maxHp, Math.max(0, animal.hp + next.maxHp - animal.maxHp))
      : 0;
  const stage = growthFor(next).id;
  return {
    animal: next,
    learnedMoves: learned,
    previousStage,
    stage,
    stageChanged: previousStage !== stage,
  };
}
function stageFactor(value = 0) {
  const stage = Math.max(-2, Math.min(2, value));
  return stage < 0 ? 1 / (1 - stage * 0.5) : 1 + stage * 0.4;
}
export function damage(attacker, defender, move, rng = Math.random) {
  const m = MOVES[move];
  if (!m) throw new Error("Unknown move");
  if (rng() > (m.accuracy || 1)) return { amount: 0, miss: true };
  const effectiveness = TYPE_MATRIX[m.type][SPECIES[defender.species].type];
  const atk = battleStats(attacker).attack;
  const def = battleStats(defender).defense;
  const familiarity = m.type === SPECIES[attacker.species].type ? 1.1 : 1;
  const amount = m.power
    ? Math.max(
        3,
        Math.round(
          (((m.power * 0.55 + atk * 0.55 - def * 0.25) *
            effectiveness *
            familiarity *
            stageFactor(attacker.attackStage)) /
            stageFactor(defender.defenseStage)) *
            (0.92 + rng() * 0.16),
        ),
      )
    : 0;
  return { amount, effectiveness };
}
export function attack(attacker, defender, move, rng = Math.random) {
  const a = { ...attacker },
    d = { ...defender },
    m = MOVES[move];
  if (!m || !unlockedMoves(a).includes(move))
    throw new Error("Unavailable move");
  if (a.hp <= 0 || d.hp <= 0)
    return { a, d, message: "The battle is over.", amount: 0 };
  if (a.status === "dazed") {
    a.status = null;
    if (rng() < 0.5)
      return {
        a,
        d,
        message: `${a.nickname} is dazed and loses its turn.`,
        amount: 0,
      };
  }
  const hit = damage(a, d, move, rng);
  if (hit.miss)
    return {
      a,
      d,
      message: `${a.nickname} used ${m.name}, but missed.`,
      amount: 0,
    };
  d.hp = Math.max(0, d.hp - hit.amount);
  let message = `${a.nickname} used ${m.name}.`;
  if (hit.effectiveness > 1)
    message += " Super effective. Biology is a problem.";
  if (m.effect === "weaken") {
    if (d.attackStage <= -2) message += " Enemy attack is already at its minimum.";
    else {
      d.attackStage = Math.max(-2, (d.attackStage ?? 0) - 1);
      message += " Enemy attack fell.";
    }
  }
  if (m.effect === "boost") {
    if (a.attackStage >= 2) message += " Attack is already at its maximum.";
    else {
      a.attackStage = Math.min(2, (a.attackStage ?? 0) + 1);
      message += " Attack rose.";
    }
  }
  if (m.effect === "guard") {
    if (a.defenseStage >= 2) message += " Defence is already at its maximum.";
    else {
      a.defenseStage = Math.min(2, (a.defenseStage ?? 0) + 1);
      message += " Defence rose.";
    }
  }
  if (m.effect === "heal") {
    const heal = Math.min(a.maxHp - a.hp, Math.round(a.maxHp * 0.24));
    a.hp += heal;
    message += ` Recovered ${heal} HP.`;
  }
  if (m.effect === "daze" && rng() < 0.65) {
    d.status = "dazed";
    message += " The opponent is dazed.";
  }
  return { a, d, message, amount: hit.amount };
}
export function captureChance(a) {
  return Math.min(
    0.95,
    0.2 + (1 - a.hp / a.maxHp) * 0.68 + (a.status ? 0.12 : 0),
  );
}
export function initialSave() {
  return {
    saveVersion: 3,
    playerName: "Alex",
    rivalName: "Robin",
    bagTaken: false,
    interactions: [],
    messages: [],
    note: false,
    starter: null,
    party: [],
    reserve: [],
    seen: [],
    caught: [],
    badges: [],
    wins: [],
    carriers: 8,
    medkits: 5,
    money: 100,
    league: 0,
    completed: false,
    position: { x: 0, y: 1.25, z: 1.8 },
    yaw: 0.34,
    pitch: -0.045,
  };
}
export function parseSave(raw) {
  try {
    const s = JSON.parse(raw);
    if (!s || !Array.isArray(s.party)) return null;
    const clean = initialSave();
    clean.playerName = sanitizeName(s.playerName, "Alex");
    clean.rivalName = sanitizeName(s.rivalName, "Robin");
    clean.messages = cleanMessages(s.messages);
    clean.interactions = [
      ...new Set(
        (Array.isArray(s.interactions) ? s.interactions : []).filter(
          (id) =>
            typeof id === "string" && /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(id),
        ),
      ),
    ].slice(0, 128);
    clean.note = Boolean(s.note);
    clean.starter = Object.hasOwn(SPECIES, s.starter) ? s.starter : null;
    clean.party = s.party
      .filter((a) => a && Object.hasOwn(SPECIES, a.species))
      .slice(0, 6)
      .map((a) => {
        const valid = makeAnimal(
          a.species,
          Math.max(
            1,
            Math.min(50, Number.isFinite(a.level) ? Math.floor(a.level) : 5),
          ),
          a.nickname,
        );
        const oldMax =
          Number.isFinite(a.maxHp) && a.maxHp > 0 ? a.maxHp : valid.maxHp;
        valid.hp = Math.max(
          0,
          Math.min(
            valid.maxHp,
            Number.isFinite(a.hp)
              ? Math.round((a.hp / oldMax) * valid.maxHp)
              : valid.maxHp,
          ),
        );
        const selected = unlockedMoves({ ...valid, moves: a.moves });
        valid.moves = selected.some((id) => MOVES[id].power)
          ? selected
          : valid.moves;
        return valid;
      });
    if (clean.starter && !clean.party.length)
      clean.party = [makeAnimal(clean.starter)];
    if (!clean.starter && clean.party.length)
      clean.starter = clean.party[0].species;
    clean.bagTaken =
      typeof s.bagTaken === "boolean" ? s.bagTaken : Boolean(clean.starter);
    clean.reserve = (Array.isArray(s.reserve) ? s.reserve : [])
      .filter((a) => a && Object.hasOwn(SPECIES, a.species))
      .slice(0, RESERVE_LIMIT)
      .map((a) => {
        const valid = restore(
          makeAnimal(
            a.species,
            Math.max(
              1,
              Math.min(50, Number.isFinite(a.level) ? Math.floor(a.level) : 5),
            ),
            a.nickname,
          ),
        );
        const selected = unlockedMoves({ ...valid, moves: a.moves });
        valid.moves = selected.some((id) => MOVES[id].power)
          ? selected
          : valid.moves;
        return valid;
      });
    const owned = [...clean.party, ...clean.reserve].map((a) => a.species);
    const validSpecies = (value) =>
      (Array.isArray(value) ? value : []).filter((id) =>
        Object.hasOwn(SPECIES, id),
      );
    clean.caught = [...new Set([...validSpecies(s.caught), ...owned])];
    clean.seen = [...new Set([...validSpecies(s.seen), ...clean.caught])];
    clean.badges = [
      ...new Set(
        (Array.isArray(s.badges) ? s.badges : []).filter(
          (i) => Number.isInteger(i) && i >= 0 && i < 8,
        ),
      ),
    ];
    clean.wins = [
      ...new Set(
        (Array.isArray(s.wins) ? s.wins : []).filter(
          (x) => typeof x === "string",
        ),
      ),
    ];
    for (const k of ["carriers", "medkits", "money"])
      clean[k] = Math.max(
        0,
        Math.min(9999, Number.isFinite(s[k]) ? Math.floor(s[k]) : clean[k]),
      );
    clean.league =
      clean.badges.length === 8
        ? Math.max(0, Math.min(4, Number.isInteger(s.league) ? s.league : 0))
        : 0;
    clean.completed = clean.league === 4 && Boolean(s.completed);
    if (
      s.position &&
      Number.isFinite(s.position.x) &&
      Number.isFinite(s.position.z) &&
      Math.abs(s.position.x) < 590 &&
      Math.abs(s.position.z) < 590
    )
      clean.position = { x: s.position.x, z: s.position.z };
    clean.yaw = Number.isFinite(s.yaw) ? s.yaw : 0;
    clean.pitch = Number.isFinite(s.pitch)
      ? Math.max(-1.2, Math.min(1.2, s.pitch))
      : 0;
    return clean;
  } catch {
    return null;
  }
}
export function recordSpecies(state, species, caught = false) {
  if (!Object.hasOwn(SPECIES, species)) return;
  if (!state.seen.includes(species)) state.seen.push(species);
  if (caught && !state.caught.includes(species)) state.caught.push(species);
}
export function collectAnimal(state, animal) {
  const destination = state.party.length < 6 ? "party" : "reserve";
  if (destination === "reserve" && state.reserve.length >= RESERVE_LIMIT)
    return null;
  state[destination].push(restore(animal));
  recordSpecies(state, animal.species, true);
  return destination;
}
export function storeAnimal(state, index) {
  const animal = state.party[index];
  if (
    !animal ||
    state.reserve.length >= RESERVE_LIMIT ||
    state.party.length < 2
  )
    return false;
  if (!state.party.some((a, i) => i !== index && a.hp > 0)) return false;
  state.reserve.push(restore(state.party.splice(index, 1)[0]));
  return true;
}
export function retrieveAnimal(state, index) {
  if (state.party.length >= 6 || !state.reserve[index]) return false;
  state.party.push(state.reserve.splice(index, 1)[0]);
  return true;
}
export function terrainHeight(terrain, x, z) {
  const n = terrain.segments,
    size = terrain.size,
    px = Math.max(0, Math.min(n - 0.001, ((x + size / 2) / size) * n)),
    pz = Math.max(0, Math.min(n - 0.001, ((z + size / 2) / size) * n));
  const ix = Math.floor(px),
    iz = Math.floor(pz),
    fx = px - ix,
    fz = pz - iz;
  const a = terrain.heights[iz * (n + 1) + ix],
    b = terrain.heights[iz * (n + 1) + ix + 1],
    c = terrain.heights[(iz + 1) * (n + 1) + ix],
    d = terrain.heights[(iz + 1) * (n + 1) + ix + 1];
  return (
    a * (1 - fx) * (1 - fz) +
    b * fx * (1 - fz) +
    c * (1 - fx) * fz +
    d * fx * fz
  );
}
