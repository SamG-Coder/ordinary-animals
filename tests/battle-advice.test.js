import test from "node:test";
import assert from "node:assert/strict";
import { getBattleAdvice } from "../src/battle-advice.js";
import { initialSave, makeAnimal, setMoveLoadout } from "../src/rules.js";

const prepared = (extra = {}) => ({
  ...initialSave(),
  bagTaken: true,
  starter: "cat",
  party: [makeAnimal("cat", 11)],
  badges: [0, 1],
  medkits: 2,
  carriers: 14,
  money: 460,
  ...extra,
});
const text = (advice) => [advice.summary, ...advice.notes].join("\n");

test("preparation names the actual next roster, finite supplies and useful status move", () => {
  const state = prepared();
  const before = structuredClone(state);
  const result = getBattleAdvice(state);
  assert.equal(result.districtIndex, 2);
  assert.match(result.summary, /Rabbit then Goat, both LV 9/);
  assert.match(text(result), /No treatment between/);
  assert.match(text(result), /2 medkits and £460/);
  assert.match(text(result), /Hiss early/);
  assert.match(text(result), /captured backup/);
  assert.deepEqual(
    state,
    before,
    "advice never grants resources or changes a save",
  );
});

test("empty party and all-fainted party receive actionable preparation instead of moves", () => {
  assert.match(text(getBattleAdvice(initialSave())), /Pick up your bag/);
  assert.match(
    text(getBattleAdvice({ ...initialSave(), bagTaken: true })),
    /take its carrier/,
  );
  const fainted = prepared({ party: [{ ...makeAnimal("cat", 11), hp: 0 }] });
  const advice = getBattleAdvice(fainted);
  assert.match(text(advice), /free treatment/);
  assert.equal(advice.recommendedMove, null);
  assert.doesNotMatch(text(advice), /FIGHT/);
});

test("stored backup and empty supplies are grounded in actual availability", () => {
  const stored = prepared({
    reserve: [makeAnimal("rat", 6, "Drain")],
    money: 0,
    medkits: 0,
    carriers: 0,
  });
  assert.match(text(getBattleAdvice(stored)), /Drain is in clinic storage/);
  assert.match(text(getBattleAdvice(stored)), /cannot afford another/);
  assert.doesNotMatch(text(getBattleAdvice(stored)), /Buying one/);
  const noStored = prepared({ carriers: 0, reserve: [] });
  assert.match(text(getBattleAdvice(noStored)), /no carriers/);
});

test("counter advice follows equipped move classes rather than species labels", () => {
  const rabbit = makeAnimal("rabbit", 6);
  // A juvenile rabbit has rodent Pocket Sand, but its strongest normal attack is canine.
  const rabbitAdvice = text(getBattleAdvice(prepared({ party: [rabbit] })));
  assert.match(rabbitAdvice, /Pocket Sand, an equipped RODENT move/);
  assert.doesNotMatch(rabbitAdvice, /Wheel Rush, an equipped/);
  const rat = setMoveLoadout(makeAnimal("rat", 11), ["bite"]);
  assert.doesNotMatch(
    text(getBattleAdvice(prepared({ party: [rat] }))),
    /an equipped RODENT move/,
  );
  assert.match(
    text(getBattleAdvice(prepared({ party: [rat] }))),
    /has also learned/,
  );
});

test("live advice gives legal selected moves, stage caps and explicit action costs", () => {
  const enemy = { ...makeAnimal("goat", 9), attackStage: -2 };
  const active = setMoveLoadout(makeAnimal("cat", 28), ["scratch", "hiss"]);
  const advice = getBattleAdvice(
    prepared({ party: [active, makeAnimal("dog", 11)] }),
    { enemy, activeIndex: 0 },
  );
  assert.equal(advice.recommendedMove, "scratch");
  assert.match(text(advice), /already at its minimum/);
  assert.doesNotMatch(text(advice), /FIGHT → Hiss lowers/);
  assert.match(text(advice), /switching is not a free turn/);
  assert.doesNotMatch(text(advice), /FIGHT → Raking Claws/);
});

test("critical HP, daze and wild capture advice do not promise free actions", () => {
  const cat = { ...makeAnimal("cat", 11), hp: 20, status: "dazed" };
  const enemy = { ...makeAnimal("rat", 5), hp: 10 };
  const advice = getBattleAdvice(prepared({ party: [cat] }), {
    enemy,
    kind: "wild",
  });
  assert.match(text(advice), /MEDKIT restores up to 54 HP/);
  assert.match(text(advice), /50% chance/);
  assert.match(text(advice), /does not clear daze/);
  assert.match(text(advice), /THROW CARRIER/);
  assert.match(text(advice), /failed attempt uses a carrier/);
  const empty = getBattleAdvice(prepared({ carriers: 0 }), {
    enemy,
    kind: "wild",
  });
  assert.match(text(empty), /No carriers remain/);
  assert.doesNotMatch(text(empty), /THROW CARRIER/);
});

test("completed district list and invalid active indices fall back without inventing a leader", () => {
  const state = prepared({ badges: [0, 1, 2, 3, 4, 5, 6, 7] });
  assert.equal(getBattleAdvice(state).districtIndex, -1);
  assert.match(text(getBattleAdvice(state)), /county championship/);
  assert.equal(
    getBattleAdvice(prepared(), { districtIndex: 99 }).districtIndex,
    2,
  );
  assert.ok(
    getBattleAdvice(prepared(), {
      activeIndex: 99,
      enemy: makeAnimal("rat", 5),
    }).recommendedMove,
  );
});
