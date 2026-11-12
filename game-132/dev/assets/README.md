# TITAN'S VAULT — the 3D models (Meshy)

28 models in `../../assets/models/` (8.8 MB), made on 2026-11-12 with [Meshy](https://www.meshy.ai) (CLI 0.4.0), loaded by
`js/view/actors.js`. Every model has a code-built stand-in that shows first and stays if the file fails; `?models=0`
keeps the stand-ins. `js/model-files.js` lists the files, so the game never requests one that isn't there.

## How they were made

| Step | Tool | Cost |
|---|---|---|
| 1. A reference render on plain grey, from the data's `art` line (`dev/art/prompts.mjs`, group `refs`) | fal `nano-banana-2` (Ironsworn, pet), Meshy `text-to-image --ai-model nano-banana-pro` (the other 26) | $0.08 / 9 credits |
| 2. A textured mesh at a fixed triangle budget | Meshy `image-to-3d --model-type smart-topology --target-polycount N --should-texture true --enable-pbr false --texture-resolution 2k` (`--pose-mode a-pose` for people) | 15 credits |
| 3. Humanoids only: a skeleton and Meshy's walking clip | `rigging create --input-task-id <image-to-3d task> --height-meters H` | 5 credits |
| 4. Shrink for the web | `opt.mjs`: WebP textures (1024 heroes, bosses and pet; 512 the rest), quantised geometry; static models normalised to stand on y = 0 and be 1 unit tall (`KEEP=1` leaves a rigged model alone) | 0 |

Budgets: heroes and bosses 12,000 triangles, NPCs and pet 8,000, monsters 7,000, props 3,000 (tree 4,000).
Total: 654 credits for references and meshes, 50 for the ten rigs.

```bash
node game-132/dev/assets/meshy-batch.mjs WORK            # steps 1-2 for every reference; resumable (WORK/state.json)
bash game-132/dev/assets/meshy-rig.sh WORK                # step 3
# step 4, in a scratch folder with: npm i @gltf-transform/core @gltf-transform/functions @gltf-transform/extensions sharp meshoptimizer
node opt.mjs WORK/raw-prop-chest.glb game-132/assets/models/prop-chest.glb 512
KEEP=1 node opt.mjs WORK/rig-hero-ironsworn.glb game-132/assets/models/hero-ironsworn.glb 1024
```

| Rigged (walk clip `Armature|walking_man|baselayer`) | Static |
|---|---|
| hero-ironsworn, hero-stormcaller, hero-shadebinder, mon-thrall, mon-archer, mon-hag, mon-wretch, mon-sentinel, mon-slinger, boss-kolossar | pet, npc-ysolde, npc-heron, mon-gorehound, mon-wraith, mon-gorgon, boss-skyllith, boss-morwen, prop-waystone, prop-portal, prop-chest, prop-brazier, prop-column, prop-sarcophagus, prop-obelisk, prop-statue, prop-tree, prop-stall |

The four-legged, legless and serpent-tailed creatures (pet, gorehound, wraith, gorgon, Skyllith) and Morwen's
floating gown can't take Meshy's humanoid rig; the view animates them in code (bob, lean, lunge). Meshy's rigs also
come with a running clip (`run-*.glb`, not shipped): the game plays the walk faster instead.
