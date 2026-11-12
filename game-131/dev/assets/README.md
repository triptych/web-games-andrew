# Fray & the Spiral Isle — the 3D models (Meshy)

38 models in `../../assets/models/` (7.7 MB), made on 2026-11-12 with [Meshy](https://www.meshy.ai) from fal reference
renders, and loaded by `js/view/props.js`. Each has a code-built stand-in that shows first and stays if the file fails;
`?models=0` keeps the stand-ins.

| File | Used for | Triangles | Made with |
|---|---|---|---|
| `fray.glb` | Fray (rigged, with Meshy's walking clip) | 12,400 | image-to-3D, `--pose-mode a-pose`, then `rigging create --height-meters 1.0`; the game uses `result.basic_animations.walking_glb_url` |
| `golem.glb` | Grandfather Lichen, the small golem, the golem who lay down | 9,100 | image-to-3D |
| `elder.glb` | Elder Grusk, Granny Sootwick | 9,500 | image-to-3D |
| `stone.glb` | Inscription stones, the Rootshrine's ring and door | 2,200 | image-to-3D |
| `pedestal.glb`, `crystal.glb`, `tower.glb`, `organ.glb`, `tidemother.glb`, `hearth.glb` | Gem pedestals; crystals and singing stones; Castle Hollowmere and the Aerie; the wind organ; Tide Mother; the Cold Hearth | 2,600–7,400 | image-to-3D |

### v1.1.0: the trees and the rest of the props

28 more models replaced everything that was still built from boxes and cones: `tree` and `tree2` (1,300 triangles each,
drawn as instances by `js/view/build.js`), and `ruin`, `boat`, `cairn`, `burrow`, `well`, `cavemouth`, `boulder`, `wall`,
`throne`, `stair`, `perch`, `arch` (also the way out of each place), `hut`, `tidestair`, `moondoor`, `cart`, `barrel`,
`telescope`, `nest`, `vane`, `cistern`, `bell`, `loom`, `pipe`, `darkway` and `vine` (1,500–5,200 triangles). Their
reference renders came from Meshy's own `text-to-image` (`--ai-model nano-banana-pro`, 9 credits) instead of fal, so
the whole chain ran from one shell script with no tool round trips: reference, then `image-to-3d` as below (15
credits), about 670 credits for the set. Textures were shrunk to 768 px. After adding or removing a model run
`node game-131/dev/assets/list.mjs`: it writes `js/model-files.js`, and the game only requests what is listed there.

Every model was one call:

```bash
meshy image-to-3d create --image-url ref-<name>.png --model-type smart-topology --target-polycount <n> \
    --should-texture true --enable-pbr false --texture-resolution 2k --target-formats glb --async
```

`smart-topology` returns a mesh at the asked triangle count, so nothing had to be simplified before rigging.
15 credits a model, 5 for the rig (about 155 credits in all). Meshy's GLBs are about 3 MB each, nearly all texture;
`opt.mjs` (gltf-transform: WebP textures at 1024, quantised geometry, the static ones normalised to stand on y = 0 and
be 1 unit tall) takes them to 0.2–0.5 MB:

```bash
npm i @gltf-transform/core @gltf-transform/functions @gltf-transform/extensions sharp     # in a scratch folder
node opt.mjs raw-golem.glb ../../assets/models/golem.glb 1024
KEEP=1 node opt.mjs walk-fray.glb ../../assets/models/fray.glb 1024       # KEEP: don't flatten a rigged model
```

`MODELS` in `props.js` says which look takes which file and how tall it stands. Nobody has judged the models' backs,
or how Fray's walk reads at her size, on a real GPU.
