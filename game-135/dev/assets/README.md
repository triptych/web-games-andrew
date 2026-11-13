# Hard Hat Harbor — the 3D models (Meshy)

14 models in `../../assets/models/` (3.8 MB), made on 2026-11-13 with [Meshy](https://www.meshy.ai) (CLI 0.4.0) and loaded by `js/view/models.js`. Every model has a code-built stand-in that shows first and stays if the file fails; `?models=0` keeps the stand-ins. `js/model-files.js` lists the files, so the game never requests one that isn't there.

| Step | Tool | Cost each |
|---|---|---|
| 1. A reference render on plain grey, from the prompt in `dev/art/prompts.mjs` (group `refs`) | Meshy `text-to-image --ai-model nano-banana-pro` | 9 credits |
| 2. A textured mesh at a fixed triangle budget | Meshy `image-to-3d --model-type smart-topology --target-polycount N --should-texture true --enable-pbr false --texture-resolution 2k` | 15 credits |
| 3. Shrink for the web | `opt.mjs`: WebP textures (1024 px vehicles, 512 px buildings), quantised geometry, standing on y = 0 and 1 unit tall | 0 |

Budgets: vehicles 9,000 triangles, buildings 6,000. 336 credits in all (one pilot, the dump truck, then the other 13).

```bash
node game-135/dev/assets/meshy-batch.mjs WORK            # steps 1-2 for every reference; resumable (WORK/state.json)
# step 3, in a scratch folder with: npm i @gltf-transform/core @gltf-transform/functions @gltf-transform/extensions sharp meshoptimizer
node opt.mjs WORK/raw-veh-dump.glb game-135/assets/models/veh-dump.glb 1024
```

| Vehicles (`veh-`) | Buildings (`bld-`) |
|---|---|
| dump, dozer, digger, roller, crane, wrecker, loader, mixer | townhall, school, cannery, barn, house, shop |

Notes for the next game:
- **All eight vehicles came back with the nose along +X** (the reference is a three-quarter view from the front left), and all six buildings with the door on +Z. `dev/gallery.html` shows each on a pad with an arrow; `YAW` and `BYAW` hold the correction.
- **The crane and the wrecker were asked for without cable, hook or ball**, so those can be built in code and move. The crane's reference still drew a hook; the mesh kept only a stub.
- **A vehicle is scaled by its longest side on the ground**, not its height: a crane's boom would otherwise shrink the truck under it. Buildings are stretched to their footprint; each was asked to stand "on a thin square base", which gives the stretch something flat to fit.
- The models are drawn single-sided (game-131: thin parts are two faces back to back and flicker otherwise).
- The toy-box buttons are Meshy's own thumbnails (`th-<name>.png` from `meshy download --asset thumbnail.primary`), cropped by `dev/art/export.py`: free, transparent and exactly the model.
