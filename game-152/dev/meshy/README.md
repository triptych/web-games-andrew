# HAYATE RIVER STRIKE — the 3D models (Meshy)

Every boat, gun, mine and fortress is a [Meshy](https://www.meshy.ai) model, generated on 2026-11-27 with the Meshy CLI
0.4.0 by **image-to-3D** from a reference cut out of an ElevenLabs sheet (see [../art/README.md](../art/README.md)).
Nothing is rigged; everything moves procedurally (the boat banks, pitches in the air and bobs; enemies sway and turn
toward their aim; bosses sway and sink when they die).

| Script | What it does |
|---|---|
| `pipeline.mjs WORKDIR JOBS.json` | Image-to-3D for a list of `{ name, image, polycount }`: smart topology at the given triangle budget, textured (2K, no PBR), then the GLB and its thumbnail. Resumable (`WORKDIR/state.json`). From game-151. |
| `shrink.py IN OUT [px]` | Re-encodes a GLB's textures at `px` (1024 for the Hayate, the mid-bosses and the bosses, 512 for the rest). From game-144. |
| `../models.html` + `../shot.mjs models` | Every model in the game's toon shading from above with an arrow pointing downriver, to set `yaw` in `js/view/models.js`. |

| Model | Triangles | Notes |
|---|---:|---|
| `hayate` | 10,000 | the player's boat |
| `patrol`, `gunboat`, `barge`, `tank`, `turret` | 4,000–5,000 | |
| `raider` | 3,000 | |
| `mine` | 2,000 | |
| `kabuto`, `torii`, `zero` | 9,000 | mid-bosses |
| `souen`, `raijin`, `tetsuren` | 12,000 | sector bosses |

All fourteen came back usable on the first try. Meshy laid every boat along X with its bow at −X: boats that sail with
the player turn −90° (bow downriver), the bosses +90° to face the player (SOUEN's bows came out the other way and
also turns −90°). 5.9 MB on disk after shrinking.

**Spend:** 14 × 15 = 210 Meshy credits.

## In the game

`js/view/models.js` loads each model once, replaces its materials with a three-step `MeshToonMaterial` (the Meshy
texture as the map) and adds an inverted-hull ink outline whose thickness is set in the model's own units, so it is
the same on screen at every scale. A `Craft` fits a model to a length and turns it by its `yaw`; until it loads (or
if it fails) a procedural stand-in of the same size takes its place.
