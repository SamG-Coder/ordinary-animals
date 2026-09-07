import test from "node:test";
import assert from "node:assert/strict";
import {
  initialSave,
  makeAnimal,
  medkitRecovery,
  useMedkit,
  battleStatusText,
  attack,
  parseSave,
} from "../src/rules.js";

function treatmentFixture() {
  const state = initialSave();
  state.bagTaken = true;
  state.starter = "cat";
  state.medkits = 2;
  state.party = [makeAnimal("cat"), makeAnimal("dog")];
  state.party.forEach((animal) => {
    animal.hp = 1;
  });
  return state;
}

test("a medkit spends one finite item on the chosen animal for 60% maximum HP", () => {
  const state = treatmentFixture();
  const before = structuredClone(state);
  const recovered = useMedkit(state, 1);
  assert.equal(recovered, Math.ceil(before.party[1].maxHp * 0.6));
  assert.equal(state.party[1].hp, 1 + recovered);
  assert.equal(state.medkits, 1);
  assert.deepEqual(state.party[0], before.party[0]);
  assert.equal(state.money, before.money);
  assert.equal(state.carriers, before.carriers);
});

test("near-full treatment caps recovery and cannot consume another item at full HP", () => {
  const state = treatmentFixture();
  const animal = state.party[0];
  animal.hp = animal.maxHp - 1;
  assert.equal(medkitRecovery(animal), 1);
  assert.equal(useMedkit(state, 0), 1);
  assert.equal(animal.hp, animal.maxHp);
  const after = structuredClone(state);
  assert.equal(useMedkit(state, 0), 0);
  assert.deepEqual(state, after);
});

test("empty supplies, uncollected bags, fainted animals and invalid targets spend nothing", () => {
  const cases = [
    [
      (state) => {
        state.medkits = 0;
      },
      0,
    ],
    [
      (state) => {
        state.bagTaken = false;
      },
      0,
    ],
    [
      (state) => {
        state.party[0].hp = 0;
      },
      0,
    ],
    [() => {}, -1],
    [() => {}, 2],
    [() => {}, 0.5],
  ];
  for (const [prepare, index] of cases) {
    const state = treatmentFixture();
    prepare(state);
    const before = structuredClone(state);
    assert.equal(useMedkit(state, index), 0);
    assert.deepEqual(state, before);
  }
});

test("medkits preserve statuses and battle modifiers; field healing survives save/load", () => {
  const state = treatmentFixture();
  Object.assign(state.party[0], {
    status: "dazed",
    attackStage: -1,
    defenseStage: 2,
  });
  useMedkit(state, 0);
  assert.equal(state.party[0].status, "dazed");
  assert.equal(state.party[0].attackStage, -1);
  assert.equal(state.party[0].defenseStage, 2);
  const loaded = parseSave(JSON.stringify(state));
  assert.equal(loaded.medkits, state.medkits);
  assert.equal(loaded.party[0].hp, state.party[0].hp);
  assert.deepEqual(loaded.party[1], state.party[1]);
});

test("health text retains temporary effects and omits neutral stat stages", () => {
  const cat = makeAnimal("cat");
  assert.equal(battleStatusText(cat), `${cat.hp}/${cat.maxHp} HP`);
  assert.equal(
    battleStatusText({
      ...cat,
      status: "dazed",
      attackStage: -2,
      defenseStage: 1,
    }),
    `${cat.hp}/${cat.maxHp} HP · DAZED · ATK −2 · DEF +1`,
  );
});

test("a capped Hiss honestly reports no further attack reduction", () => {
  const cat = makeAnimal("cat", 10),
    goat = makeAnimal("goat", 10);
  const second = attack(cat, { ...goat, attackStage: -1 }, "hiss", () => 0.5);
  assert.equal(second.d.attackStage, -2);
  assert.match(second.message, /attack fell/);
  const capped = attack(cat, second.d, "hiss", () => 0.5);
  assert.equal(capped.d.attackStage, -2);
  assert.match(capped.message, /already at its minimum/);
  assert.doesNotMatch(capped.message, /attack fell/);
});

test("capped Howl and Brace report their limits without inventing another buff", () => {
  const dog = makeAnimal("dog", 18),
    goat = makeAnimal("goat", 10);
  for (const [move, field, label] of [
    ["howl", "attackStage", "Attack"],
    ["brace", "defenseStage", "Defence"],
  ]) {
    const second = attack({ ...dog, [field]: 1 }, goat, move, () => 0.5);
    assert.equal(second.a[field], 2);
    assert.ok(second.message.includes(`${label} rose`));
    const capped = attack(second.a, goat, move, () => 0.5);
    assert.equal(capped.a[field], 2);
    assert.ok(capped.message.includes(`${label} is already at its maximum`));
    assert.ok(!capped.message.includes(`${label} rose`));
  }
});
