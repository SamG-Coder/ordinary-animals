import {
  damage,
  DISTRICTS,
  growthFor,
  learnedMoves,
  makeAnimal,
  MOVES,
  SPECIES,
  TYPE_MATRIX,
  unlockedMoves,
  captureChance,
} from "./rules.js";

const living = (animal) =>
  animal && Object.hasOwn(SPECIES, animal.species) && animal.hp > 0;
const amount = (value) =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

function attackOptions(animal, opponent) {
  return unlockedMoves(animal)
    .filter((id) => MOVES[id].power)
    .map((id) => ({
      id,
      effectiveness:
        TYPE_MATRIX[MOVES[id].type][SPECIES[opponent.species].type],
      estimate:
        damage(animal, opponent, id, () => 0.5).amount *
        (MOVES[id].accuracy ?? 1),
    }))
    .sort((a, b) => b.estimate - a.estimate);
}

/** Plain text for a phone preparation card or leader challenge. Never mutates a save.
 * Passing a live enemy changes this into immediate battle guidance. Suggestions
 * are legal possibilities, not a prediction that a particular fight will be won.
 */
export function getBattleAdvice(state, options = {}) {
  const party = Array.isArray(state?.party) ? state.party : [];
  const reserve = Array.isArray(state?.reserve) ? state.reserve : [];
  const badges = Array.isArray(state?.badges) ? state.badges : [];
  const nextDistrict = DISTRICTS.findIndex(
    (_, index) => !badges.includes(index),
  );
  const districtIndex =
    Number.isInteger(options.districtIndex) && DISTRICTS[options.districtIndex]
      ? options.districtIndex
      : nextDistrict;
  const district = DISTRICTS[districtIndex];
  const conscious = party.filter(living);
  const active = living(party[options.activeIndex])
    ? party[options.activeIndex]
    : conscious[0];
  const enemy = living(options.enemy) ? options.enemy : null;
  const medkits = amount(state?.medkits),
    carriers = amount(state?.carriers),
    money = amount(state?.money);
  const advice = {
    heading: enemy
      ? "FIELD GUIDANCE / YOUR TURN"
      : "COUNTY LEAGUE / PREPARATION",
    summary:
      "The adults have approved the journey. Preparation remains your responsibility.",
    districtIndex,
    notes: [],
    recommendedMove: null,
  };
  const add = (text) => advice.notes.push(text);

  if (!party.length) {
    advice.summary = "No field partner registered.";
    add(
      state?.bagTaken
        ? "Enter the research clinic and speak to Gary. Choose an animal, then take its carrier."
        : "Pick up your bag at home, then enter the research clinic and speak to Gary about a starter.",
    );
    return advice;
  }
  if (!active) {
    advice.summary = "Every animal in your party has fainted.";
    add(
      "Rest at home or speak to Gary at the clinic for free treatment before another challenge.",
    );
    if (reserve.some(living))
      add(
        "A conscious animal is in clinic storage. Visit home or the clinic and use ANIMALS → TAKE ALONG.",
      );
    return advice;
  }

  if (enemy) {
    const attacks = attackOptions(active, enemy);
    const strongest = attacks[0];
    const moves = unlockedMoves(active);
    advice.summary = `${active.nickname}: ${active.hp}/${active.maxHp} HP against ${enemy.nickname}, LV ${enemy.level}.`;
    if (active.hp < active.maxHp * 0.5) {
      add(
        medkits
          ? `BAG → MEDKIT restores up to ${Math.ceil(active.maxHp * 0.6)} HP. You have ${medkits}; the enemy still attacks that turn.`
          : "No medkits remain. An available recovery move or a conscious backup may keep the challenge alive.",
      );
    }
    if (active.status === "dazed")
      add(
        "Dazed: your next move has a 50% chance to lose its turn, then the daze clears. A medkit works but does not clear daze.",
      );
    if (strongest) {
      advice.recommendedMove = strongest.id;
      const move = MOVES[strongest.id];
      add(
        `FIGHT → ${move.name} is your strongest equipped attack on average here.${strongest.effectiveness > 1 ? ` Its ${move.type.toUpperCase()} class has an advantage.` : strongest.effectiveness < 1 ? ` Its ${move.type.toUpperCase()} class is resisted.` : ""}${(move.accuracy ?? 1) < 1 ? ` Accuracy: ${Math.round(move.accuracy * 100)}%.` : ""}`,
      );
    }
    const weaken = moves.find((id) => MOVES[id].effect === "weaken");
    if (
      weaken &&
      (enemy.attackStage ?? 0) > -2 &&
      enemy.hp > enemy.maxHp * 0.45
    ) {
      add(
        `FIGHT → ${MOVES[weaken].name} lowers this opponent’s attack, up to two reductions. It costs a turn; it is most useful early in a longer fight.`,
      );
    } else if ((enemy.attackStage ?? 0) <= -2) {
      add(
        "This opponent’s attack is already at its minimum. Further Hiss or Growl will not lower it again.",
      );
    }
    if (options.kind === "wild") {
      add(
        carriers
          ? `BAG → THROW CARRIER: ${Math.round(captureChance(enemy) * 100)}% chance now. Keep the animal conscious; a failed attempt uses a carrier and gives it a turn.`
          : "No carriers remain. You cannot capture this animal until you buy another carrier (£20) outside battle.",
      );
    } else if (conscious.length > 1) {
      add(
        "ANIMALS → SEND OUT changes your active animal. The incoming animal takes the enemy’s next action, so switching is not a free turn.",
      );
    }
    return advice;
  }

  if (district) {
    const level = 5 + districtIndex * 2;
    advice.summary = `${district.name}: ${district.leader} fields ${district.roster.map((id) => SPECIES[id].name).join(" then ")}, both LV ${level}. No treatment between them. County approval does not include aftercare.`;
    if (
      conscious.some((animal) => animal.hp < animal.maxHp) ||
      party.some((animal) => animal && animal.hp <= 0)
    )
      add(
        "Treat your animals at home or Gary’s clinic before challenging the leader. Treatment is free.",
      );
    if (conscious.length === 1) {
      const stored = reserve.find(living);
      add(
        stored
          ? `${stored.nickname} is in clinic storage. Visit home or the clinic and use ANIMALS → TAKE ALONG; one animal must otherwise face both opponents.`
          : carriers
            ? "One animal must face both opponents. A captured backup gives you another chance if your lead faints; weaken a wild animal without knocking it out, then throw a carrier."
            : "One animal must face both opponents, and you have no carriers. A carrier costs £20; bring a backup when you can afford the capture supplies.",
      );
    }
    const target = makeAnimal(district.roster.at(-1), level);
    const counter = conscious
      .flatMap((animal) =>
        attackOptions(animal, target)
          .filter((move) => move.effectiveness > 1)
          .map((move) => ({ animal, ...move })),
      )
      .sort((a, b) => b.estimate - a.estimate)[0];
    if (counter) {
      add(
        `${counter.animal.nickname} has ${MOVES[counter.id].name}, an equipped ${MOVES[counter.id].type.toUpperCase()} move with an advantage against the final ${target.nickname}. Choose your lead in ANIMALS before the fight; switching during it costs a turn.`,
      );
    } else {
      const weaken = unlockedMoves(active).find(
        (id) => MOVES[id].effect === "weaken",
      );
      if (weaken)
        add(
          `${active.nickname} can use ${MOVES[weaken].name} early to reduce a tough opponent’s attack, up to twice. Each use takes a turn. Attack reductions reset when the next animal enters.`,
        );
      else
        add(
          `Against the final ${target.nickname}, ${Object.keys(TYPE_MATRIX)
            .find((type) => TYPE_MATRIX[type][SPECIES[target.species].type] > 1)
            .toUpperCase()} attacks have an advantage. Check equipped moves; an animal’s class alone does not tell you what it can use.`,
        );
    }
  } else {
    advice.summary =
      "All eight district badges are registered. Speak to Gary at the clinic about the county championship.";
  }

  if (medkits < 3) {
    add(
      money >= 30
        ? `You have ${medkits} medkit${medkits === 1 ? "" : "s"} and £${money}. Buying one MEDKIT costs £30; using it during battle gives the enemy a turn.`
        : `You have ${medkits} medkit${medkits === 1 ? "" : "s"} and cannot afford another (£30). Treatment at home and the clinic is free; Gary can replenish a minimum field supply.`,
    );
  }
  const unequipped = learnedMoves(active).filter(
    (id) => !unlockedMoves(active).includes(id),
  );
  if (unequipped.length)
    add(
      `${active.nickname} has also learned ${unequipped.map((id) => MOVES[id].name).join(", ")}. Use ANIMALS to choose up to four moves; new skills do not replace your chosen loadout automatically.`,
    );
  else {
    const growth = growthFor(active);
    const nextMove = SPECIES[active.species].learnset.find(
      (entry) => entry.level > active.level,
    );
    if (nextMove)
      add(
        `${active.nickname} learns ${MOVES[nextMove.move].name} at LV ${nextMove.level}.${growth.nextLevel ? ` The next growth stage is LV ${growth.nextLevel}; it remains the same real animal.` : ""}`,
      );
  }
  return advice;
}
