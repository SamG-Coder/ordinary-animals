// Pure Node model of the current battle rules. No browser, input or game-save access.
// This is a seeded statistical estimate, not another live gameplay playthrough.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import {
  attack,
  battleStats,
  captureChance,
  damage,
  DISTRICTS,
  makeAnimal,
  MOVES,
  restore,
  SPECIES,
  unlockedMoves,
} from "../src/rules.js";
import { WILD_SITES } from "../src/field-notes.js";
import { makeBattleOpponent } from "../src/opponent-loadouts.js";

const runs = Number(
  process.argv.find((a) => a.startsWith("--runs="))?.slice(7) ?? 10000,
);
assert.ok(Number.isInteger(runs) && runs >= 100 && runs <= 100000);
function seeded(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
const fixture = () => ({
  party: [makeAnimal("cat", 11)],
  medkits: 2,
  carriers: 14,
  money: 460,
});
const third = { kind: "gym", roster: DISTRICTS[2].roster, level: 5 + 2 * 2 };

// Mirrors main.js enemyMove with level-unlocked loadouts: status-only Hiss/Growl/Howl are never AI choices.
// The heal roll is made only while low enough and on a species that owns Hoard.
function enemyMove(enemy, rng) {
  const moves = unlockedMoves(enemy);
  if (enemy.hp < enemy.maxHp * 0.25 && moves.includes("hoard") && rng() < 0.3)
    return "hoard";
  const powered = moves.filter((id) => MOVES[id].power);
  return powered[Math.floor(rng() * powered.length)];
}
function perform(b, player, move) {
  const ally = b.state.party[b.active];
  const result = attack(
    player ? ally : b.enemy,
    player ? b.enemy : ally,
    move,
    b.rng,
  );
  b.state.party[b.active] = player ? result.a : result.d;
  b.enemy = player ? result.d : result.a;
}
function resolve(b) {
  if (b.enemy.hp <= 0) {
    b.enemyIndex++;
    if (b.enemyIndex === b.config.roster.length) {
      b.result = "win";
      return;
    }
    b.enemy = makeBattleOpponent(b.config, b.enemyIndex);
  }
  if (b.state.party[b.active].hp <= 0) {
    const next = b.state.party.findIndex((a) => a.hp > 0);
    if (next < 0) {
      b.result = "loss";
      return;
    }
    b.active = next; // Forced replacement after fainting is free in the runtime.
  }
}
function step(b, action) {
  assert.ok(!b.result);
  const ally = b.state.party[b.active];
  if (action.kind === "move") {
    assert.ok(
      unlockedMoves(ally).includes(action.move),
      "Strategy attempted an unavailable move",
    );
    const first = battleStats(ally).speed >= battleStats(b.enemy).speed;
    if (first) {
      perform(b, true, action.move);
      if (b.enemy.hp > 0) perform(b, false, enemyMove(b.enemy, b.rng));
    } else {
      perform(b, false, enemyMove(b.enemy, b.rng));
      if (b.state.party[b.active].hp > 0) perform(b, true, action.move);
    }
  } else if (action.kind === "medkit") {
    assert.ok(b.state.medkits > 0);
    b.state.medkits--;
    ally.hp = Math.min(ally.maxHp, ally.hp + Math.ceil(ally.maxHp * 0.6));
    perform(b, false, enemyMove(b.enemy, b.rng));
  } else if (action.kind === "switch") {
    assert.ok(action.index !== b.active && b.state.party[action.index]?.hp > 0);
    b.active = action.index;
    b.switches++;
    perform(b, false, enemyMove(b.enemy, b.rng));
  } else if (action.kind === "capture") {
    assert.equal(b.config.kind, "wild");
    assert.ok(b.state.carriers > 0 && b.state.party.length < 6);
    b.state.carriers--;
    if (b.rng() < captureChance(b.enemy)) {
      b.state.party.push(restore(b.enemy)); // collectAnimal restores a new capture.
      b.result = "captured";
    } else perform(b, false, enemyMove(b.enemy, b.rng));
  } else if (action.kind === "run") {
    assert.equal(b.config.kind, "wild");
    b.result = "retreat";
  } else throw new Error(`Unknown action ${action.kind}`);
  b.turns++;
  if (!b.result) resolve(b);
}
function encounter(state, config, policy, rng) {
  const b = {
    state,
    config,
    rng,
    active: state.party.findIndex((a) => a.hp > 0),
    enemyIndex: 0,
    enemy: makeBattleOpponent(config),
    turns: 0,
    switches: 0,
    result: null,
  };
  if (b.active < 0) {
    b.result = "loss";
    return b;
  }
  while (!b.result && b.turns < 200) step(b, policy(b));
  b.result ??= "turn-limit";
  return b;
}
function bestAttack(ally, enemy) {
  return unlockedMoves(ally)
    .filter((id) => MOVES[id].power)
    .sort(
      (a, b) =>
        damage(ally, enemy, b, () => 0.5).amount * (MOVES[b].accuracy ?? 1) -
        damage(ally, enemy, a, () => 0.5).amount * (MOVES[a].accuracy ?? 1),
    )[0];
}
function policy({
  hiss = 0,
  hissBoth = false,
  pounce = false,
  switchOnGoat = false,
} = {}) {
  return (b) => {
    const ally = b.state.party[b.active];
    const reserveIndex = b.state.party.findIndex(
      (a) => a.species === "rabbit" && a.hp > 0,
    );
    if (
      switchOnGoat &&
      b.enemy.species === "goat" &&
      reserveIndex >= 0 &&
      b.active !== reserveIndex
    )
      return { kind: "switch", index: reserveIndex };
    if (ally.hp < ally.maxHp * 0.5 && b.state.medkits > 0)
      return { kind: "medkit" };
    if (
      hiss &&
      ally.species === "cat" &&
      (hissBoth || b.enemy.species === "goat") &&
      b.enemy.attackStage > -hiss
    )
      return { kind: "move", move: "hiss" };
    if (ally.species === "cat")
      return {
        kind: "move",
        move:
          b.enemy.species === "rabbit"
            ? pounce
              ? "pounce"
              : "scratch"
            : "bite",
      };
    return { kind: "move", move: bestAttack(ally, b.enemy) };
  };
}
// A common, deliberately bounded policy for cross-species comparisons: two
// medkits, at most one attack reduction per enemy, and at most one recovery
// move per enemy. It is a useful benchmark, not an optimal-play solver.
function speciesPolicy() {
  const recovered = new Set();
  return (b) => {
    const ally = b.state.party[b.active];
    const moves = unlockedMoves(ally);
    if (ally.hp < ally.maxHp * 0.5 && b.state.medkits > 0)
      return { kind: "medkit" };
    const weaken = moves.find((id) => MOVES[id].effect === "weaken");
    if (
      weaken &&
      (b.enemy.attackStage ?? 0) >= 0 &&
      b.enemy.hp > b.enemy.maxHp * 0.5
    )
      return { kind: "move", move: weaken };
    const heal = moves.find((id) => MOVES[id].effect === "heal");
    if (heal && ally.hp < ally.maxHp * 0.45 && !recovered.has(b.enemyIndex)) {
      recovered.add(b.enemyIndex);
      return { kind: "move", move: heal };
    }
    return { kind: "move", move: bestAttack(ally, b.enemy) };
  };
}
function capturePreparation(species, state, rng) {
  const index = WILD_SITES.findIndex(
    ([x, z, id]) =>
      id === species && (species === "rabbit" ? z < -100 : x < -200),
  );
  assert.ok(index >= 0);
  const site = WILD_SITES[index];
  const level = 3 + Math.floor(index / 2);
  const battle = encounter(
    state,
    { kind: "wild", roster: [species], level },
    (b) => {
      const ally = b.state.party[b.active];
      if (b.state.carriers === 0) return { kind: "run" };
      if (ally.hp < ally.maxHp * 0.5 && b.state.medkits)
        return { kind: "medkit" };
      // Exactly one nonlethal Scratch; do not risk a second hit killing the target.
      if (b.enemy.hp === b.enemy.maxHp)
        return { kind: "move", move: "scratch" };
      return { kind: "capture" };
    },
    rng,
  );
  if (battle.result === "captured") state.party = state.party.map(restore);
  return { ...battle, site, level }; // A trip home restores HP/status, not kits/money.
}
const scenarios = [
  {
    id: "observed_aggression",
    description:
      "Scratch Rabbit, Bite Goat; heal below half; original two medkits",
    policy: policy(),
  },
  {
    id: "pounce_rabbit",
    description: "Pounce Rabbit, Bite Goat; original two medkits",
    policy: policy({ pounce: true }),
  },
  {
    id: "hiss_goat_once",
    description: "Hiss once against Goat, then Bite; original two medkits",
    policy: policy({ hiss: 1 }),
  },
  {
    id: "hiss_goat_twice",
    description: "Hiss twice against Goat, then Bite; original two medkits",
    policy: policy({ hiss: 2 }),
  },
  {
    id: "hiss_both_once",
    description: "Hiss once per opponent; Scratch/Bite; original two medkits",
    policy: policy({ hiss: 1, hissBoth: true }),
  },
  {
    id: "hiss_both_twice",
    description: "Hiss twice per opponent; Scratch/Bite; original two medkits",
    policy: policy({ hiss: 2, hissBoth: true }),
  },
  {
    id: "buy_one_medkit",
    description:
      "Spend £30 of existing £460 on one extra medkit; aggressive strategy",
    buy: 1,
    policy: policy(),
  },
  {
    id: "capture_rabbit_backup",
    description:
      "Capture actual roadside LV6 Rabbit, pay carrier/medkit costs, rest at home; keep as backup",
    capture: "rabbit",
    policy: policy(),
  },
  {
    id: "capture_rabbit_switch",
    description:
      "Same LV6 Rabbit preparation; voluntary switch when Goat appears costs a turn",
    capture: "rabbit",
    policy: policy({ switchOnGoat: true }),
  },
  {
    id: "capture_rat_backup",
    description:
      "Capture actual roadside LV5 Rat, pay carrier/medkit costs, rest at home; keep as backup",
    capture: "rat",
    policy: policy(),
  },
];
function wilson(wins, count) {
  const p = wins / count,
    z2 = 1.96 ** 2,
    divisor = 1 + z2 / count;
  const mid = (p + z2 / (2 * count)) / divisor,
    range =
      (1.96 * Math.sqrt((p * (1 - p)) / count + z2 / (4 * count * count))) /
      divisor;
  return [mid - range, mid + range].map((v) => Math.round(v * 10000) / 100);
}
const report = {
  method:
    "Pure Node seeded simulation estimate; no browser, game saves, movement or input. Not live gameplay proof.",
  seeds: {
    generator: "Mulberry32",
    first: 1,
    last: runs,
    runsPerScenario: runs,
  },
  fixture: fixture(),
  thirdLeader: third,
  sequencing: [
    "Speed uses battleStats (species speed + level + growth bonus); ties favour the player.",
    "Enemy chooses uniformly among powered moves; below 25% HP, Hoard-capable enemies first have a 30% heal roll.",
    "Medkits heal 60% max HP and give the enemy a turn. Voluntary switching gives the incoming ally an enemy turn.",
    "Fainted allies are replaced free; no healing occurs between the two enemies.",
    "Capture attempts consume a carrier; failure gives the enemy a turn. Successful capture restores the captured animal.",
    "Capture scenarios include one wild battle and legal travel home/rest afterward; rest restores HP/status but no items or money. Travel time and encounter movement are not simulated.",
    "Failed capture preparation is counted as failed overall preparation, not secretly retried or supplied with an animal.",
    "The simulator stops before badge rewards/blackout; it reports remaining combat resources and actual terminal HP.",
  ],
  scenarios: [],
  diagnosticSpeciesComparison: {
    method:
      "Separate counterfactual diagnostic fixtures: replace the starter with each species at LV 11, full HP, two medkits, against the same third-leader sequence. These are equal-resource balance comparisons, not claimed earned saves or free in-game animals. Policy uses strongest equipped expected attack, one early attack reduction when available, and at most one recovery move per opponent. No mid-sequence healing or resources are added.",
    results: [],
  },
};
for (const s of scenarios) {
  let wins = 0,
    preparations = 0,
    turnLimit = 0,
    turns = 0,
    kits = 0,
    carriers = 0,
    money = 0,
    survivors = 0;
  for (let seed = 1; seed <= runs; seed++) {
    const state = fixture(),
      rng = seeded(seed),
      initialKits = state.medkits;
    if (s.buy) {
      assert.ok(state.money >= s.buy * 30);
      state.money -= s.buy * 30;
      state.medkits += s.buy;
    }
    if (s.capture) {
      const prep = capturePreparation(s.capture, state, rng);
      if (prep.result !== "captured") {
        kits += initialKits - state.medkits;
        carriers += 14 - state.carriers;
        money += 460 - state.money;
        turnLimit += prep.result === "turn-limit";
        continue;
      }
      preparations++;
    }
    const result = encounter(state, third, s.policy, rng);
    wins += result.result === "win";
    turnLimit += result.result === "turn-limit";
    turns += result.turns;
    kits += initialKits + (s.buy ?? 0) - state.medkits;
    carriers += 14 - state.carriers;
    money += 460 - state.money;
    survivors += state.party.filter((a) => a.hp > 0).length;
    assert.ok(state.medkits >= 0 && state.carriers >= 0 && state.money >= 0);
  }
  report.scenarios.push({
    id: s.id,
    description: s.description,
    wins,
    winPercent: Math.round((wins / runs) * 10000) / 100,
    confidence95Percent: wilson(wins, runs),
    capturePreparationsSucceeded: s.capture ? preparations : null,
    conditionalWinPercentAfterCapture: s.capture
      ? Math.round((wins / preparations) * 10000) / 100
      : null,
    averageBattleTurnsPerStartedBattle:
      Math.round((turns / (s.capture ? preparations : runs)) * 100) / 100,
    averageMedkitsConsumed: Math.round((kits / runs) * 100) / 100,
    averageCarriersConsumed: Math.round((carriers / runs) * 100) / 100,
    averageMoneySpent: money / runs,
    averageSurvivingAnimals: Math.round((survivors / runs) * 100) / 100,
    turnLimit,
  });
}
for (const species of Object.keys(SPECIES)) {
  let wins = 0,
    turnLimit = 0,
    kits = 0;
  for (let seed = 1; seed <= runs; seed++) {
    const state = { ...fixture(), party: [makeAnimal(species, 11)] };
    const result = encounter(state, third, speciesPolicy(), seeded(seed));
    wins += result.result === "win";
    turnLimit += result.result === "turn-limit";
    kits += 2 - state.medkits;
  }
  assert.equal(turnLimit, 0, `Unresolved ${species} comparison`);
  report.diagnosticSpeciesComparison.results.push({
    species,
    wins,
    winPercent: Math.round((wins / runs) * 10000) / 100,
    confidence95Percent: wilson(wins, runs),
    averageMedkitsConsumed: Math.round((kits / runs) * 100) / 100,
    turnLimit,
  });
}
report.sourceHashes = {};
for (const name of ["src/rules.js", "src/main.js", "src/field-notes.js"])
  report.sourceHashes[name] = createHash("sha256")
    .update(await readFile(name))
    .digest("hex");
assert.ok(
  report.scenarios.every((s) => s.turnLimit === 0),
  "An unresolved simulation must be investigated",
);
await writeFile(
  "artifacts/combat-balance-audit.json",
  JSON.stringify(report, null, 2),
);
console.table(
  report.scenarios.map((s) => ({
    scenario: s.id,
    winPercent: s.winPercent,
    interval95: s.confidence95Percent.join("–"),
    kits: s.averageMedkitsConsumed,
    carriers: s.averageCarriersConsumed,
    spent: s.averageMoneySpent,
  })),
);
console.log(
  `Estimated outcomes over ${runs} explicitly seeded runs per scenario. Full method: artifacts/combat-balance-audit.json`,
);
console.table(
  report.diagnosticSpeciesComparison.results.map((row) => ({
    species: row.species,
    winPercent: row.winPercent,
    kits: row.averageMedkitsConsumed,
  })),
);
