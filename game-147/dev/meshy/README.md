# Inn Over My Head — the 3D models (Meshy)

Every 3D asset in the game is a [Meshy](https://www.meshy.ai) model, generated on 2026-11-23 with the Meshy CLI 0.4.0:
the five heroes, Madame Goldmaw, three guest types, nine monsters, and 57 items, weapons, meals, decor and pieces of
furniture. Each was made by **image-to-3D** from a reference picture painted with ElevenLabs (see
[../art/README.md](../art/README.md)), so the models match the 2D portraits and icons. The humanoids are **rigged by
Meshy** and play clips from Meshy's animation library.

| Script | What it does |
|---|---|
| `pipeline.mjs WORKDIR JOBS.json` | Image-to-3D for a list of `{ name, image, polycount, pose? }`: smart topology at the given triangle budget, textured (2K, no PBR), then the GLB and its thumbnail. Resumable (`WORKDIR/state.json`); a refused submission is retried. `TAG=x-` for a redo. |
| `rig.mjs WORKDIR RIGS.json OUTDIR` | Rigging (with Meshy's walk and run) and one `animate` task per library clip for each `{ name, task, height, clips: { name: actionId } }`. Resumable (`rig-state.json`). `TAG=v2` for a redo (the CLI refuses a reused operation id with a new payload). |
| `clip.py IN OUT` | Strips an animation GLB to its keyframes: no mesh, skin, material or texture. 3 MB → 30–120 KB. |
| `shrink.py IN OUT [px]` | Re-encodes a GLB's textures at `px` (1024 for heroes and Goldmaw, 512 for guests, monsters and furniture, 256 for items). From game-145. |
| `../icons.mjs` + `../icons.html` | Renders every item model as a 128 px toon icon (`art/icons/<id>.webp`) for the UI. |
| `../rig.html` + `../rigshot.mjs` | Plays a rigged model's clips in toon shading and saves a strip of frames per clip (`node game-147/dev/rigshot.mjs maple walk,run,attack`), for checking rigs by eye. |

## What was generated

| Group | Models | Triangles | Notes |
|---|---|---|---|
| Heroes | maple, ember, kit, fern, bru | 8,000–9,000 | Rigged. Ember rebuilt (see below). |
| People | goldmaw, guest-merchant, guest-noble, guest-adventurer | 6,000–8,000 | Rigged. The merchant and noble rebuilt in an A-pose. |
| Monsters | dustbunny, honeyslime, puffcap, mosssnail, crystalbat, pebblegolem | 5,000–6,000 | Pebble Golem rigged; the rest move procedurally. |
| Bosses | thistlehog, grandmorel, molequeen | 9,000 | The Grand Morel and Queen Gemma rigged. |
| Items | 16 ingredients, battle items and tools; 7 meals; 10 weapons; 4 accessories; 5 decor; suitcase, diary, coins, chest, desk bell, feather duster | 1,800 | Shown in 3D (meals on the kitchen table, decor in the lobby, the pot on the stove) and as icons. |
| Furniture | desk, bed, stove, table, planter, armchair, bookshelf, bathtub, wardrobe | 3,000–4,000 | The inn's rooms. |

**Rigged characters and clips** (`models/anim/<name>-<clip>.glb`):

| Character | Clips (Meshy library action id) |
|---|---|
| maple | walk, run (rig) · idle 0 · battleIdle 89 · attack 219 Right-hand Sword Slash · skill 221 Charged Upward Slash · chain 86 Jump Attack · hit 171 · victory 59 · faint 366 · wave 28 |
| ember | as Maple, with attack 129 Mage Spell Cast and skill 125 Charged Spell Cast |
| kit | as Maple, with attack 92 Double Combo Attack and skill 91 Double Blade Spin |
| fern | as Maple, with attack 130 and skill 131 Mage Spell Casts |
| bru | as Maple, with attack 242 Charged Slash and skill 127 Charged Ground Slam |
| goldmaw, guest-* | walk, run, idle 0, wave 28 |
| pebblegolem | walk, run, battleIdle 89, attack 96 Kung Fu Punch, hit 171, faint 366 |
| grandmorel, molequeen | walk, run, battleIdle 89, attack 4, hit 171, faint 366, skill 125 / 127 |

## What went wrong, and the fixes

- **Ember's face.** Her round wire glasses and a soot smudge came out as a smeared, distorted face. The reference was
  edited in ElevenLabs (same character and pose, no glasses, no smudge) and the model rebuilt.
- **Rigging failures.** `rigging create` failed with `Fail to invoke pose estimation` on the merchant (a huge backpack),
  the noble lady (a wide skirt) and Puffcap (stub limbs). The two people were rebuilt with `--pose-mode a-pose` and then
  rigged; Puffcap stays procedural, like the other creatures without humanoid limbs.

## Credits

| Stage | Count | Credits |
|---|---:|---:|
| Image-to-3D (15 each) | 75 + Ember + 2 A-pose rebuilds | 1,170 |
| Rigging (5 each) | 12 | 60 |
| Animation (3 each) | 70 | 210 |
| **Total** | | **≈ 1,440** |

## In the game

`js/view/assets.js` loads each model once, replaces its materials with a three-step `MeshToonMaterial` (the Meshy
texture as the map) and adds an inverted-hull ink outline (a `SkinnedMesh` on the same skeleton for rigged characters).
`Actor` fits the model to a height with its feet on the ground, loads its clips and crossfades between a looping base
(idle, combat idle, walk, run) and one-shots (attack, skill, chain, hit, victory, faint, wave). Creatures without a rig
use procedural motion under the same names. Until a model loads, a coloured capsule stands in.
