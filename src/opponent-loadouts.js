import { makeAnimal } from "./rules.js";

// Adult league trainees still need an attack in their own battle class. At
// levels 18–27, the last-four default drops it in favour of unused support.
// Replace one redundant support slot until the level-28 attack is learned.
const adultTrainerSwaps = {
  dog: ["howl", "tackle"],
  fox: ["howl", "bite"],
  goat: ["howl", "tackle"],
  raccoon: ["brace", "scratch"],
};

export function makeBattleOpponent(config, index = 0) {
  const animal = makeAnimal(config.roster[index], config.level);
  if (
    !["gym", "league"].includes(config.kind) ||
    animal.level < 18 || animal.level >= 28
  ) return animal;
  const swap = adultTrainerSwaps[animal.species];
  if (swap) animal.moves = animal.moves.map((move) => move === swap[0] ? swap[1] : move);
  return animal;
}
