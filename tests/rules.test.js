import test from "node:test";
import assert from "node:assert/strict";
import {
  SPECIES,
  MOVES,
  DISTRICTS,
  makeAnimal,
  attack,
  captureChance,
  initialSave,
  parseSave,
  restore,
  damage,
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
    dog = makeAnimal("dog");
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
test("each starter has a viable deterministic route through all eight gyms with healing", () => {
  for (const starter of ["cat", "dog", "hamster"]) {
    let pet = makeAnimal(starter, 7);
    for (let i = 0; i < 8; i++) {
      for (const species of DISTRICTS[i].roster) {
        let foe = makeAnimal(species, 5 + i * 2);
        let rounds = 0;
        while (pet.hp > 0 && foe.hp > 0 && rounds++ < 40) {
          if (pet.hp < pet.maxHp * 0.4) pet = { ...pet, hp: pet.maxHp };
          const move = SPECIES[pet.species].moves
            .filter((m) => MOVES[m].power)
            .sort(
              (a, b) =>
                damage(pet, foe, b, () => 0.5).amount -
                damage(pet, foe, a, () => 0.5).amount,
            )[0];
          let result = attack(pet, foe, move, () => 0.5);
          pet = result.a;
          foe = result.d;
          if (foe.hp) {
            const reply = SPECIES[foe.species].moves.find(
              (m) => MOVES[m].power,
            );
            result = attack(foe, pet, reply, () => 0.5);
            foe = result.a;
            pet = result.d;
          }
        }
        assert.equal(foe.hp, 0, `${starter} vs district ${i + 1}`);
      }
      pet = makeAnimal(starter, pet.level + 2);
    }
  }
});
test("all species have four legal moves and restoration clears battle modifiers", () => {
  for (const species of Object.keys(SPECIES)) {
    assert.equal(SPECIES[species].moves.length, 4);
    assert.ok(SPECIES[species].moves.every((m) => MOVES[m]));
    const a = makeAnimal(species);
    assert.deepEqual(
      restore({ ...a, hp: 1, status: "dazed", attackStage: -2 }),
      a,
    );
  }
});
