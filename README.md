# Ordinary Animals

A dark first-person animal-battling parody. You are ten years old. A man with a white coat has decided that sending children out to collect and battle ordinary animals counts as education.

**[Play the development build](https://samg-coder.github.io/ordinary-animals/)** · Desktop recommended · MIT © 2026 SamGCoder

![The opening bedroom](docs/bedroom.png)

## The game

Wake up in your bedroom in Wickmere. Read your mother's letter, leave through the hallway, and meet Gary at the county research office. Choose a cat, dog, or hamster, battle your neighbour, capture wild animals, and challenge eight district leaders before the four-round county championship.

Exploration and battles use the child's first-person viewpoint. The tone comes from rain, cold dawn light, empty streets, institutional notices, and the absurd confidence of adults who should know better. Combat is turn based: four moves per species, HP, speed, type advantages, status effects, healing, switching, fainting, and capture odds based on the wild animal's remaining HP. A party holds six animals.

Campaign progress saves in this browser. Defeat returns you to your room with a healed party. Your bedroom and Gary offer free recovery. Earned district offices unlock travel through the journal map.

## Current status

This is an actively developed playable build, not a finished photorealistic release. The opening has received the most detailed art pass. The 1.2 km square region has roads, encounter sites, eight district destinations, and a complete campaign progression system; its distant districts still reuse architecture and need more individual environments. Human faces, animal deformation, terrain variety, and interactions inside additional buildings remain art and design priorities.

Verified in the browser:

- A fresh save: bedroom → letter → both doors → clinic → starter → rival victory.
- Save-fixture regression scenarios: weakened wild capture, inventory consumption, party persistence across reload, defeat and recovery, and the final multi-animal championship round through the ending and return home.
- All eight animal exports: idle, walk, attack, hit, and faint clips, with skeletal skins and visual contact sheets.

The ending scenario uses a late-game save fixture. It is not a claim that the entire campaign has been manually played from a fresh save.

## Controls

| Action | Control |
| --- | --- |
| Walk / sprint | WASD / Shift |
| Look | Mouse; click the world to lock the pointer |
| Release pointer | Escape |
| Look fallback | Drag or arrow keys |
| Interact | E |
| Torch | F |
| Journal, map, party, settings | J |

Graphics, brightness, sensitivity, and camera movement are adjustable and saved separately from campaign progress. Mobile has touch controls and defaults to the performance setting; the intended experience is on desktop.

## Blender asset pipeline

The active build contains **70 individual GLB assets plus a Blender-rendered HDR sky**. Every active world mesh, material image, and character animation originates in a corresponding editable Blender source. No downloaded scenery, stock animals, or runtime primitive scenery is used.

- `assets/`: separate `.blend` sources with packed images. Open a single tree, chair, door, animal, road segment, or building and edit it directly.
- `game-assets/asset-catalog.json`: the source/export mapping and local collision dimensions.
- `game-assets/bedroom-layout.json`: placement data for separate furnishings.
- `src/world.js`: placement and spatial batching of the exported modules. It does not generate world mesh primitives.
- `src/main.js`: first-person input, lighting, animation playback, encounters, battle presentation, UI, audio, and saves.
- `src/rules.js`: combat, progression definitions, and save validation.

To export **one edited asset** with Blender on your PATH:

```sh
blender -b --python scripts/reexport_asset.py -- desk
```

The source authoring scripts support independent passes. For example, to rebuild only the cat:

```sh
blender -b --python scripts/author_animals.py -- cat
blender -b --python scripts/refine_animals.py -- cat
blender -b --python scripts/coat_materials.py -- cat
```

`author_blender.py` and `modular_assets.py` are the initial library factories. `detail_assets.py`, `refine_people.py`, and `author_sky.py` are subsequent Blender art passes. `pack_sources.py` packs used images and compresses the editable sources. A normal art edit only requires re-exporting its own file; the world is assembled from those reusable pieces.

The production build copies only catalog-listed assets and the sky manifest. Historical files under `public/`, working texture folders, and the unused monolithic bedroom export are not served or shipped.

## Run and verify

Node 22 or newer:

```sh
npm ci
npm run dev -- --port 5174
```

In a second terminal:

```sh
npm test
node scripts/opening-playtest.mjs
node scripts/campaign-scenarios.mjs
node scripts/animal-visual-check.mjs
node scripts/interface-check.mjs
npm run build
```

The browser scripts use Playwright with the locally installed Microsoft Edge channel and write screenshots to ignored `artifacts/`. Their input helpers use ordinary pointer and keyboard events; the game's development inspection API is read-only and is removed from production builds.

GitHub Actions tests and builds `main`, then deploys `dist/` to GitHub Pages. The game uses Three.js and Vite. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## License

Original code, Blender assets, textures, and authored animations are released under the [MIT license](LICENSE), credited to **SamGCoder**. This is an independent parody with original characters, locations, writing, and assets.
