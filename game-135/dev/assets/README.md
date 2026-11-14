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

## Wheels that turn (v1.0.1)

A Meshy model is one solid mesh, so its wheels don't turn. They are cut out when the model loads:

1. **Find them once**, offline: `node wheels.mjs game-135/assets/models/veh-dump.glb` (in the scratch folder with gltf-transform and sharp; add `all` for the roller's steel drum, which is not dark). It samples the texture at every vertex, keeps the dark ones (tyres), clusters the ones touching the ground along the model's length, and for each cluster takes the radius whose rim is covered by vertices all the way round. Output: `[{ x, y, r, z0, z1 }]` in the model's units, pasted into `WHEELS` in `js/view/vehicles.js`.
2. **Cut them out at load** (`splitWheels` in `js/view/models.js`): a triangle whose three corners are all inside a wheel's cylinder moves to a new mesh under a pivot at the wheel's centre. The new meshes share the original vertex buffers and material; only the index lists are new, so it costs almost nothing.
3. **Turn them**: each pivot's `rotation.z += v · dt / r`.

Check a cut with `dev/gallery.html?only=dump&spin=0.9`: the wheels are turned 50°, so a bad cut shows as a torn mudguard. The crane's fourth "axle" in the first table was an outrigger leg (the detector had rightly refused it: its ring was only 67% covered); don't add wheels by hand without looking.

Notes for the next game:
- **All eight vehicles came back with the nose along +X** (the reference is a three-quarter view from the front left), and all six buildings with the door on +Z. `dev/gallery.html` shows each on a pad with an arrow; `YAW` and `BYAW` hold the correction.
- **The crane and the wrecker were asked for without cable, hook or ball**, so those can be built in code and move. The crane's reference still drew a hook; the mesh kept only a stub.
- **A vehicle is scaled by its longest side on the ground**, not its height: a crane's boom would otherwise shrink the truck under it. Buildings are stretched to their footprint; each was asked to stand "on a thin square base", which gives the stretch something flat to fit.
- The models are drawn single-sided (game-131: thin parts are two faces back to back and flicker otherwise).
- The toy-box buttons are Meshy's own thumbnails (`th-<name>.png` from `meshy download --asset thumbnail.primary`), cropped by `dev/art/export.py`: free, transparent and exactly the model.
