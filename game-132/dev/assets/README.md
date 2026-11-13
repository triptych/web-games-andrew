# GIANT'S VAULT — the 3D models (Meshy)

28 models in `../../assets/models/` (8.8 MB) and 10 attack clips in `../../assets/anims/` (800 KB), made on 2026-11-12 with [Meshy](https://www.meshy.ai) (CLI 0.4.0), loaded by
`js/view/actors.js`. Every model has a code-built stand-in that shows first and stays if the file fails; `?models=0`
keeps the stand-ins. `js/model-files.js` lists the files, so the game never requests one that isn't there.

## How they were made

| Step | Tool | Cost |
|---|---|---|
| 1. A reference render on plain grey, from the data's `art` line (`dev/art/prompts.mjs`, group `refs`) | fal `nano-banana-2` (Ironsworn, pet), Meshy `text-to-image --ai-model nano-banana-pro` (the other 26) | $0.08 / 9 credits |
| 2. A textured mesh at a fixed triangle budget | Meshy `image-to-3d --model-type smart-topology --target-polycount N --should-texture true --enable-pbr false --texture-resolution 2k` (`--pose-mode a-pose` for people) | 15 credits |
| 3. Humanoids only: a skeleton and Meshy's walking clip | `rigging create --input-task-id <image-to-3d task> --height-meters H` | 5 credits |
| 3b. Rigged models only: an attack clip from Meshy's animation library | `animate create --input-task-id <rigging task> --action-id N` (`meshy-anim.sh`) | 3 credits |
| 4. Shrink for the web | `opt.mjs`: WebP textures (1024 heroes, bosses and pet; 512 the rest), quantised geometry; static models normalised to stand on y = 0 and be 1 unit tall (`KEEP=1` leaves a rigged model alone) | 0 |

Budgets: heroes and bosses 12,000 triangles, NPCs and pet 8,000, monsters 7,000, props 3,000 (tree 4,000).
Total: 654 credits for references and meshes, 50 for the ten rigs, 30 for the ten attack clips.

```bash
node game-132/dev/assets/meshy-batch.mjs WORK            # steps 1-2 for every reference; resumable (WORK/state.json)
bash game-132/dev/assets/meshy-rig.sh WORK                # step 3
# step 4, in a scratch folder with: npm i @gltf-transform/core @gltf-transform/functions @gltf-transform/extensions sharp meshoptimizer
node opt.mjs WORK/raw-prop-chest.glb game-132/assets/models/prop-chest.glb 512
KEEP=1 node opt.mjs WORK/rig-hero-ironsworn.glb game-132/assets/models/hero-ironsworn.glb 1024
bash game-132/dev/assets/meshy-anim.sh WORK               # step 3b
node strip-anim.mjs WORK/anim-hero-ironsworn.glb game-132/assets/anims/hero-ironsworn.glb   # bones and clip only
```

Attack clips (Meshy action ids): a right-hand sword slash (219) for the Ironsworn; a spell cast (129) for the
Stormcaller, Shadebinder and Grave Hag; a charged ground slam (127) for the Bronze Sentinel and Kolossar; a plain
attack (4) for the Thrall, Archer, Wretch and Slinger. An animation GLB from Meshy carries the whole textured model
again; `strip-anim.mjs` keeps only the bones and the clip (about 80 KB each). `js/model-files.js` lists them in
`ANIM_FILES`; `models.js` loads one after its model and adds it to the same mixer, and `actors.js` plays it once per
attack, sped up or slowed to the attack's own length (0.3–0.8 s for the player), with the walk muted meanwhile.

| Rigged (walk clip `Armature|walking_man|baselayer`) | Static |
|---|---|
| hero-ironsworn, hero-stormcaller, hero-shadebinder, mon-thrall, mon-archer, mon-hag, mon-wretch, mon-sentinel, mon-slinger, boss-kolossar; and pet and mon-gorehound (our own quadruped rig, below) | npc-ysolde, npc-heron, mon-wraith, mon-gorgon, boss-skyllith, boss-morwen, prop-waystone, prop-portal, prop-chest, prop-brazier, prop-column, prop-sarcophagus, prop-obelisk, prop-statue, prop-tree, prop-stall |

The four-legged, legless and serpent-tailed creatures (pet, gorehound, wraith, gorgon, Skyllith) and Morwen's
floating gown can't take Meshy's humanoid rig. Ember (the pet) and the Gorehound are rigged by our own script instead
(below); the rest are animated in code (bob, lean, lunge).

### Ember and the Gorehound: a quadruped rig without Meshy

`rig-quadruped.mjs` rigs a static four-legged model from `opt.mjs`. No credits; needs the same gltf-transform
packages as `opt.mjs`.

```bash
node rig-quadruped.mjs profile WORK/static-pet.glb          # a side profile: top, lowest point, feet, per Z slice
node rig-quadruped.mjs pet WORK/static-pet.glb game-132/assets/models/pet.glb
node rig-quadruped.mjs mon-gorehound WORK/static-gorehound.glb game-132/assets/models/mon-gorehound.glb
```

1. **Skeleton.** 15 joints at landmarks read off the profile (`RIGS.pet`, `RIGS['mon-gorehound']`): hips, spine, chest, neck, head, two tail
   bones, and an upper and a lower bone for each leg. The model's node transform is baked into the vertices first
   (glTF ignores a skinned mesh's own transform).
2. **Weights.** A vertex low in a leg's Z band, on that leg's side, takes only that leg's bones and the body bone it
   hangs from, so legs never pull on each other; everything else takes the body, neck, head, tail and upper leg
   bones. Weight falls off with the fourth power of distance to a bone in the legs and the third in the body (a
   sharper falloff tore the rump open where the tail joins). The best four are kept.
3. **Clips**, baked at 30 fps: `walk`, a trot (1.1 s for Ember, a bouncier 0.9 s for the hound) with diagonal legs together, knees folding on the forward swing,
   a bob, a roll through the spine and a sway in the tail; `attack`, a 0.6 s crouch, lunge and snap of the jaws.
4. **Size.** Quantised like the other models: Ember 471 KB (378 KB static), the Gorehound 280 KB (212 KB static).

`models.js` plays a clip named `walk` as the walk and `attack` as the attack when a model carries them. `actors.js`
gives both a gait of 3 m/s per 1× (`GAIT`: a fast trot at their 4.6–6.6 m/s; true foot speed would be a blur),
measures Ember's speed from how far she moved, and plays the bite on `petBite` and on a hound's `monAttack`.
The static inputs are the v1.1.1 `assets/models/pet.glb` and `mon-gorehound.glb` in git history. Meshy's rigs also
come with a running clip (`run-*.glb`, not shipped): the game plays the walk faster instead. Models without an
attack clip lunge forward instead.
