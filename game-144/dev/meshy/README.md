# NEBULA REQUIEM — the 3D models (Meshy)

The three Seraphs, every enemy kind and the six bosses in `../../models/` were generated with
[Meshy](https://www.meshy.ai) text-to-3D on 2026-11-21 (Meshy CLI 0.4.0), then shrunk for the web by `shrink.py`.
The game loads them in `js/view/meshy.js`; until a model has loaded, or if one fails to, the procedural model from
`js/view/models.js` is drawn instead, so the game never waits on them.

| Script | What it does |
|---|---|
| `prompts.mjs` | Every request: one shared style line plus a prompt and a polygon budget per model. `node prompts.mjs > WORKDIR/models.json`. |
| `pipeline.mjs WORKDIR` | Runs every model to the end: preview (geometry, with `target_polycount`, remesh, triangles, auto symmetry), refine (PBR textures at 2K), download of the GLB and its thumbnail. State in `WORKDIR/state.json`, so it can be stopped and restarted without paying twice. The plan caps pending tasks; a refused submission costs nothing and is retried with a new operation id. For a redo, use a fresh WORKDIR and `NR_TAG=v2-` so the operation ids are new. |
| `shrink.py IN OUT [512]` | Rewrites a GLB's embedded textures at 512 px (JPEG, PNG where there is alpha). Meshy's 2K PBR textures made each model 5–9 MB; shrunk they are 0.2–1 MB, 15 MB for all 30. Run with `python3 -I`. |
| `../models.html`, `../gallery.mjs` | A gallery of every model as the game fits it, from the side (as the game sees it) and from above, with an arrow for the way it should face. `node game-144/dev/gallery.mjs [names] [0]` → `dev/shots/gallery.png`; a trailing `0` shows them as Meshy made them, unturned. |

## What was generated

30 models: `ship-sora`, `ship-kaito`, `ship-lyra` (8 000 triangles each); 21 enemy kinds (1 500–5 000); six bosses
(6 000–12 000). `shardlet`, `tentacleEye` and `crystalSegment` reuse `shard`, `eye` and `segment` at another size
(`ALIAS` in `meshy.js`).

Two came back wrong and were made again: the serpent's body `segment` (asked for an armour plate, got a whole crystal
wolf) and the `boss-wyrm` head (asked for a dragon head, got a whole standing dragon). Saying what it is *not*
("an object not a creature, no head, no legs"; "head only, no neck, no body") fixed both.

**Credits:** 960, as reported by Meshy: 30 previews at 20 and 30 refines at 10 (900), and the two redos (60).

## Fitting them into the game

Meshy gives each model its own facing: most hulls came back nose to −x, creatures and robots facing +z (at the
camera), Lyra's moth nose to +z. `FIT` in `meshy.js` gives each one a turn (`rot`, a three.js Euler), a size (`len`
along x, or `h` for height) and, for bosses, an offset onto the sim's hull. Ships face +x; enemies face −x, the
player's way. Creatures that read best from the front get a three-quarter turn (`Q`) so they still look at the camera.
Check any change in the gallery first: the side view alone can't tell a nose from a tail.

Bosses keep the procedural parts that carry gameplay or effects a mesh can't do (`KEEP` in `meshy.js`): the
Bellwether's core, the Organ's eye and lids, the Titan's core and sword, the Mother's eye and tentacles, Seraphine's
wings of light. Hit boxes are the sim's and did not change. Emissive maps are capped at 1.2 so they don't blow out
under bloom.
