# Rebuild verification — 8 September 2026

This record describes the current development rebuild and the limits of its checks. The final unit suite, source audit, image-hash regeneration, production build and 41-assertion integration run are complete. Six final world views also passed capture validation after the leader fill lighting, lodge fascia and puddle edits, with no source changes, hot reload or page errors.

## Completed evidence

| Check                        | Recorded result                                             | Scope                                                                                                                                                                                      |
| ---------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Node unit and geometry suite | 121 tests passed                                            | Rules, progression, saves, SMS, movement helpers, geometry, terrain, roads, housing, interiors, scenery clearance, utility spans, texture hashing and the final fascia/puddle checks.      |
| Blender source audit         | `SOURCE_AUDIT_PASSED 167` after the final exports           | Editable scene objects, packed file images and authoritative terrain metadata; also checks the separate interface paper source. The image-hash manifest was regenerated for these exports. |
| No-input integration         | 41 assertions passed; no page exceptions                    | New Game/Settings, names, Mum's SMS, bag pickup, indoor Gary, pen handover, rival battle, phone navigation, shop purchase, television state, save/load, growth models and battle guards.   |
| World review                 | 21 semantic views; valid capture, no reported page errors   | Home rooms/exterior, clinic, shop, district leaders and courtyard views.                                                                                                                   |
| Interior-lighting retry      | Nine semantic views; valid capture, no reported page errors | Corrected home, clinic and shop lighting; CPU sampling during settled observation windows.                                                                                                 |

The world views ran in isolated headless Microsoft Edge on Windows, at 1440 × 960 and device pixel ratio 1, with an NVIDIA GeForce RTX 5080 through ANGLE/D3D11. Each view used a two-second settling period followed by three seconds of observation. Navigation, hot reload and source changes invalidate a capture. The first interior CPU attempt was invalidated by hot reload and is excluded from the successful results above.

The integration bridge invokes the original game functions with focus and pointer-lock methods stubbed. It supplies no browser clicks, key presses or mouse movement. Position fixtures bypass walked traversal and target-selection line of sight. The world-view bridge also places the camera explicitly; it does not execute a route or combat sequence.

## Combat and save evidence

The final integration run started at **2026-09-07 21:37:48 UTC** with a level-five cat, eight carriers, five medkits and £100. All 41 assertions passed with no page exceptions. Original RNG remained enabled. **Scratch → Scratch** won the rival battle; the cat reached level seven with **39/70 HP**, using no medkits. The resulting **eight carriers, five medkits and £220** became **eight carriers, six medkits and £195** after a real £25 counter purchase. Save/load retained those values, both chosen names, six SMS messages and the television-off flag. This record uses the final run's results; its RNG outcome differs from the earlier run.

A separate documented fixture supplied a level-eleven cat, two badges, fourteen carriers, two medkits and £460. It checked the third leader's opening battle view, adult/juvenile model scaling, and purchase/travel guards. **No third-badge victory or earned two-badge progression is claimed from that fixture.**

The four introductory SMS messages persist immediately on arrival. Home during the unfinished introduction retains the messages; opening Mum's chat shows them, and Gary remains eligible after bag collection. Starter selection leaves the animal in its pen until handover. The Blender phone case and hands remain visible around the interface. Battle CSS revisions increase metadata sizes and add framed HP meters. Review of the final rival screenshot confirmed that the phone, HP panels and command buttons fit the tested desktop viewport.

## Performance remains unresolved

The 21-view pass recorded a **599.9 ms frame interval in `home-utility`**. Its cause is unexplained. The successful nine-view interior retry recorded a maximum settled frame interval of **16.9 ms**, with no Long Tasks inside those measured windows.

That retry still recorded **586 ms on arrival in the hall** and **290 ms on arrival in the kitchen** through the Long Tasks API, during settling and outside the reported three-second windows. A good settled result therefore does not establish that entry into rooms is smooth. The retry does not explain or erase the earlier spike. CPU profiles begin after settling and cannot attribute those arrival tasks. These are short workstation observations, not gameplay FPS guarantees, physical-device benchmarks or proof that all hitches are fixed.

## Asset and packaging checks

The final six-view run separately profiled arrival and settled periods. Settled frame maxima were 16.8–16.9 ms with no observed Long Tasks. Arrival still produced Long Tasks of 591 ms in the hall, 275 ms in the kitchen and 53 ms at Briarfield. The hall and kitchen arrival profiles sampled approximately 580 ms and 266 ms respectively in native `getProgramInfoLog`, pointing to shader-program completion/diagnostics on first render as the dominant stall in those two captures. This evidence does not identify the earlier isolated utility-room spike. No speculative performance fix was included in this release.

The catalog currently contains 167 separate GLBs. Recent work includes connected utility poles/cable spans, revised birch bark, modular district buildings and terrain, walkable home/clinic/shop interiors, the Blender held-phone model, and persistent SMS/UI behavior. The game remains an authored development build; photorealism and complete visual polish are not claimed.

The final production build passed. Its copy configuration includes every catalog model plus the catalog, bedroom layout, lighting and texture-hash manifests and the HDR environment. The earlier inspected copy matched its source payloads byte for byte. No required runtime asset was ignored, and the inspected GLBs had no external image/buffer dependencies. Original work remains MIT © 2026 SamGCoder.

After editing a source, use Blender's explicit Python failure exit code and regenerate the image hashes:

```sh
blender -b --python-exit-code 1 --python scripts/reexport_asset.py -- desk
node -e "require('node:fs').mkdirSync('artifacts', { recursive: true })"
node scripts/audit-asset-textures.mjs --write
blender -b --python-exit-code 1 --python scripts/audit_sources.py
npm test
npm run build
```

The texture loader verifies exact embedded payload hashes before sharing image sources. It preserves texture settings and incrementally uploads selected nearby assets. Post-load sharing does not avoid the original transfers or decoding. Include the regenerated `game-assets/texture-hashes.json` whenever exports change.

## Local evidence and remaining work

Raw diagnostic files live in ignored `artifacts/`; they are not dependencies of the published game or unit suite:

- `no-input-integration.json`: 41-assertion result, original served-source hash, inventories, UI snapshots and scope.
- `no-input-rival-battle.png`, `no-input-third-battle.png`, `no-input-distant-save-title.png`: integration views.
- `no-input-world-rebuilt-final/report.json`: 21-view run, source hashes and the utility-room spike.
- `no-input-world-indoor-lighting-cpu-retry/report.json`: nine corrected-lighting views, per-view timings and full Long Task observations; sibling PNGs and CPU profiles provide the capture evidence.

The separate tracked [source-audit summary](asset-audit.json) is refreshed by the Blender command above.

The final six views are recorded in `artifacts/no-input-world-release-six-views/report.json`, with separate arrival and settled CPU profiles. The corrected kitchen and phone battle are preserved as [runtime screenshots](screenshots/phone-battle.png) alongside the [kitchen view](screenshots/home-kitchen.png). The final 121-test suite, 167-source audit, hash regeneration, production build and 41 integration assertions have passed. **Walked routes, line-of-sight selection during real movement, a complete fresh campaign, and physical mobile hardware remain unvalidated.**
