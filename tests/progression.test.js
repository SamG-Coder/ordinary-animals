import test from "node:test";
import assert from "node:assert/strict";
import {
  attack,
  battleStats,
  gainLevels,
  growthFor,
  initialSave,
  learnedMoves,
  makeAnimal,
  MOVES,
  parseSave,
  restore,
  sanitizeName,
  setMoveLoadout,
  SPECIES,
  TYPE_MATRIX,
  unlockedMoves,
} from "../src/rules.js";

test("all animals learn progressively and have a legal four-slot loadout", () => {
  for (const species of Object.keys(SPECIES)) {
    for (const [level, count] of [
      [1, 1],
      [5, 3],
      [10, 4],
      [18, 5],
      [28, 6],
    ]) {
      const animal = makeAnimal(species, level);
      assert.equal(
        learnedMoves(animal).length,
        count,
        `${species} level ${level}`,
      );
      assert.equal(unlockedMoves(animal).length, Math.min(4, count));
      assert.ok(unlockedMoves(animal).every((id) => MOVES[id]));
      assert.ok(unlockedMoves(animal).some((id) => MOVES[id].power));
    }
  }
  assert.deepEqual(learnedMoves({ species: "constructor", level: 20 }), []);
});
test("move selection enforces learning, damaging coverage and independent loadouts", () => {
  const cat = makeAnimal("cat", 5);
  assert.throws(() => attack(cat, makeAnimal("rat"), "pounce"), /Unavailable/);
  assert.throws(
    () => setMoveLoadout(cat, ["scratch", "pounce"]),
    /learned moves/,
  );
  assert.throws(() => setMoveLoadout(cat, ["scratch", "scratch"]), /distinct/);
  assert.throws(() => setMoveLoadout(cat, ["hiss"]), /damaging/);
  const veteran = makeAnimal("cat", 28);
  const selected = setMoveLoadout(veteran, ["scratch", "bite", "hiss", "rake"]);
  assert.deepEqual(unlockedMoves(selected), [
    "scratch",
    "bite",
    "hiss",
    "rake",
  ]);
  assert.notDeepEqual(veteran.moves, selected.moves);
  assert.throws(
    () => attack(selected, makeAnimal("rat", 28), "pounce"),
    /Unavailable/,
  );
});
test("growth is juvenile to adult to veteran without changing real species", () => {
  for (const species of Object.keys(SPECIES)) {
    const young = makeAnimal(species, 9),
      adult = makeAnimal(species, 10),
      veteran = makeAnimal(species, 20);
    assert.equal(growthFor(young).id, "juvenile");
    assert.equal(growthFor(adult).id, "adult");
    assert.equal(growthFor(veteran).id, "veteran");
    assert.ok(growthFor(young).scale < growthFor(adult).scale);
    assert.ok(growthFor(adult).scale < growthFor(veteran).scale);
    assert.ok(battleStats(adult).attack > battleStats(young).attack);
    assert.ok(veteran.maxHp > adult.maxHp);
    assert.equal(veteran.species, young.species);
  }
});
test("level rewards report learned moves and growth while retaining damage and fainting", () => {
  const cat = makeAnimal("cat", 9);
  cat.hp -= 17;
  const result = gainLevels(cat, 1);
  assert.equal(result.animal.level, 10);
  assert.deepEqual(result.learnedMoves, ["pounce"]);
  assert.equal(result.previousStage, "juvenile");
  assert.equal(result.stage, "adult");
  assert.equal(result.stageChanged, true);
  assert.equal(result.animal.maxHp - result.animal.hp, 17);
  assert.ok(unlockedMoves(result.animal).includes("pounce"));
  assert.equal(gainLevels({ ...cat, hp: 0 }, 11).animal.hp, 0);
  const expert = setMoveLoadout(makeAnimal("cat", 17), [
    "scratch",
    "bite",
    "hiss",
    "pounce",
  ]);
  const learned = gainLevels(expert, 1);
  assert.deepEqual(learned.learnedMoves, ["focus"]);
  assert.deepEqual(
    learned.animal.moves,
    expert.moves,
    "learning does not silently discard a chosen move",
  );
  assert.equal(gainLevels(makeAnimal("dog", 49), 9).animal.level, 50);
  assert.equal(gainLevels(makeAnimal("dog", 50), 9).learnedMoves.length, 0);
});
test("species have distinct combat roles and the type matrix is a complete cycle", () => {
  const stats = Object.fromEntries(
    Object.keys(SPECIES).map((id) => [id, battleStats(makeAnimal(id, 10))]),
  );
  assert.ok(
    stats.goat.maxHp > stats.cat.maxHp && stats.goat.speed < stats.cat.speed,
  );
  assert.ok(
    stats.fox.attack > stats.cat.attack && stats.rat.speed > stats.dog.speed,
  );
  assert.ok(
    stats.raccoon.defense > stats.cat.defense &&
      stats.rat.defense < stats.rabbit.defense,
  );
  for (const [from, to] of [
    ["feline", "rodent"],
    ["rodent", "canine"],
    ["canine", "feline"],
  ]) {
    assert.equal(TYPE_MATRIX[from][from], 1);
    assert.equal(TYPE_MATRIX[from][to], 1.3);
    assert.equal(TYPE_MATRIX[to][from], 0.8);
  }
});
test("legacy saves migrate names, bag and health without resurrecting fainted animals", () => {
  const old = {
    party: [
      { species: "cat", level: 5, hp: 33, maxHp: 66 },
      { species: "dog", level: 9, hp: 0, maxHp: 94 },
    ],
    starter: "cat",
    money: 83,
    carriers: 2,
    medkits: 1,
  };
  const clean = parseSave(JSON.stringify(old));
  assert.equal(clean.saveVersion, 3);
  assert.equal(clean.playerName, "Alex");
  assert.equal(clean.rivalName, "Robin");
  assert.equal(clean.bagTaken, true);
  assert.equal(clean.party[0].hp, Math.round(clean.party[0].maxHp * 0.5));
  assert.equal(clean.party[1].hp, 0);
  assert.equal(clean.money, 83);
  assert.equal(clean.carriers, 2);
  assert.equal(clean.medkits, 1);
  assert.ok(unlockedMoves(clean.party[0]).length);
  const fresh = initialSave();
  assert.equal(fresh.bagTaken, false);
  assert.equal(
    parseSave(
      JSON.stringify({ ...fresh, starter: "cat", party: [makeAnimal("cat")] }),
    ).bagTaken,
    false,
  );
});
test("names, safe interaction IDs and custom reserve loadouts survive save validation", () => {
  const pet = setMoveLoadout(makeAnimal("rat", 28, "Pebble"), [
    "nibble",
    "bite",
    "sand",
    "scurry",
  ]);
  const save = {
    ...initialSave(),
    playerName: "  Zoë  ",
    rivalName: "Robin<script>",
    interactions: ["radio", "radio", "letter", "<script>", "__proto__", null],
    party: [makeAnimal("cat")],
    reserve: [pet],
  };
  const loaded = parseSave(JSON.stringify(save));
  assert.equal(loaded.playerName, "Zoë");
  assert.equal(loaded.rivalName.includes("<"), false);
  assert.deepEqual(loaded.interactions, ["radio", "letter"]);
  assert.deepEqual(loaded.reserve[0].moves, pet.moves);
  assert.equal(loaded.reserve[0].nickname, "Pebble");
  assert.equal(loaded.reserve[0].hp, loaded.reserve[0].maxHp);
  assert.equal(sanitizeName("\u202e<>", "Robin"), "Robin");
  assert.equal([...sanitizeName("a".repeat(100))].length, 18);
  assert.deepEqual(
    restore({
      ...pet,
      status: "dazed",
      attackStage: -2,
      defenseStage: 2,
      hp: 1,
    }),
    { ...pet, hp: pet.maxHp, status: null, attackStage: 0, defenseStage: 0 },
  );
});
