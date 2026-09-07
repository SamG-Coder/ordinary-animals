export const SAVE_KEY = "ordinary-animals-dark-v2";
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
};
export const TYPE_EDGE = {
  feline: "rodent",
  rodent: "canine",
  canine: "feline",
};
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
  if (!SPECIES[species]) throw new Error("Unknown species");
  const maxHp = SPECIES[species].hp + level * 4;
  return {
    species,
    level,
    nickname: nickname || SPECIES[species].name,
    hp: maxHp,
    maxHp,
    status: null,
    attackStage: 0,
  };
}
export function restore(a) {
  return { ...a, hp: a.maxHp, status: null, attackStage: 0 };
}
export function damage(attacker, defender, move, rng = Math.random) {
  const m = MOVES[move];
  if (!m) throw new Error("Unknown move");
  if (rng() > (m.accuracy || 1)) return { amount: 0, miss: true };
  const effectiveness =
    TYPE_EDGE[m.type] === SPECIES[defender.species].type
      ? 1.35
      : TYPE_EDGE[SPECIES[defender.species].type] === m.type
        ? 0.8
        : 1;
  const atk =
    (SPECIES[attacker.species].attack + attacker.level * 2) *
    Math.max(0.5, 1 + attacker.attackStage * 0.22);
  const def = SPECIES[defender.species].defense + defender.level;
  const amount = m.power
    ? Math.max(
        3,
        Math.round(
          (m.power * 0.55 + atk * 0.55 - def * 0.25) *
            effectiveness *
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
  if (!m || !SPECIES[a.species].moves.includes(move))
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
    d.attackStage = Math.max(-2, d.attackStage - 1);
    message += " Enemy attack fell.";
  }
  if (m.effect === "boost") {
    a.attackStage = Math.min(2, a.attackStage + 1);
    message += " Attack rose.";
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
    note: false,
    starter: null,
    party: [],
    badges: [],
    wins: [],
    carriers: 8,
    medkits: 5,
    money: 100,
    league: 0,
    completed: false,
    position: { x: 1, y: 1.35, z: 1.8 },
    yaw: -0.4,
    pitch: 0,
  };
}
export function parseSave(raw) {
  try {
    const s = JSON.parse(raw);
    if (!s || !Array.isArray(s.party)) return null;
    const clean = initialSave();
    clean.note = Boolean(s.note);
    clean.starter = Object.hasOwn(SPECIES, s.starter) ? s.starter : null;
    clean.party = s.party
      .filter((a) => Object.hasOwn(SPECIES, a.species))
      .slice(0, 6)
      .map((a) => {
        const valid = makeAnimal(
          a.species,
          Math.max(
            1,
            Math.min(50, Number.isFinite(a.level) ? Math.floor(a.level) : 5),
          ),
        );
        valid.hp = Math.max(
          0,
          Math.min(valid.maxHp, Number.isFinite(a.hp) ? a.hp : valid.maxHp),
        );
        return valid;
      });
    if (clean.starter && !clean.party.length)
      clean.party = [makeAnimal(clean.starter)];
    if (!clean.starter && clean.party.length)
      clean.starter = clean.party[0].species;
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
