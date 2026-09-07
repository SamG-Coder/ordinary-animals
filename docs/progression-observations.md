# Progression observations — 8 September 2026

These are bounded balance diagnostics. **They are not a campaign playthrough, optimal-play proof or a demonstrated progression hardlock.** The original observations below preceded an opponent-equipment correction; its scope and damage comparison are recorded here.

## Adult trainer equipment correction

`makeBattleOpponent` now replaces one unused support slot for gym/league opponents at levels 18–27: dog Howl becomes Body Check; fox Howl becomes Bite; goat Howl becomes Body Check; raccoon Dig In becomes Scratch. Both the first opponent and later roster members use the same factory. Other levels, early encounters, wild capture equipment, player move selections, stats and AI probabilities retain their previous behavior. The level-28 veteran attacks still use the normal loadout.

The correction addresses the original issue described below. Raccoon also lost its feline attack at these levels and is included. Support-move AI remains a separate improvement.

A paired comparison used 1,000 seeds per matchup, a fresh level-21 opponent and a full-health level-23 defender, the actual `attack()` rules and uniform selection among powered equipped moves. Values are mean outgoing HP damage for one action, before → after:

| Opponent | Against Cat | Against Dog | Against Hamster |
|---|---:|---:|---:|
| Dog | 53.08 → 52.96 | 39.96 → 39.89 | 32.43 → 32.37 |
| Fox | 37.09 → 45.79 | 29.15 → 35.10 | 47.94 → 40.66 |
| Goat | 30.60 → 42.91 | 48.76 → 45.38 | 37.99 → 36.01 |
| Raccoon | 35.84 → 37.04 | 37.16 → 35.13 | 29.62 → 36.63 |

These show matchup tradeoffs: the largest increase is Goat against Cat, approximately 40%. They exclude follow-up status effects, healing, complete encounters and earned campaign resources. Late-game difficulty therefore still needs full battle and campaign verification. Regression tests cover the exact equipment, every unaffected species/level/encounter combination, unchanged HP/stats and actual execution of the restored moves.

## Original opponent-loadout issue

[`makeAnimal`](../src/rules.js) equips the last four learned moves. The runtime creates opponents with this default, while a player's existing chosen loadout is preserved when levels are gained. At level 18, this gives some late opponents a weak or misleading attack selection:

| Opponent | Default moves at levels 18–27      | Attacks the current AI actually chooses                     |
| -------- | ---------------------------------- | ----------------------------------------------------------- |
| Goat     | Wheel Rush, Growl, Howl, Dig In    | Wheel Rush only: rodent class. Body Check has been dropped. |
| Fox      | Pounce, Growl, Howl, Patient Stalk | Pounce only: feline class. Bite has been dropped.           |
| Dog      | Bite, Growl, Howl, Dig In          | Bite only. Body Check has been dropped.                     |

[`enemyMove`](../src/main.js) chooses among powered moves; its only non-damaging exception is a limited Emergency Rations roll at low HP. The new support moves therefore replace attacks without being used by the AI. Championship opponents at levels 20–23 do not reach the replacement attacks learned at level 28.

The equipment correction restores these attack options without increasing stats. Any future change to AI use of support moves needs a new seeded comparison; support-move behavior has not changed.

## Preparation estimates

The existing [`combat-balance-audit.mjs`](../scripts/combat-balance-audit.mjs) model was run in memory with file output suppressed. It used Mulberry32 seeds 1–10,000 for each third-leader scenario, actual move rules, speed order, finite supplies and the two-enemy sequence. Medkits cost a turn; voluntary switching exposes the incoming animal to an enemy action. Capture preparation includes the real roadside animal level and carrier costs, followed by free rest. Movement, travel time and a full reward chain are not simulated.

The third-leader starting fixture is a healthy level-11 cat, two medkits, fourteen carriers and £460, facing a level-9 rabbit followed by a level-9 goat.

| Strategy                                                  | Estimated win rate |
| --------------------------------------------------------- | -----------------: |
| Scratch/Bite attacks, healing below half HP               |             45.72% |
| Hiss twice against the goat                               |             84.85% |
| Captured level-6 rabbit retained as backup                |             96.92% |
| Same rabbit voluntarily switched in when the goat appears |             78.55% |

The backup/switch comparison supports explaining the incoming turn cost. It does not establish that allowing an animal to faint is universally optimal.

A separate diagnostic used 2,000 seeds per case, a healthy solo starter at its no-wild-training level, and explicitly supplied finite medkit counts. Its common policy selects the strongest expected equipped attack, uses one early attack reduction when available, and allows at most one recovery move per opponent.

| Diagnostic                                       | Medkits | Estimated win rate |
| ------------------------------------------------ | ------: | -----------------: |
| Level-7 cat against Wickmere, level-5 enemies    |       5 |              98.3% |
| Level-9 hamster against Ash End, level-7 enemies |       5 |              24.8% |
| Level-9 hamster against Ash End, level-7 enemies |       7 |              64.4% |

The hamster's early preparation requirement deserves review. Teach capture and another attack class before Ash End, then compare that preparation against a Pocket Sand-focused strategy. The diagnostic did not search such an optimum, so these percentages do not prove that solo hamster play is impossible. Its kit counts are separate fixtures, not inventories earned by a simulated campaign.

## Progression and corrected battle boundaries

Without wild training, the current reward path takes a starter from level 5 to 7 after the rival, then adds two levels per badge, reaching level 23 before the championship. The same-species growth thresholds remain level 10 and level 20. The league's feline/canine/rodent classes are deliberately dubious battle categories, not biological taxonomy.

The temporary ATK/DEF leak was **fixed in this iteration**: stages clear on battle entry, battle exit and switching out/in. HP, status effects, moves and finite supplies are preserved. Buffs remain effective while an animal stays active in the same battle. Pure tests cover cleanup and damage behavior; the dormant no-input harness includes explicit boundary and manual-switch guard fixtures. Those fixtures are regression checks, not earned battles or a forced victory.
