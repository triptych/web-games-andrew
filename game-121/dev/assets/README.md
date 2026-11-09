# ARCANA WAGON: the 3D character pipeline

The eleven named characters (Marta, Pip, Elias, Mirabel, the Hooded Stranger, Oswin, Wren, Captain Hester, Bram, Lady
Seraphine and Prince Caspian) are rigged 3D models made with [Meshy](https://www.meshy.ai), from reference art made with
[fal](https://fal.ai). The generated villagers, and any model that hasn't loaded yet, still use the code-built people in
`js/view/people.js`. The models live in `assets/models/<name>.glb` (3.5 MB in all) and are loaded by
`js/view/models.js`.

## How each one was made (2026-11-09)

| Step | Tool | Cost |
|---|---|---|
| 1. A full-body, front-view A-pose reference on a plain grey background | fal `fal-ai/nano-banana-2`, 2:3, 2K, one shared system prompt (below) | $0.08 |
| 2. A textured mesh from that image | Meshy `image-to-3d`, `--model-type standard --should-texture true --enable-pbr false --texture-resolution 2k --pose-mode a-pose` | 30 credits |
| 3. Simplify to ~10,000 triangles, feet at the origin, 1 unit tall, plain GLB (JPEG texture) | `optimise-glb.mjs` with `PLAIN=1` (local, free) | 0 |
| 4. A skeleton | Meshy `rigging create --model-url <the plain GLB> --height-meters <height>` | 5 credits |
| 5. Shrink for the web | `optimise-rigged.mjs`: drops the embedded clip, WebP colour map at 1024, meshopt | 0 |

That is 35 Meshy credits and 8 cents of fal per character. The raw Meshy meshes are 340,000 to 930,000 triangles
and 12 to 30 MB each, which is over the rigger's 300,000-face limit, so step 3 comes before the rig. The rigged models
are about 10,000 triangles, 24 bones and 0.3 MB each.

The shared fal system prompt (it is what makes eleven separate renders read as one cast):

> You are the art director of ARCANA WAGON, a cosy tarot-fortune-teller game with jewel colours (plum, magenta, teal, gold).
> Every image is a stylised hand-painted 3D game character render, storybook proportions about six heads tall, softly
> rounded forms, rich cloth textures, clean readable silhouette. Always: ONE character only, full body from head to toe,
> front view, standing in a relaxed A-pose with arms slightly out from the torso and hands open and empty, nothing held, on a
> plain flat light-grey background, soft even studio lighting, no cast shadow, no floor, no text, no logos, no frame.

The user prompt named the character, built from the sim's own `look` data and role: age and build, hair, hat, the robe's
colour and trim.

## The skeleton and how the game poses it

Meshy's rig is Mixamo-like: `Hips`, `Spine`, `Spine01`, `Spine02`, `neck`, `Head`, `LeftShoulder`, `LeftArm`,
`LeftForeArm`, `LeftHand`, the same on the right, `LeftUpLeg`, `LeftLeg`, `LeftFoot`, `LeftToeBase` and the right.
There are no animation clips in the shipped GLBs. `models.js` poses the bones itself every frame, with rotations given
in the model's own frame (x across, y up, z the way it faces) and converted to each bone's local space:

- seated: the pelvis drops onto the chair (`hipY - 0.60`, measured from each model), the thighs go forward 83° and the
  knees bend back; the upper arms come in and forward, the forearms bend up 55° and turn in so the hands rest at the
  table's edge;
- talking: the head nods and the hands rise and fall; a mood leans or slumps the spine and tilts the head;
- looking: the head and neck turn towards the camera (up to 40°), the body does not;
- walking: a stride, an arm swing, a bob, and a slight lean.

## Scripts

They need Node 22 and `npm i @gltf-transform/core @gltf-transform/functions @gltf-transform/extensions meshoptimizer sharp`
in a scratch folder (they are not dependencies of the game). Copy the `.mjs` files there to run them.

```bash
# 3. simplify + plain GLB for the rigger
PLAIN=1 node optimise-glb.mjs raw/marta.glb plain/marta.glb 10000 1024
# 4. Meshy's CLI (npm exec --package=meshy-cli@0.4.0 -- meshy ...); heights are in game-121/js/view/models.js
meshy rigging create --model-url plain/marta.glb --height-meters 1.5 --async
meshy download --task-json task_<id>.json --asset result.rigged_character_glb_url --output marta_rigged.glb
# 5. shrink the rigged model and put it in the game
node optimise-rigged.mjs marta_rigged.glb ../../assets/models/marta.glb 1024
```

`optimise-glb.mjs` without `PLAIN` is the old static route (normalise, quantise, meshopt in one go) and is kept for a
model that doesn't need to move.

## Looking at them

```bash
python3 -m http.server 8121        # repo root
node game-121/dev/models.mjs       # every character seated, one screenshot each -> dev/shots/models/
MODE=walk node game-121/dev/models.mjs
```

`simtest.mjs` checks that every `look.model` in the story data has a GLB, and that every GLB is used. `?models=0` on the
game's URL keeps the built-in people for everyone.
