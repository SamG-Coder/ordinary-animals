import test from "node:test";
import assert from "node:assert/strict";
import {
  initialSave,
  makeAnimal,
  parseSave,
  collectAnimal,
  storeAnimal,
  retrieveAnimal,
  recordSpecies,
  SPECIES,
  RESERVE_LIMIT,
} from "../src/rules.js";
import { WILD_SITES, FIELD_NOTES } from "../src/field-notes.js";

test("a full party can capture every remaining species into clinic storage", () => {
  const state = initialSave();
  for (const species of Object.keys(SPECIES))
    assert.ok(collectAnimal(state, makeAnimal(species)));
  assert.equal(state.party.length, 6);
  assert.equal(state.reserve.length, 2);
  assert.equal(state.caught.length, 8);
  assert.equal(state.seen.length, 8);
  assert.equal(new Set(WILD_SITES.map((site) => site[2])).size, 8);
  for (const id of Object.keys(SPECIES)) {
    assert.ok(
      WILD_SITES.some((site) => site[2] === id),
      `${id} needs a capturable wild site`,
    );
    assert.equal(FIELD_NOTES[id].length, 2);
  }
});
test("storage cannot remove the last conscious companion or overflow the party", () => {
  const state = initialSave();
  collectAnimal(state, makeAnimal("cat"));
  assert.equal(storeAnimal(state, 0), false);
  collectAnimal(state, makeAnimal("dog"));
  state.party[1].hp = 0;
  assert.equal(storeAnimal(state, 0), false);
  assert.equal(storeAnimal(state, 1), true);
  assert.equal(state.reserve[0].hp, state.reserve[0].maxHp);
  assert.equal(retrieveAnimal(state, 0), true);
  assert.deepEqual(state.caught, ["cat", "dog"]);
  while (state.party.length < 6) collectAnimal(state, makeAnimal("cat"));
  collectAnimal(state, makeAnimal("rat"));
  assert.equal(retrieveAnimal(state, 0), false);
});
test("legacy saves gain collection records and new records survive storage and reload", () => {
  const old = { ...initialSave(), starter: "cat", party: [makeAnimal("cat")] };
  delete old.seen;
  delete old.caught;
  delete old.reserve;
  const state = parseSave(JSON.stringify(old));
  assert.deepEqual(state.caught, ["cat"]);
  assert.deepEqual(state.reserve, []);
  recordSpecies(state, "fox");
  collectAnimal(state, makeAnimal("dog"));
  storeAnimal(state, 1);
  const loaded = parseSave(JSON.stringify(state));
  assert.deepEqual(
    loaded.reserve.map((a) => a.species),
    ["dog"],
  );
  assert.ok(loaded.seen.includes("fox"));
  assert.ok(!loaded.caught.includes("fox"));
  assert.ok(loaded.caught.includes("dog"));
});
test("full storage rejects a capture without changing records or deleting animals", () => {
  const state = initialSave();
  state.party = Array.from({ length: 6 }, () => makeAnimal("cat"));
  state.reserve = Array.from({ length: RESERVE_LIMIT }, () =>
    makeAnimal("cat"),
  );
  assert.equal(collectAnimal(state, makeAnimal("rat")), null);
  assert.equal(state.reserve.length, RESERVE_LIMIT);
  assert.ok(!state.caught.includes("rat"));
  const loaded = parseSave(
    JSON.stringify({
      ...state,
      reserve: [null, { species: "invalid" }, ...state.reserve],
      caught: ["rat", "rat", "invalid"],
    }),
  );
  assert.equal(loaded.reserve.length, RESERVE_LIMIT);
  assert.deepEqual(loaded.caught, ["rat", "cat"]);
});
