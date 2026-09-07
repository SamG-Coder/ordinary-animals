import test from "node:test";
import assert from "node:assert/strict";
import {
  SPECIES,
  MOVES,
  makeAnimal,
  attack,
  captureChance,
  initialSave,
  parseSave,
  restore,
  damage,
  unlockedMoves,
} from "../src/rules.js";
test("damage, type advantage, and HP limits are deterministic with an injected random source", () => {
  const cat = makeAnimal("cat"),
    rat = makeAnimal("rat");
  const result = attack(cat, rat, "scratch", () => 0.5);
  assert.ok(result.d.hp < rat.hp);
  assert.ok(result.message.includes("Super effective"));
  assert.equal(cat.hp, cat.maxHp);
  assert.equal(rat.hp, rat.maxHp);
  const defeated = attack(cat, { ...rat, hp: 1 }, "scratch", () => 0.5);
  assert.equal(defeated.d.hp, 0);
});
test("status moves, misses and limited healing are real battle actions", () => {
  let cat = makeAnimal("cat"),
    dog = makeAnimal("dog", 10);
  assert.equal(attack(cat, dog, "hiss", () => 0.5).d.attackStage, -1);
  assert.equal(attack(dog, cat, "howl", () => 0.5).a.attackStage, 1);
  assert.equal(damage(cat, dog, "pounce", () => 0.99).miss, true);
  const rat = makeAnimal("rat");
  assert.equal(attack(rat, cat, "sand", () => 0.4).d.status, "dazed");
  const hamster = makeAnimal("hamster");
  assert.equal(attack(hamster, cat, "hoard", () => 0.5).a.hp, hamster.maxHp);
  assert.ok(attack({ ...hamster, hp: 3 }, cat, "hoard", () => 0.5).a.hp > 3);
});
test("capture is easier after weakening or inflicting status", () => {
  const animal = makeAnimal("fox");
  assert.ok(captureChance({ ...animal, hp: 1 }) > captureChance(animal));
  assert.ok(
    captureChance({ ...animal, status: "dazed" }) > captureChance(animal),
  );
  assert.ok(captureChance({ ...animal, hp: 0, status: "dazed" }) <= 0.95);
});
test("save validation rejects corrupt parties and sanitizes out-of-range fields", () => {
  assert.equal(parseSave("invalid"), null);
  assert.equal(parseSave("{}"), null);
  const s = initialSave();
  s.party = [makeAnimal("cat")];
  s.starter = "cat";
  s.badges = [0, 0, 1, 15];
  s.party[0].hp = 999;
  s.money = -5;
  s.completed = true;
  s.league = 4;
  const clean = parseSave(JSON.stringify(s));
  assert.deepEqual(clean.badges, [0, 1]);
  assert.equal(clean.money, 0);
  assert.equal(clean.completed, false);
  assert.equal(clean.party[0].hp, clean.party[0].maxHp);
  assert.equal(
    parseSave(
      JSON.stringify({ ...s, starter: null, party: [{ species: "toString" }] }),
    ).party.length,
    0,
  );
  assert.equal(
    parseSave(JSON.stringify({ ...s, party: [] })).party[0].species,
    "cat",
  );
});
test("status actions meaningfully reduce incoming damage, with finite stage limits", () => {
  const cat = makeAnimal("cat", 10),
    goat = makeAnimal("goat", 10);
  const baseline = damage(goat, cat, "tackle", () => 0.5).amount;
  const once = attack(cat, goat, "hiss", () => 0.5).d;
  const twice = attack(cat, once, "hiss", () => 0.5).d;
  assert.ok(
    damage(once, cat, "tackle", () => 0.5).amount <= Math.ceil(baseline * 0.7),
  );
  assert.ok(
    damage(twice, cat, "tackle", () => 0.5).amount <=
      Math.ceil(baseline * 0.55),
  );
  assert.equal(attack(cat, twice, "hiss", () => 0.5).d.attackStage, -2);
  const dog = makeAnimal("dog", 18);
  const guarded = attack(dog, goat, "brace", () => 0.5).a;
  assert.equal(guarded.defenseStage, 1);
  assert.ok(
    damage(goat, guarded, "tackle", () => 0.5).amount <
      damage(goat, dog, "tackle", () => 0.5).amount,
  );
});

test("all species have legal learned moves and restoration clears battle modifiers", () => {
  for (const species of Object.keys(SPECIES)) {
    assert.equal(SPECIES[species].moves.length, 6);
    assert.ok(unlockedMoves(makeAnimal(species, 28)).length <= 4);
    assert.ok(SPECIES[species].moves.every((m) => MOVES[m]));
    const a = makeAnimal(species);
    assert.deepEqual(
      restore({ ...a, hp: 1, status: "dazed", attackStage: -2 }),
      a,
    );
  }
});
