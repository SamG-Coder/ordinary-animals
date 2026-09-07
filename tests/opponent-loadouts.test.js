import test from "node:test";
import assert from "node:assert/strict";
import { attack, learnedMoves, makeAnimal, MOVES, SPECIES } from "../src/rules.js";
import { makeBattleOpponent } from "../src/opponent-loadouts.js";

const expected = {
  dog: ["bite", "growl", "tackle", "brace"],
  fox: ["pounce", "growl", "bite", "focus"],
  goat: ["rush", "growl", "tackle", "brace"],
  raccoon: ["hoard", "sand", "bite", "scratch"],
};

test("adult trainers retain their class attacks without changing HP or stats", () => {
  for (const kind of ["gym", "league"]) {
    for (const [species, moves] of Object.entries(expected)) {
      for (const level of [18, 20, 21, 22, 23, 27]) {
        const animal = makeBattleOpponent({ kind, roster: [species], level });
        assert.deepEqual(animal, { ...makeAnimal(species, level), moves });
        assert.equal(new Set(animal.moves).size, 4);
        assert.ok(animal.moves.every((move) => learnedMoves(animal).includes(move)));
        assert.ok(animal.moves.some((move) => MOVES[move].power &&
          MOVES[move].type === SPECIES[species].type));
      }
    }
  }
});

test("early trainers, veteran moves, wild captures and rival loadouts retain their existing equipment", () => {
  for (const species of Object.keys(SPECIES)) {
    for (let level = 1; level <= 50; level++) {
      for (const kind of ["wild", "rival", "gym", "league"]) {
        if (["gym", "league"].includes(kind) && expected[species] && level >= 18 && level < 28) continue;
        assert.deepEqual(makeBattleOpponent({ kind, roster: [species], level }),
          makeAnimal(species, level), `${kind} ${species} level ${level}`);
      }
    }
  }
});

test("replacement roster members get legal attacks that the ordinary combat rules can execute", () => {
  const config = { kind: "league", roster: ["dog", "fox", "goat", "raccoon"], level: 21 };
  const restored = ["tackle", "bite", "tackle", "scratch"];
  for (let index = 0; index < config.roster.length; index++) {
    const animal = makeBattleOpponent(config, index);
    assert.equal(animal.species, config.roster[index]);
    assert.deepEqual(animal.moves, expected[animal.species]);
    const opponent = makeAnimal("hamster", 23);
    const result = attack(animal, opponent, restored[index], () => 0.5);
    assert.ok(result.d.hp < opponent.hp, "Restored attack must execute through the real rules");
    assert.deepEqual(makeAnimal(animal.species, 21).moves,
      learnedMoves(animal).slice(-4), "Trainer equipment must not replace new player/wild defaults");
  }
});
