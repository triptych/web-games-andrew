# VACANCY — the vehicle models (Meshy)

Every car, van, truck and bus in the city is one of seven [Meshy](https://www.meshy.ai) text-to-3D models in
`../../models/`, generated on 2026-11-21 with the Meshy CLI 0.4.0 and shrunk for the web by `shrink.py`.
The game loads them in `js/view/vehicles.js`; until they have loaded, or if one fails to, the code-built vehicle in
`js/view/props.js` is drawn instead.

| Script | What it does |
|---|---|
| `prompts.mjs` | Every request: one shared style line plus a prompt and a polygon budget per model. `node prompts.mjs > WORKDIR/models.json`. |
| `pipeline.mjs WORKDIR` | Preview (geometry with `target_polycount`, remesh, triangles, auto symmetry), refine (PBR at 2K), download of the GLB and its thumbnail; state in `WORKDIR/state.json`, so it can stop and restart without paying twice. A redo needs a fresh WORKDIR and `VA_TAG=v2-` (new operation ids). Copied from game-144's. |
| `shrink.py IN OUT [512]` | Rewrites a GLB's embedded textures at 512 px. 6.4–8.3 MB each from Meshy, 0.37–0.52 MB shrunk; 3.0 MB for all seven. Run with `python3 -I`. |
| `../models.html`, `../gallery.mjs` | Every model as the game fits it, side and top, with a 1.8 m figure for scale. `node game-145/dev/gallery.mjs [top]`. |

## What was generated

| Model | Triangles asked | Drawn as | Length in game |
|---|---|---|---|
| `sedan` | 3 500 | car, garage car | 4.6 m |
| `hatchback` | 3 000 | car, garage car | 3.9 m |
| `wagon` | 3 500 | car, garage car | 4.9 m |
| `pickup` | 3 500 | car | 5.1 m |
| `van` | 4 000 | van | 4.7 m |
| `truck` | 5 000 | truck (yards, the lab) | 4.9 m |
| `bus` | 6 000 | bus | 9.6 m |

Shared style line: *realistic game asset of a vehicle abandoned in an empty city street for years: faded sun-bleached
paint, dust and grime, patches of rust, dirty windows, slightly deflated tyres, no text, no lettering, no logos, no
number plates, single object, no base, no ground, no people.*

All seven came back right first time. **Credits:** 210 (7 previews at 20, 7 refines at 10).

## Fitting them into the game

`fit()` in `vehicles.js` measures each model's bounding box, turns its long axis onto local z (the way the sim lays
vehicles out, 1 × 2 tiles for a car, 1 × 5 for a bus), scales it to the length above and puts its lowest point on
y = 0. Front and back don't matter: the sim parks cars both ways round.

Meshy made the box truck stubby (as tall as it was wide at 6.4 m long); at 4.9 m it is 3.1 m tall and fits the
two-tile footprint its collision uses. Check any change in the gallery before the game: under the fog and the grade a
wrong size is hard to see.

They are drawn as one `InstancedMesh` per model part per city block (or garage floor), so three hundred parked
cars cost a handful of draw calls. Each instance gets a faded paint tint (`instanceColor`, multiplied over the
model's own texture) and, where the sim says the tyres are flat, a sag and a lean. The instanced meshes share the
model's geometry, so `disposeGroup` frees only their instance buffers (`userData.shared`).
