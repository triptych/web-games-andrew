# One Shot — the 3D models (Meshy)

Every ship in the game is a [Meshy](https://www.meshy.ai) model, generated on 2026-11-27 with the Meshy CLI 0.4.0 by
**image-to-3D** from a reference picture painted with ElevenLabs (see [../art/README.md](../art/README.md)): the
player's Solitaire, the Choir's escort drone and the six motherships. Nothing is rigged; everything moves
procedurally (the ship bobs and banks, escorts spin in and hover, motherships drift).

| Script | What it does |
|---|---|
| `pipeline.mjs WORKDIR JOBS.json` | Image-to-3D for a list of `{ name, image, polycount }`: smart topology at the given triangle budget, textured (2K, no PBR), then the GLB and its thumbnail. Resumable (`WORKDIR/state.json`); a refused submission is retried. `TAG=x-` for a redo. From game-147. |
| `shrink.py IN OUT [px]` | Re-encodes a GLB's textures at `px` (1024 for the Solitaire and the motherships, 512 for the drone). From game-144. |
| `../models.html` + `../shot.mjs models` | Every model in the game's toon shading, from the side and as the player sees it, to set `YAW` in `js/view/view.js`. |

```bash
node game-151/dev/meshy/pipeline.mjs WORK jobs.json          # JOBS: solitaire 12k, motherships 14k, drone 4k
python3 -I game-151/dev/meshy/shrink.py WORK/glb/ember.glb game-151/models/ember.glb 1024
```

## What was generated

| Model | Triangles | Reference | Notes |
|---|---:|---|---|
| `solitaire` | 12,000 | white-and-navy fighter-cruiser with a gold-ringed lance | Nose turned down −Z. |
| `drone` | 4,000 | gunmetal and violet three-bladed dart with a magenta sensor | Its gunmetal disappears against space, so the view adds a magenta sensor glow and a violet halo. |
| `picket`, `ember`, `glacier`, `storm`, `prism`, `throne` | 14,000 | the `art` line of each mothership in `js/sim/data.js` | Turned three-quarters in the game so their length shows. The Throne's manta wings came out as a long hull with a crown and a halo ring; it still reads as the biggest ship. |

All eight came back usable on the first try (no reruns). 6.2 MB on disk after shrinking.

## Credits

| Stage | Count | Credits |
|---|---:|---:|
| Image-to-3D (15 each) | 8 | 120 + 30 (the two pilot models, kept) = **150** |

## In the game

`js/view/models.js` loads each model once, replaces its materials with a three-step `MeshToonMaterial` (the Meshy
texture as the map, a little emissive for the drone) and adds an inverted-hull ink outline. A `Craft` fits a model to
a size and turns it by its `YAW`; until it loads (or if it fails to) a procedural stand-in of the same size takes its
place, and escorts launched before the drone model arrived swap their stand-in out when it does.
