import test from "node:test";
import assert from "node:assert/strict";
import {
  makeAnimal,
  clearBattleStages,
  attack,
  damage,
  battleStatusText,
  canSelectPartyAnimal,
} from "../src/rules.js";

test("manual animal selection rejects pending or finished battles even for a conscious backup", () => {
  const party = [makeAnimal("cat"), makeAnimal("dog")];
  const before = structuredClone(party);
  assert.equal(
    canSelectPartyAnimal(party, 1, { active: 0, busy: false, finished: false }),
    true,
  );
  assert.equal(
    canSelectPartyAnimal(party, 1, { active: 0, busy: true, finished: false }),
    false,
  );
  assert.equal(
    canSelectPartyAnimal(party, 1, { active: 0, busy: false, finished: true }),
    false,
  );
  assert.deepEqual(party, before);
});

test("manual selection rejects the active, fainted and nonexistent slots in battle and exploration", () => {
  const party = [
    makeAnimal("cat"),
    makeAnimal("dog"),
    { ...makeAnimal("rat"), hp: 0 },
  ];
  for (const battle of [null, { active: 0, busy: false, finished: false }]) {
    for (const index of [-1, 0, 2, 3, 0.5])
      assert.equal(canSelectPartyAnimal(party, index, battle), false);
    assert.equal(canSelectPartyAnimal(party, 1, battle), true);
  }
});

test("clearing temporary stages preserves injury, status, identity and equipped moves", () => {
  const animal = {
    ...makeAnimal("dog", 18, "Bramble"),
    hp: 17,
    status: "dazed",
    attackStage: 2,
    defenseStage: -2,
    moves: ["bite", "growl", "brace"],
  };
  const before = structuredClone(animal);
  const cleared = clearBattleStages(animal);
  assert.deepEqual(cleared, { ...before, attackStage: 0, defenseStage: 0 });
  assert.deepEqual(animal, before);
  assert.notEqual(cleared, animal);
  assert.match(battleStatusText(cleared), /17\/.* HP · DAZED$/);
});

test("encounter cleanup does not revive a fainted animal or heal a reserve", () => {
  const fainted = { ...makeAnimal("cat"), hp: 0, attackStage: -1 };
  const injured = { ...makeAnimal("hamster"), hp: 3, defenseStage: 2 };
  const cleaned = [fainted, injured].map(clearBattleStages);
  assert.deepEqual(
    cleaned.map((animal) => animal.hp),
    [0, 3],
  );
  assert.ok(
    cleaned.every(
      (animal) => animal.attackStage === 0 && animal.defenseStage === 0,
    ),
  );
});

test("Howl and Dig In remain effective during a battle and lose only their modifiers at its boundary", () => {
  const dog = makeAnimal("dog", 18),
    goat = makeAnimal("goat", 18);
  const baselineAttack = damage(dog, goat, "bite", () => 0.5).amount;
  const baselineIncoming = damage(goat, dog, "tackle", () => 0.5).amount;
  const howled = attack(dog, goat, "howl", () => 0.5).a;
  const guarded = attack(howled, goat, "brace", () => 0.5).a;
  const afterAction = attack(guarded, goat, "bite", () => 0.5).a;
  assert.ok(
    damage(afterAction, goat, "bite", () => 0.5).amount > baselineAttack,
  );
  assert.ok(
    damage(goat, afterAction, "tackle", () => 0.5).amount < baselineIncoming,
  );
  assert.equal(afterAction.attackStage, 1);
  assert.equal(afterAction.defenseStage, 1);
  const cleared = clearBattleStages(afterAction);
  assert.equal(damage(cleared, goat, "bite", () => 0.5).amount, baselineAttack);
  assert.equal(
    damage(goat, cleared, "tackle", () => 0.5).amount,
    baselineIncoming,
  );
  assert.equal(cleared.hp, afterAction.hp);
});
