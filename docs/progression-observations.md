# Progression observations — 8 September 2026

These are bounded balance diagnostics for the next iteration. **They are not a campaign playthrough, optimal-play proof or a demonstrated progression hardlock.** No balance values changed during this audit.

## Remaining opponent-loadout issue

[`makeAnimal`](../src/rules.js) equips the last four learned moves. The runtime creates opponents with this default, while a player's existing chosen loadout is preserved when levels are gained. At level 18, this gives some late opponents a weak or misleading attack selection:

| Opponent | Default moves at levels 18–27      | Attacks the current AI actually chooses                     |
| -------- | ---------------------------------- | ----------------------------------------------------------- |
| Goat     | Wheel Rush, Growl, Howl, Dig In    | Wheel Rush only: rodent class. Body Check has been dropped. |
| Fox      | Pounce, Growl, Howl, Patient Stalk | Pounce only: feline class. Bite has been dropped.           |
| Dog      | Bite, Growl, Howl, Dig In          | Bite only. Body Check has been dropped.                     |

[`enemyMove`](../src/main.js) chooses among powered moves; its only non-damaging exception is a limited Emergency Rations roll at low HP. The new support moves therefore replace attacks without being used by the AI. Championship opponents at levels 20–23 do not reach the replacement attacks learned at level 28.

Review authored opponent loadouts before increasing stats. Giving a late goat its normal canine attack and an intentional support choice would preserve its combat identity. Any change to AI use of support moves needs a new seeded comparison; no such rebalance has been applied yet.

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
