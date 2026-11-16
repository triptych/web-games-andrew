# Lanternhollow — the 3D models (Meshy)

17 models in `../../assets/models/` (3.0 MB) and their thumbnails in `../../assets/thumbs/` (the Place palette), made on 2026-11-16 with [Meshy](https://www.meshy.ai) (CLI 0.4.0) and loaded by `js/view/models.js`. Every model has a code-built stand-in that shows first and stays if the file fails; `?models=0` keeps the stand-ins.

| Step | Tool | Cost each |
|---|---|---|
| 1. A reference render on plain grey, from the element's `art` in `js/sim/data/elements.js` and the shared style prompt in `prompts.mjs` | Meshy `text-to-image --ai-model nano-banana-pro` | 9 credits |
| 2. A textured mesh at a fixed triangle budget | Meshy `image-to-3d --model-type smart-topology --target-polycount N --should-texture true --enable-pbr false --texture-resolution 2k` | 15 credits |
| 3. Shrink for the web | `opt.mjs` (copied from game-135): WebP textures (1024 px, 512 for the small props), quantised geometry, standing on y = 0 and 1 unit tall | 0 |

Budgets: the dragon 7,000 triangles, the other monsters 4,500, props 3,000. 408 credits in all (a two-model pilot, the slime and the brazier, then the other 15). `meshy-state.json` is the batch's journal (task ids and credits).

```bash
node game-138/dev/assets/meshy-batch.mjs WORK            # steps 1–2 for every element; resumable (WORK/state.json)
# step 3, in a scratch folder with: npm i @gltf-transform/core @gltf-transform/functions @gltf-transform/extensions sharp meshoptimizer
node opt.mjs WORK/raw-mon-slime.glb game-138/assets/models/mon-slime.glb 1024
```

| Monsters (`mon-`) | Hoards, lights | Cozy things, flora |
|---|---|---|
| slime, mushfolk, golem, goblin, dragon | hoard-gold, hoard-chest, light-brazier, light-candles | cozy-campfire, cozy-bookshelf, cozy-barrels, cozy-cauldron, cozy-table, flora-mushrooms, flora-crystals, deco-statue |

Notes:
- Monsters were asked for with faces (they are characters); nothing else was, and nothing grew one.
- The brazier and the campfire were asked for **without flames**, so fire is code (flickering sprites and a lent point light).
- Each kind draws as one `InstancedMesh` per level: the GLB's meshes are merged into one geometry and its first material is used (every Meshy model here had one of each). Monsters breathe by scaling their instance matrix.
- Models are drawn single-sided (game-131: thin parts are two faces back to back and flicker otherwise); the slime is slightly transparent.
- A model is fitted to its element's height `h`, unless that makes its footprint wider than `size`.
