# Echoheart Academy — the 3D models (Meshy)

Every character and creature on the campus and in battle is a **Meshy** model, made on 2026-11-25 with the Meshy CLI
0.4.0 by **image-to-3D** from the fal reference pictures (see [../art/README.md](../art/README.md)), so the 3D cast
matches the visual novel. The pipeline scripts are game-147's, with new operation ids.

| Script | What it does |
|---|---|
| `pipeline.mjs WORKDIR JOBS.json` | Image-to-3D (smart topology at a triangle budget, textured 2K, no PBR, `--pose-mode a-pose` for the humanoids), wait, download the GLB and thumbnail. Resumable. |
| `rig.mjs WORKDIR RIGS.json OUTDIR` | Rigging (with walk and run) and one animate task per library clip. Resumable. |
| `clip.py IN OUT` | Strips an animation GLB to its keyframes. |
| `shrink.py IN OUT [px]` | Re-encodes a GLB's textures (1024 for the five heroes and Hollow Veymont, 512 for everyone else). |

## What was generated

| Group | Models | Triangles | Rig and clips (Meshy action id) |
|---|---|---|---|
| Heroes | kai, hana, lys, pip, ren | 8,000 | idle 0, battleIdle 89, attack, skill, hit 171, victory 59, faint 366, wave 28; walk, run. Attack/skill: Kai 129/125 (spell casts), Hana 96/127 (punch, ground slam), Lys 130/131, Pip 129/131, Ren 92/91 (double combo, blade spin). |
| Principal | veymont, hollow (his true form) | 8,000 / 9,000 | Veymont idle, wave; Hollow battleIdle, attack 129, skill 125, hit, faint, victory |
| Others | graves, theo, yuki | 6,000–7,000 | Graves idle, battleIdle, attack 130, hit, victory; Theo and Yuki idle, wave, faint (asleep in the cages) |
| Foes | acolyte, armor | 6,000–7,000 | battleIdle, attack (129 / 96), hit, faint |
| Creatures | mochi, wisp, gargoyle | 4,000–5,000 | none: procedural bob, hop, squash and faint |

The A-pose option paid off: all eleven rigs succeeded first time (game-147 had to rebuild three in an A-pose).
Veymont's cane and Hollow Veymont's staff were dropped by image-to-3D, which also kept their hands free for rigging.

## Credits

| Stage | Count | Credits |
|---|---:|---:|
| Image-to-3D (15 each) | 15 | 225 |
| Rigging (5 each) | 11 | 55 |
| Animation (3 each) | 67 | 201 |
| **Total** | | **≈ 481** |

## In the game

`js/view/assets.js` (from game-147) loads each model once, gives it a three-step toon material and an inverted-hull
ink outline, fits it to a height, and makes an `Actor` that crossfades between looping bases (idle, battleIdle, walk,
run) and one-shots (attack, skill, hit, victory, faint, wave). Until a model has loaded a coloured capsule stands in.
